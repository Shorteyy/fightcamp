-- ============================================================
-- "Currently following" flag on meal plans, so the Nutrition "Today"
-- tab can auto-suggest today's planned meals. At most one followed
-- plan per owner, same one-active-per-fighter pattern as goals.
-- ============================================================
alter table public.meal_plans add column is_following boolean not null default false;
create unique index meal_plans_one_following_per_owner on public.meal_plans (owner_id) where is_following;
