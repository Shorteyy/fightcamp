-- ============================================================
-- GOALS become their own table instead of columns on fighters,
-- so a fighter can have goal history, not just one current goal.
-- ============================================================
create type public.goal_status as enum ('active', 'achieved', 'abandoned');

create table public.goals (
  id                uuid primary key default gen_random_uuid(),
  fighter_id        uuid not null references public.fighters(profile_id) on delete cascade,
  target_weight_kg  numeric(5,1) not null,
  deadline          date,                                    -- only meaningful when gala_id is null
  gala_id           uuid references public.galas(id) on delete set null,
  status            public.goal_status not null default 'active',
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint goals_deadline_or_gala check (gala_id is not null or deadline is not null)
);
create index goals_fighter_idx on public.goals (fighter_id);

-- at most one ACTIVE goal per fighter at a time
create unique index goals_one_active_per_fighter on public.goals (fighter_id) where status = 'active';

-- creating (or reactivating) an active goal automatically retires whatever was
-- active before, so the frontend never has to orchestrate that itself
create function public.retire_previous_active_goal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' then
    update public.goals set status = 'abandoned', updated_at = now()
    where fighter_id = new.fighter_id and status = 'active' and id <> new.id;
  end if;
  return new;
end;
$$;
create trigger goals_retire_previous
  before insert or update of status on public.goals
  for each row execute function public.retire_previous_active_goal();
revoke execute on function public.retire_previous_active_goal() from public, anon, authenticated;

alter table public.goals enable row level security;
-- same visibility as fighters/weight_entries today (self-or-coach)
create policy "goals_select_self_or_coach" on public.goals for select using (fighter_id = auth.uid() or is_coach());
create policy "goals_insert_self_or_coach" on public.goals for insert with check (fighter_id = auth.uid() or is_coach());
create policy "goals_update_self_or_coach" on public.goals for update using (fighter_id = auth.uid() or is_coach());
create policy "goals_delete_self_or_coach" on public.goals for delete using (fighter_id = auth.uid() or is_coach());

-- migrate existing goal data — nothing lost
insert into public.goals (fighter_id, target_weight_kg, deadline, gala_id, status, created_by)
select profile_id, goal_weight_kg, goal_deadline, goal_gala_id, 'active', profile_id
from public.fighters
where goal_weight_kg is not null;

alter table public.fighters drop column goal_weight_kg;
alter table public.fighters drop column goal_deadline;
alter table public.fighters drop column goal_gala_id;
