// Shared by item 3's "estimate missing values" (meal-plan cells) and item 4
// (logging a food by description). Any authenticated user may call this —
// it's not privileged, just a convenience estimate; nothing is written to
// the DB here, the client always applies the result to its own draft state.
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { callGemini, GeminiError } from '../_shared/gemini.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface Item {
  id: string;
  description: string;
}

interface Estimate {
  id: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function clampNumber(v: unknown, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  return Math.min(v, max);
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
    const items: Item[] = body?.items;
    if (!Array.isArray(items) || items.length === 0) return jsonResponse({ error: 'Missing items' }, 400);
    if (items.length > 30) return jsonResponse({ error: 'Too many items in one request (max 30)' }, 400);
    for (const it of items) {
      if (typeof it?.id !== 'string' || typeof it?.description !== 'string' || !it.description.trim()) {
        return jsonResponse({ error: 'Each item needs an id and a non-empty description' }, 400);
      }
    }

    const prompt =
      'Estimate calories and macronutrients (protein, carbs, fat, all in grams) for a single realistic serving of each food below. ' +
      'Respond with a JSON array, one object per item, each including the exact same "id" you were given so results can be matched back.\n\n' +
      items.map((it) => `id: ${it.id}\nfood: ${it.description}`).join('\n\n');

    const schema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          calories: { type: 'INTEGER' },
          protein_g: { type: 'NUMBER' },
          carbs_g: { type: 'NUMBER' },
          fat_g: { type: 'NUMBER' },
        },
        required: ['id', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
      },
    };

    let raw: unknown;
    try {
      raw = await callGemini(prompt, schema);
    } catch (e) {
      if (e instanceof GeminiError) return jsonResponse({ error: e.message }, 502);
      throw e;
    }

    if (!Array.isArray(raw)) return jsonResponse({ error: 'AI returned an unexpected shape' }, 502);

    const requestedIds = new Set(items.map((it) => it.id));
    const results: Estimate[] = [];
    for (const r of raw) {
      if (typeof r?.id !== 'string' || !requestedIds.has(r.id)) continue;
      const calories = clampNumber(r.calories, 5000);
      const protein_g = clampNumber(r.protein_g, 500);
      const carbs_g = clampNumber(r.carbs_g, 500);
      const fat_g = clampNumber(r.fat_g, 500);
      if (calories === null || protein_g === null || carbs_g === null || fat_g === null) continue;
      results.push({ id: r.id, calories: Math.round(calories), protein_g, carbs_g, fat_g });
    }

    if (results.length === 0) return jsonResponse({ error: 'AI did not return any usable estimates' }, 502);

    return jsonResponse({ results });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
