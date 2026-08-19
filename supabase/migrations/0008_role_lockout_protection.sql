-- ============================================================
-- Extend the existing role-escalation trigger with a lockout guard:
-- demoting a coach to fighter is blocked if no OTHER coach would
-- remain. Covers both "the sole coach demotes themselves" and
-- "a coach demotes the only other coach to zero" with one check,
-- enforced at the DB level (not just the UI) so it can't be bypassed
-- via a direct API call.
-- ============================================================
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and not public.is_coach() then
    raise exception 'Only coaches may change a profile role';
  end if;

  if old.role = 'coach' and new.role <> 'coach' then
    if not exists (select 1 from public.profiles where role = 'coach' and id <> old.id) then
      raise exception 'Cannot demote the last coach — promote someone else first';
    end if;
  end if;

  return new;
end;
$$;
