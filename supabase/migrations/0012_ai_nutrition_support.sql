-- ============================================================
-- Items 3+4: AI meal plan generation + calorie estimation support.
-- ============================================================

-- Per-fighter dietary restrictions. Plain text[] (not an enum) on purpose:
-- adding a new restriction later is a frontend constant-list edit, not a
-- migration. Lives on fighters (every profile has one), alongside the
-- other nutrition-scoped setting (daily_calorie_target).
alter table public.fighters add column dietary_restrictions text[] not null default '{}';

-- meal_plan_items had no calorie/macro columns at all — needed to store
-- AI-generated (or manually entered) per-meal recipe info. `description`
-- is untouched, still the primary free-text field.
alter table public.meal_plan_items add column name text;
alter table public.meal_plan_items add column calories integer;
alter table public.meal_plan_items add column protein_g numeric(5,1);
alter table public.meal_plan_items add column carbs_g numeric(5,1);
alter table public.meal_plan_items add column fat_g numeric(5,1);
