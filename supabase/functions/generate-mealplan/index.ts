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
    const dietaryRestrictions: string[] = Array.isArray(body?.dietaryRestrictions) ? body.dietaryRestrictions.filter((r: unknown) => typeof r === 'string') : [];

    if (direction !== 'goal' && direction !== 'calories') {
      return jsonResponse({ error: 'direction must be "goal" or "calories"' }, 400);
    }

    let goalContext = '';
    if (direction === 'calories') {
      const targetCalories = clampNumber(body?.targetCalories, 800, 8000);
      if (targetCalories === null) return jsonResponse({ error: 'targetCalories must be a number between 800 and 8000' }, 400);
      goalContext = `Build the plan around a daily calorie target of approximately ${targetCalories} kcal.`;
    } else {
      const { goalWeightKg, currentWeightKg, deadlineISO } = body ?? {};
      if (typeof goalWeightKg !== 'number' || typeof currentWeightKg !== 'number' || typeof deadlineISO !== 'string') {
        return jsonResponse({ error: 'goal direction requires goalWeightKg, currentWeightKg, and deadlineISO' }, 400);
      }
      goalContext =
        `This person currently weighs ${currentWeightKg} kg and wants to reach ${goalWeightKg} kg by ${deadlineISO}. ` +
        'Determine a safe, appropriate daily calorie target to work toward that goal by that deadline (do not exceed a safe rate of weight change), and build the plan around it. ' +
        'Report the daily calorie target you chose as dailyCalorieTarget.';
    }

    const restrictionsText = dietaryRestrictions.length > 0
      ? `Strictly respect these dietary restrictions: ${dietaryRestrictions.join(', ')}. No meal may violate any of them.`
      : 'No dietary restrictions.';

    const prompt =
      `Create a 7-day meal plan for a combat sports athlete (kickboxing) in training. ${goalContext} ${restrictionsText}\n\n` +
      `Provide exactly one entry for each of the 7 days (Monday=0 through Sunday=6) and each of the 4 meal groups (breakfast, lunch, dinner, snack) — 28 entries total. ` +
      'Each entry needs a short recipe-style name, a one-sentence description, and estimated calories + macros (protein_g, carbs_g, fat_g). ' +
      'Also provide a short plan name (e.g. "Fight Camp Cut Week") and the dailyCalorieTarget used.';

    const schema = {
      type: 'OBJECT',
      properties: {
        planName: { type: 'STRING' },
        dailyCalorieTarget: { type: 'INTEGER' },
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
      required: ['planName', 'dailyCalorieTarget', 'days'],
    };

    let raw: unknown;
    try {
      raw = await callGemini(prompt, schema);
    } catch (e) {
      if (e instanceof GeminiError) return jsonResponse({ error: e.message }, 502);
      throw e;
    }

    const parsed = raw as { planName?: unknown; dailyCalorieTarget?: unknown; days?: unknown };
    const planName = typeof parsed.planName === 'string' && parsed.planName.trim() ? parsed.planName.trim().slice(0, 80) : `AI Plan (${DAY_NAMES[0]}–${DAY_NAMES[6]})`;
    const dailyCalorieTarget = clampNumber(parsed.dailyCalorieTarget, 800, 8000) ?? 2400;

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

    return jsonResponse({ planName, dailyCalorieTarget: Math.round(dailyCalorieTarget), days });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
