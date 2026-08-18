export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Monday of the week containing `iso`
export function weekStart(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, diffToMonday);
}

export function weekDates(startISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startISO, i));
}

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return DAY_ABBR[d.getDay()];
}

export function dayFull(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

export function dayOfWeekIndex(iso: string): number {
  // 0=Mon..6=Sun, matching meal_plan_entries.day_of_week
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay();
  return dow === 0 ? 6 : dow - 1;
}
