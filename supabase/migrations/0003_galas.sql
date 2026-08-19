-- ============================================================
-- GALAS (fight events)
-- ============================================================
create type public.gala_participation_type as enum ('attending', 'attending_vip', 'fighting', 'cornering');

create table public.galas (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  event_date   date not null,
  location     text not null default '',
  notes        text not null default '',
  poster_url   text,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index galas_date_idx on public.galas (event_date);

create table public.gala_participants (
  gala_id            uuid not null references public.galas(id) on delete cascade,
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  participation_type public.gala_participation_type not null,
  created_at         timestamptz not null default now(),
  primary key (gala_id, profile_id)
);

-- Links a fighter's goal to a specific gala instead of duplicating a deadline:
-- when set, the LINKED GALA'S event_date is the effective deadline —
-- fighters.goal_deadline is only meaningful when this is null.
alter table public.fighters add column goal_gala_id uuid references public.galas(id) on delete set null;

alter table public.galas enable row level security;
alter table public.gala_participants enable row level security;

create policy "galas_select_authenticated" on public.galas
  for select using (auth.role() = 'authenticated');
create policy "galas_insert_coach_only" on public.galas
  for insert with check (public.is_coach());
create policy "galas_update_coach_only" on public.galas
  for update using (public.is_coach());
create policy "galas_delete_coach_only" on public.galas
  for delete using (public.is_coach());

create policy "gala_participants_select_authenticated" on public.gala_participants
  for select using (auth.role() = 'authenticated');
create policy "gala_participants_insert_self_or_coach" on public.gala_participants
  for insert with check (profile_id = auth.uid() or public.is_coach());
create policy "gala_participants_update_self_or_coach" on public.gala_participants
  for update using (profile_id = auth.uid() or public.is_coach());
create policy "gala_participants_delete_self_or_coach" on public.gala_participants
  for delete using (profile_id = auth.uid() or public.is_coach());
