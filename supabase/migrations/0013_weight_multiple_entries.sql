-- ============================================================
-- Allow multiple weight entries per day (e.g. morning + evening
-- weigh-ins), keeping full history instead of one row per date.
-- ============================================================
alter table public.weight_entries drop constraint weight_entries_fighter_id_entry_date_key;

-- Optional label for the entry. Null = unspecified/free entry.
-- created_at (already on the table) provides chronological ordering
-- for same-day entries, including ones sharing a period.
alter table public.weight_entries add column period text check (period in ('morning', 'evening'));
