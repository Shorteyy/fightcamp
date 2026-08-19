-- ============================================================
-- Dietary tags on meal plans, using the same value set as
-- fighters.dietary_restrictions (see src/lib/dietaryRestrictions.ts) —
-- one centralized list, no separate tag vocabulary to keep in sync.
-- ============================================================
alter table public.meal_plans add column dietary_tags text[] not null default '{}';
