-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================
create type public.user_role as enum ('coach', 'fighter');
create type public.training_type as enum ('kickboxing', 'running', 'swimming', 'strength', 'recovery');
create type public.meal_group as enum ('breakfast', 'lunch', 'dinner', 'snack');

-- ============================================================
-- PROFILES  (1:1 with auth.users — every coach AND fighter has one)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'fighter',
  full_name   text not null,
  avatar_hue  smallint not null default floor(random() * 360),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- FIGHTERS  (1:1 extension of profiles, only for role='fighter')
-- No FK/check ties this to profiles.role='fighter' on purpose: a coach
-- could be given a fighters row later (e.g. a coach who also trains)
-- without any schema migration.
-- ============================================================
create table public.fighters (
  profile_id            uuid primary key references public.profiles(id) on delete cascade,
  goal_weight_kg        numeric(5,1),
  goal_deadline          date,
  daily_calorie_target  int not null default 2400,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- WEIGHT ENTRIES
-- ============================================================
create table public.weight_entries (
  id           uuid primary key default gen_random_uuid(),
  fighter_id   uuid not null references public.fighters(profile_id) on delete cascade,
  entry_date   date not null,
  weight_kg    numeric(5,1) not null,
  created_at   timestamptz not null default now(),
  unique (fighter_id, entry_date)
);

-- ============================================================
-- TRAININGS
-- ============================================================
create table public.trainings (
  id             uuid primary key default gen_random_uuid(),
  type           public.training_type not null,
  title          text not null,
  training_date  date not null,
  start_time     time not null,
  location       text not null default '',
  notes          text not null default '',
  created_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index trainings_date_idx on public.trainings (training_date);

-- ============================================================
-- TRAINING ATTENDEES (join table)
-- ============================================================
create table public.training_attendees (
  training_id  uuid not null references public.trainings(id) on delete cascade,
  fighter_id   uuid not null references public.fighters(profile_id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (training_id, fighter_id)
);

-- ============================================================
-- MEAL ENTRIES (logged food)
-- ============================================================
create table public.meal_entries (
  id           uuid primary key default gen_random_uuid(),
  fighter_id   uuid not null references public.fighters(profile_id) on delete cascade,
  entry_date   date not null default current_date,
  meal_group   public.meal_group not null,
  name         text not null,
  calories     int not null,
  protein_g    numeric(5,1) not null default 0,
  carbs_g      numeric(5,1) not null default 0,
  fat_g        numeric(5,1) not null default 0,
  created_at   timestamptz not null default now()
);
create index meal_entries_fighter_date_idx on public.meal_entries (fighter_id, entry_date);

-- ============================================================
-- WEEKLY MEAL PLAN (per fighter, per day-of-week, per meal group)
-- ============================================================
create table public.meal_plan_entries (
  id            uuid primary key default gen_random_uuid(),
  fighter_id    uuid not null references public.fighters(profile_id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6), -- 0=Mon ... 6=Sun
  meal_group    public.meal_group not null,
  description   text not null default '',
  unique (fighter_id, day_of_week, meal_group)
);

-- ============================================================
-- AUTO-CREATE PROFILE (+ fighter row) ON SIGNUP
-- Role is NEVER trusted from the client. First-ever signup becomes
-- 'coach' (bootstrap); every signup after that is always 'fighter'.
-- ============================================================
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role;
begin
  perform pg_advisory_xact_lock(hashtext('profiles_bootstrap'));

  if not exists (select 1 from public.profiles) then
    v_role := 'coach';
  else
    v_role := 'fighter';
  end if;

  insert into public.profiles (id, role, full_name)
  values (new.id, v_role, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  if v_role = 'fighter' then
    insert into public.fighters (profile_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- HELPER: is the current user a coach?
-- ============================================================
create function public.is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

-- ============================================================
-- GUARD: only a coach may change a profile's role.
-- (A WITH CHECK clause can't compare a row's OLD vs NEW value for the
-- row being updated — it only sees the proposed NEW row — so this is
-- enforced with a BEFORE UPDATE trigger, not RLS alone.)
-- ============================================================
create function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and not public.is_coach() then
    raise exception 'Only coaches may change a profile role';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ============================================================
-- LEAST-PRIVILEGE FUNCTION GRANTS
-- ============================================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;
revoke execute on function public.is_coach() from public;
grant execute on function public.is_coach() to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.fighters enable row level security;
alter table public.weight_entries enable row level security;
alter table public.trainings enable row level security;
alter table public.training_attendees enable row level security;
alter table public.meal_entries enable row level security;
alter table public.meal_plan_entries enable row level security;

-- PROFILES: everyone logged in can read (needed for names/avatars everywhere);
-- users edit their own (role column itself is protected by the trigger above),
-- coaches can edit anyone. No insert policy: the signup trigger is the only path in.
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_self_or_coach" on public.profiles
  for update
  using (id = auth.uid() or public.is_coach())
  with check (id = auth.uid() or public.is_coach());

-- FIGHTERS: fighter sees/edits own row; coach sees/edits all; only coach creates/deletes.
create policy "fighters_select_self_or_coach" on public.fighters
  for select using (profile_id = auth.uid() or public.is_coach());
create policy "fighters_insert_coach_only" on public.fighters
  for insert with check (public.is_coach());
create policy "fighters_update_self_or_coach" on public.fighters
  for update using (profile_id = auth.uid() or public.is_coach());
create policy "fighters_delete_coach_only" on public.fighters
  for delete using (public.is_coach());

-- WEIGHT ENTRIES: fighter manages own; coach manages all.
create policy "weight_select_self_or_coach" on public.weight_entries
  for select using (fighter_id = auth.uid() or public.is_coach());
create policy "weight_insert_self_or_coach" on public.weight_entries
  for insert with check (fighter_id = auth.uid() or public.is_coach());
create policy "weight_update_self_or_coach" on public.weight_entries
  for update using (fighter_id = auth.uid() or public.is_coach());
create policy "weight_delete_self_or_coach" on public.weight_entries
  for delete using (fighter_id = auth.uid() or public.is_coach());

-- TRAININGS: everyone reads; any authenticated user creates (as themselves);
-- only the creator or a coach edits/deletes.
create policy "trainings_select_authenticated" on public.trainings
  for select using (auth.role() = 'authenticated');
create policy "trainings_insert_self" on public.trainings
  for insert with check (created_by = auth.uid());
create policy "trainings_update_owner_or_coach" on public.trainings
  for update using (created_by = auth.uid() or public.is_coach());
create policy "trainings_delete_owner_or_coach" on public.trainings
  for delete using (created_by = auth.uid() or public.is_coach());

-- TRAINING ATTENDEES: everyone reads; a fighter can add/remove themselves,
-- a coach can add/remove anyone.
create policy "attendees_select_authenticated" on public.training_attendees
  for select using (auth.role() = 'authenticated');
create policy "attendees_insert_self_or_coach" on public.training_attendees
  for insert with check (fighter_id = auth.uid() or public.is_coach());
create policy "attendees_delete_self_or_coach" on public.training_attendees
  for delete using (fighter_id = auth.uid() or public.is_coach());

-- MEAL ENTRIES: private to the fighter + visible to coach.
create policy "meals_select_self_or_coach" on public.meal_entries
  for select using (fighter_id = auth.uid() or public.is_coach());
create policy "meals_insert_self_or_coach" on public.meal_entries
  for insert with check (fighter_id = auth.uid() or public.is_coach());
create policy "meals_update_self_or_coach" on public.meal_entries
  for update using (fighter_id = auth.uid() or public.is_coach());
create policy "meals_delete_self_or_coach" on public.meal_entries
  for delete using (fighter_id = auth.uid() or public.is_coach());

-- MEAL PLAN: same pattern.
create policy "mealplan_select_self_or_coach" on public.meal_plan_entries
  for select using (fighter_id = auth.uid() or public.is_coach());
create policy "mealplan_insert_self_or_coach" on public.meal_plan_entries
  for insert with check (fighter_id = auth.uid() or public.is_coach());
create policy "mealplan_update_self_or_coach" on public.meal_plan_entries
  for update using (fighter_id = auth.uid() or public.is_coach());
create policy "mealplan_delete_self_or_coach" on public.meal_plan_entries
  for delete using (fighter_id = auth.uid() or public.is_coach());
