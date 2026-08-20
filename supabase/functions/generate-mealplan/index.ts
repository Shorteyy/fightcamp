// Generates a full 7-day x 4-meal-group plan. Any authenticated user may
// call this for themselves. Nothing is written to the DB here — the result
// lands in the client's meal-plan-editor draft state, subject to its
// existing explicit Save.
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { callGemini, GeminiError } from '../_shared/gemini.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const MEAL_GROUPS = ['breakfast', 'lunch', 'dinner', 'snack'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Mirrors src/lib/dietaryRestrictions.ts — kept as a small local copy
// because Edge Functions can't import frontend modules (same pattern
// already used for MEAL_GROUPS above). Used only to turn stored slugs
// into readable text for the prompt; unrecognized values pass through
// as-is so nothing is silently dropped if the two lists drift.
const RESTRICTION_LABELS: Record<string, string> = {
  halal: 'Halal',
  kosher: 'Kosher',
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  lactose_intolerant: 'Lactose intolerant',
  gluten_free: 'Gluten-free',
  nut_allergy: 'Nut allergy',
  shellfish_allergy: 'Shellfish allergy',
};

interface DayItem {
  dayOfWeek: number;
  mealGroup: string;
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function clampNumber(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(min, Math.min(v, max));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: 'Invalid session' }, 401);

    const body = await req.json().catch(() => null);
    const direction = body?.direction;
    // All restrictions, unfiltered by count — only non-string entries are
    // dropped (defensive against a malformed request body).
    const dietaryRestrictions: string[] = Array.isArray(body?.dietaryRestrictions) ? body.dietaryRestrictions.filter((r: unknown) => typeof r === 'string') : [];

    if (direction !== 'goal' && direction !== 'calories') {
      return jsonResponse({ error: 'direction must be "goal" or "calories"' }, 400);
    }

    // Current weight and active-goal context are supplementary background —
    // sent whenever known, regardless of which direction is driving the
    // plan — so the model can pace a "calories" plan sensibly too, not
    // just when direction === 'goal'.
    const currentWeightKg = typeof body?.currentWeightKg === 'number' ? body.currentWeightKg : null;
    const goalWeightKg = typeof body?.goalWeightKg === 'number' ? body.goalWeightKg : null;
    const deadlineISO = typeof body?.deadlineISO === 'string' ? body.deadlineISO : null;

    let goalContext = '';
    if (direction === 'calories') {
      const targetCalories = clampNumber(body?.targetCalories, 800, 8000);
      if (targetCalories === null) return jsonResponse({ error: 'targetCalories must be a number between 800 and 8000' }, 400);
      goalContext = `Build the plan around a daily calorie target of approximately ${targetCalories} kcal.`;
    } else {
      if (currentWeightKg === null || goalWeightKg === null || deadlineISO === null) {
        return jsonResponse({ error: 'goal direction requires goalWeightKg, currentWeightKg, and deadlineISO' }, 400);
      }
      goalContext =
        `This person currently weighs ${currentWeightKg} kg and wants to reach ${goalWeightKg} kg by ${deadlineISO}. ` +
        'Determine a safe, appropriate daily calorie target to work toward that goal by that deadline (do not exceed a safe rate of weight change), and build the plan around it. ' +
        'Report the daily calorie target you chose as dailyCalorieTarget.';
    }

    // Background context beyond whatever direction-specific instruction was
    // just built — e.g. so a "calories" plan still gets paced sensibly
    // against a real goal/deadline instead of ignoring it.
    const backgroundParts: string[] = [];
    if (currentWeightKg !== null && direction !== 'goal') backgroundParts.push(`Current weight: ${currentWeightKg} kg.`);
    if (goalWeightKg !== null && deadlineISO !== null && direction !== 'goal') {
      const daysRemaining = Math.round((new Date(deadlineISO + 'T00:00:00Z').getTime() - Date.now()) / 86400000);
      backgroundParts.push(`They also have an active goal of ${goalWeightKg} kg by ${deadlineISO} (${daysRemaining} days from now) — keep the plan's pacing realistic against that timeline even though it isn't the primary driver here.`);
    }
    const backgroundText = backgroundParts.length > 0 ? ` ${backgroundParts.join(' ')}` : '';

    const restrictionLabels = dietaryRestrictions.map((r) => RESTRICTION_LABELS[r] ?? r);
    const restrictionsText = restrictionLabels.length > 0
      ? `Strictly respect ALL of these dietary restrictions: ${restrictionLabels.join(', ')}. No meal may violate any of them.`
      : 'No dietary restrictions.';

    const prompt =
      `Create a 7-day meal plan for a combat sports athlete (kickboxing) in training. ${goalContext}${backgroundText} ${restrictionsText}\n\n` +
      `Provide exactly one entry for each of the 7 days (Monday=0 through Sunday=6) and each of the 4 meal groups (breakfast, lunch, dinner, snack) — 28 entries total. ` +
      'Each entry needs a short recipe-style name, a one-sentence description, and estimated calories + macros (protein_g, carbs_g, fat_g). ' +
      'Also provide a short plan name (e.g. "Fight Camp Cut Week"), the dailyCalorieTarget used, and a planRationale: 2-3 sentences in plain language explaining how the plan fits the goal — ' +
      'e.g. the size of the calorie deficit/surplus versus an estimated maintenance level, and whether the pace is realistic for the deadline. If there is no weight goal, briefly explain why this calorie target suits a fighter in training.';

    const schema = {
      type: 'OBJECT',
      properties: {
        planName: { type: 'STRING' },
        dailyCalorieTarget: { type: 'INTEGER' },
        planRationale: { type: 'STRING' },
        days: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              dayOfWeek: { type: 'INTEGER' },
              mealGroup: { type: 'STRING', enum: MEAL_GROUPS },
              name: { type: 'STRING' },
              description: { type: 'STRING' },
              calories: { type: 'INTEGER' },
              protein_g: { type: 'NUMBER' },
              carbs_g: { type: 'NUMBER' },
              fat_g: { type: 'NUMBER' },
            },
            required: ['dayOfWeek', 'mealGroup', 'name', 'description', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
          },
        },
      },
      required: ['planName', 'dailyCalorieTarget', 'planRationale', 'days'],
    };

    let raw: unknown;
    try {
      raw = await callGemini(prompt, schema);
    } catch (e) {
      if (e instanceof GeminiError) return jsonResponse({ error: e.message }, 502);
      throw e;
    }

    const parsed = raw as { planName?: unknown; dailyCalorieTarget?: unknown; planRationale?: unknown; days?: unknown };
    const planName = typeof parsed.planName === 'string' && parsed.planName.trim() ? parsed.planName.trim().slice(0, 80) : `AI Plan (${DAY_NAMES[0]}–${DAY_NAMES[6]})`;
    const dailyCalorieTarget = clampNumber(parsed.dailyCalorieTarget, 800, 8000) ?? 2400;
    const planRationale = typeof parsed.planRationale === 'string' ? parsed.planRationale.trim().slice(0, 600) : '';

    if (!Array.isArray(parsed.days)) return jsonResponse({ error: 'AI returned an unexpected shape' }, 502);

    const days: DayItem[] = [];
    for (const d of parsed.days) {
      const dayOfWeek = typeof d?.dayOfWeek === 'number' ? Math.round(d.dayOfWeek) : NaN;
      if (dayOfWeek < 0 || dayOfWeek > 6) continue;
      if (!MEAL_GROUPS.includes(d?.mealGroup)) continue;
      if (typeof d?.name !== 'string' || !d.name.trim()) continue;
      const calories = clampNumber(d.calories, 0, 3000);
      const protein_g = clampNumber(d.protein_g, 0, 300);
      const carbs_g = clampNumber(d.carbs_g, 0, 300);
      const fat_g = clampNumber(d.fat_g, 0, 300);
      if (calories === null || protein_g === null || carbs_g === null || fat_g === null) continue;
      days.push({
        dayOfWeek,
        mealGroup: d.mealGroup,
        name: d.name.trim().slice(0, 120),
        description: typeof d.description === 'string' ? d.description.trim().slice(0, 400) : '',
        calories: Math.round(calories),
        protein_g,
        carbs_g,
        fat_g,
      });
    }

    if (days.length < 14) {
      return jsonResponse({ error: 'AI returned an incomplete plan — please retry' }, 502);
    }

    return jsonResponse({ planName, dailyCalorieTarget: Math.round(dailyCalorieTarget), planRationale, days });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
