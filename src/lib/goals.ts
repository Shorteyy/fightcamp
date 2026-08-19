import type { Fighter, Gala } from '../types/database';

// The single source of truth for a fighter's deadline: if goal_gala_id is set, the
// linked gala's event_date IS the deadline (always fresh, never copied); otherwise
// fall back to the fighter's own freestanding goal_deadline.
export function effectiveDeadline(fighter: Fighter, galasById: Record<string, Gala>): string | null {
  if (fighter.goal_gala_id) {
    return galasById[fighter.goal_gala_id]?.event_date ?? null;
  }
  return fighter.goal_deadline;
}

export function linkedGala(fighter: Fighter, galasById: Record<string, Gala>): Gala | null {
  if (!fighter.goal_gala_id) return null;
  return galasById[fighter.goal_gala_id] ?? null;
}
