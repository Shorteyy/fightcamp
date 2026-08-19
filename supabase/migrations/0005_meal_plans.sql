-- ============================================================
-- MEAL PLANS become a real, nameable, ownable entity instead of flat
-- fighter-scoped cells, so coaches can build one and send COPIES to
-- one or more fighters (each fighter's copy is independently editable).
-- ============================================================
create table public.meal_plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index meal_plans_owner_idx on public.meal_plans (owner_id);

create table public.meal_plan_items (
  id            uuid primary key default gen_random_uuid(),
  meal_plan_id  uuid not null references public.meal_plans(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6),
  meal_group    public.meal_group not null,
  description   text not null default '',
  unique (meal_plan_id, day_of_week, meal_group)
);

alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;

create policy "meal_plans_select_self_or_coach" on public.meal_plans for select using (owner_id = auth.uid() or is_coach());
create policy "meal_plans_insert_self_or_coach" on public.meal_plans for insert with check (owner_id = auth.uid() or is_coach());
create policy "meal_plans_update_self_or_coach" on public.meal_plans for update using (owner_id = auth.uid() or is_coach());
create policy "meal_plans_delete_self_or_coach" on public.meal_plans for delete using (owner_id = auth.uid() or is_coach());

create policy "meal_plan_items_select_self_or_coach" on public.meal_plan_items for select
  using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and (mp.owner_id = auth.uid() or is_coach())));
create policy "meal_plan_items_insert_self_or_coach" on public.meal_plan_items for insert
  with check (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and (mp.owner_id = auth.uid() or is_coach())));
create policy "meal_plan_items_update_self_or_coach" on public.meal_plan_items for update
  using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and (mp.owner_id = auth.uid() or is_coach())));
create policy "meal_plan_items_delete_self_or_coach" on public.meal_plan_items for delete
  using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and (mp.owner_id = auth.uid() or is_coach())));

-- migrate existing data (currently 4 entries) into one named plan per fighter that has any
with new_plans as (
  insert into public.meal_plans (name, owner_id, created_by)
  select 'Meal Plan', fighter_id, fighter_id
  from (select distinct fighter_id from public.meal_plan_entries) f
  returning id, owner_id
)
insert into public.meal_plan_items (meal_plan_id, day_of_week, meal_group, description)
select np.id, mpe.day_of_week, mpe.meal_group, mpe.description
from public.meal_plan_entries mpe
join new_plans np on np.owner_id = mpe.fighter_id;

drop table public.meal_plan_entries;
