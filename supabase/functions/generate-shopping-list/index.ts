// Aggregates a meal plan's items into a categorized shopping list via
// Gemini. Access control relies entirely on RLS: both meal_plans and
// meal_plan_items are fetched through the caller's own client, so a
// non-owner/non-coach simply gets nothing back — no service-role key
// needed here at all, just the Gemini secret. The result is not written
// to the DB by this function; the client persists it (respecting the
// same owner-or-coach update policy) so it's cached for later export.
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { callGemini, GeminiError } from '../_shared/gemini.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface ShoppingItem {
  name: string;
  quantity: string;
}

interface ShoppingCategory {
  category: string;
  items: ShoppingItem[];
}

function cleanString(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
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
    const mealPlanId = body?.mealPlanId;
    if (typeof mealPlanId !== 'string' || !mealPlanId) return jsonResponse({ error: 'Missing mealPlanId' }, 400);

    const { data: plan, error: planErr } = await callerClient.from('meal_plans').select('id, name').eq('id', mealPlanId).maybeSingle();
    if (planErr) return jsonResponse({ error: planErr.message }, 500);
    if (!plan) return jsonResponse({ error: 'Meal plan not found or not accessible' }, 404);

    const { data: items, error: itemsErr } = await callerClient
      .from('meal_plan_items')
      .select('day_of_week, meal_group, name, description')
      .eq('meal_plan_id', mealPlanId);
    if (itemsErr) return jsonResponse({ error: itemsErr.message }, 500);

    const nonEmpty = (items ?? []).filter((it) => (it.name && it.name.trim()) || (it.description && it.description.trim()));
    if (nonEmpty.length === 0) return jsonResponse({ error: 'This plan has no meals to build a shopping list from yet' }, 400);

    const mealLines = nonEmpty
      .map((it) => `- ${it.name?.trim() || '(unnamed)'}: ${it.description?.trim() || ''}`.trim())
      .join('\n');

    const prompt =
      `Here are the meals in a week-long meal plan called "${plan.name}":\n\n${mealLines}\n\n` +
      'Produce a consolidated grocery shopping list covering ingredients for all of these meals for one week, aggregating repeated ingredients into a single line with a combined quantity. ' +
      'Group items into sensible categories such as Produce, Meat & Seafood, Dairy & Alternatives, Pantry, and Other. ' +
      'Each item needs a short name and a practical quantity (e.g. "500g", "6", "2 bunches").';

    const schema = {
      type: 'OBJECT',
      properties: {
        categories: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              category: { type: 'STRING' },
              items: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    quantity: { type: 'STRING' },
                  },
                  required: ['name', 'quantity'],
                },
              },
            },
            required: ['category', 'items'],
          },
        },
      },
      required: ['categories'],
    };

    let raw: unknown;
    try {
      raw = await callGemini(prompt, schema);
    } catch (e) {
      if (e instanceof GeminiError) return jsonResponse({ error: e.message }, 502);
      throw e;
    }

    const parsed = raw as { categories?: unknown };
    if (!Array.isArray(parsed.categories)) return jsonResponse({ error: 'AI returned an unexpected shape' }, 502);

    const categories: ShoppingCategory[] = [];
    for (const c of parsed.categories.slice(0, 20)) {
      const category = cleanString(c?.category, 40);
      if (!category || !Array.isArray(c?.items)) continue;
      const catItems: ShoppingItem[] = [];
      for (const it of c.items.slice(0, 50)) {
        const name = cleanString(it?.name, 80);
        if (!name) continue;
        const quantity = cleanString(it?.quantity, 40) ?? '';
        catItems.push({ name, quantity });
      }
      if (catItems.length > 0) categories.push({ category, items: catItems });
    }

    if (categories.length === 0) return jsonResponse({ error: 'AI returned an empty list — please retry' }, 502);

    return jsonResponse({ categories });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
