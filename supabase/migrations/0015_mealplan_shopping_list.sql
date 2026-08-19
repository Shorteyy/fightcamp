-- ============================================================
-- Cached AI-generated shopping list per meal plan. Nullable — no list
-- until generated. Regenerating overwrites (explicit user action).
-- ============================================================
alter table public.meal_plans add column shopping_list jsonb;
alter table public.meal_plans add column shopping_list_generated_at timestamptz;
