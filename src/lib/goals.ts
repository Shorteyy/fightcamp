import type { Gala, Goal } from '../types/database';

// The single source of truth for a goal's deadline: if gala_id is set, the linked
// gala's event_date IS the deadline (always fresh, never copied); otherwise fall
// back to the goal's own freestanding deadline.
export function effectiveDeadline(goal: Goal, galasById: Record<string, Gala>): string | null {
  if (goal.gala_id) {
    return galasById[goal.gala_id]?.event_date ?? null;
  }
  return goal.deadline;
}

export function linkedGala(goal: Goal, galasById: Record<string, Gala>): Gala | null {
  if (!goal.gala_id) return null;
  return galasById[goal.gala_id] ?? null;
}
