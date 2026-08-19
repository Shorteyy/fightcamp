-- ============================================================
-- Item 4: cancel vs delete trainings. cancelled_at is nullable —
-- null means active; a timestamp doubles as "when" it was cancelled.
-- No RLS change needed: cancel is just an UPDATE (already covered by
-- trainings_update_owner_or_coach), delete already had a policy
-- (trainings_delete_owner_or_coach) — only the UI was never built.
-- ============================================================
alter table public.trainings add column cancelled_at timestamptz;
