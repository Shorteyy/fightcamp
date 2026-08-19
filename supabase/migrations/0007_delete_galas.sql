-- ============================================================
-- Item 9: allow deleting galas. gala_participants already cascades
-- (on delete cascade). goals.gala_id already has ON DELETE SET NULL,
-- but that alone would leave a goal with BOTH gala_id and deadline
-- null, violating goals_deadline_or_gala. So: freeze the gala's
-- event_date into deadline for any linked goals right before the
-- gala row is removed, then clear gala_id — the fighter keeps their
-- deadline exactly as it was, just no longer tied to a gala that no
-- longer exists.
-- ============================================================
create function public.freeze_goal_deadline_on_gala_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.goals set deadline = old.event_date, gala_id = null, updated_at = now()
  where gala_id = old.id;
  return old;
end;
$$;
revoke execute on function public.freeze_goal_deadline_on_gala_delete() from public, anon, authenticated;

create trigger galas_freeze_goal_deadline
  before delete on public.galas
  for each row execute function public.freeze_goal_deadline_on_gala_delete();
