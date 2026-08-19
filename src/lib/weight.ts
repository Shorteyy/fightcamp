import type { WeightEntry, WeightPeriod } from '../types/database';

// Chronological order, oldest first. Same-day entries (e.g. morning +
// evening) break ties by created_at so "current" and chart ordering stay
// correct even though entry_date alone no longer uniquely orders rows.
export function sortWeightEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date.localeCompare(b.entry_date);
    return a.created_at.localeCompare(b.created_at);
  });
}

export const PERIOD_LABEL: Record<WeightPeriod, string> = {
  morning: 'Morning',
  evening: 'Evening',
};
