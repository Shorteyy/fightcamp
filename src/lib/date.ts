function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return isoFromDate(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoFromDate(d);
}

export function addMonths(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return isoFromDate(d);
}

export function addYears(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setFullYear(d.getFullYear() + n);
  return isoFromDate(d);
}

export function monthStart(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(1);
  return isoFromDate(d);
}

export function yearStart(iso: string): string {
  return `${new Date(iso + 'T00:00:00').getFullYear()}-01-01`;
}

export function yearEnd(iso: string): string {
  return `${new Date(iso + 'T00:00:00').getFullYear()}-12-31`;
}

// 6 full weeks (42 days) covering the month, Monday-start, including leading/trailing days
export function monthGridDates(iso: string): string[] {
  const gridStart = weekStart(monthStart(iso));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function monthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function shortMonthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
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
