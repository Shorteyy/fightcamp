-- ============================================================
-- Fix 4 dangling created_by/organizer FKs that currently have no ON
-- DELETE action (default RESTRICT) — deleting a profile who ever
-- created a training, gala, or set a goal/plan for someone else
-- would fail outright. Make them nullable + ON DELETE SET NULL: the
-- training/gala/goal/plan survives with created_by = null ("Removed
-- user" in the UI); other people's attendance/participation on it is
-- untouched. Only the deleted person's OWN data (already cascaded
-- via fighters/profile_id everywhere else) actually disappears.
-- ============================================================
alter table public.trainings alter column created_by drop not null;
alter table public.trainings drop constraint trainings_created_by_fkey;
alter table public.trainings add constraint trainings_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.galas alter column created_by drop not null;
alter table public.galas drop constraint galas_created_by_fkey;
alter table public.galas add constraint galas_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.goals alter column created_by drop not null;
alter table public.goals drop constraint goals_created_by_fkey;
alter table public.goals add constraint goals_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.meal_plans alter column created_by drop not null;
alter table public.meal_plans drop constraint meal_plans_created_by_fkey;
alter table public.meal_plans add constraint meal_plans_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- ============================================================
-- Last-coach protection now also covers DELETE, not just role
-- demotion. Same guarantee, same pattern as protect_profile_role().
-- ============================================================
create function public.protect_last_coach_delete()
returns trigger language plpgsql as $$
begin
  if old.role = 'coach' then
    if not exists (select 1 from public.profiles where role = 'coach' and id <> old.id) then
      raise exception 'Cannot delete the last coach — promote someone else first';
    end if;
  end if;
  return old;
end;
$$;

create trigger profiles_protect_last_coach_delete
  before delete on public.profiles
  for each row execute function public.protect_last_coach_delete();
