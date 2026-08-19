import { dayFull } from './date';

export interface ChartPoint {
  date: string;
  weight: number;
}

export interface AxisTick {
  pos: number;
  label: string;
}

export interface ChartResult {
  linePath: string;
  goalPath: string;
  dots: { x: number; y: number; date: string; weight: number }[];
  markerX: number;
  goalY: number;
  yTicks: AxisTick[];
  xTicks: AxisTick[];
}

const dateNum = (iso: string) => new Date(iso + 'T00:00:00').getTime();

// N evenly spaced values between min/max inclusive, rounded to 1 decimal for kg display.
function evenTicks(min: number, max: number, count: number): number[] {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round((min + step * i) * 10) / 10);
}

export function buildWeightChart(
  history: ChartPoint[],
  goalWeight: number,
  deadlineISO: string,
  w: number,
  h: number,
): ChartResult {
  const pl = 38, pr = 10, pt = 14, pb = 26;
  const first = history[0];
  const last = history[history.length - 1];
  const x0 = dateNum(first.date);
  const x1 = Math.max(dateNum(last.date), dateNum(deadlineISO));
  const weights = history.map((p) => p.weight).concat([goalWeight]);
  let yMin = Math.min(...weights);
  let yMax = Math.max(...weights);
  const pad = (yMax - yMin) * 0.2 || 1;
  yMin -= pad;
  yMax += pad;
  const sx = (d: string) => pl + ((dateNum(d) - x0) / ((x1 - x0) || 1)) * (w - pl - pr);
  const sy = (wt: number) => h - pb - ((wt - yMin) / (yMax - yMin)) * (h - pt - pb);
  const linePath = history.map((p, i) => (i === 0 ? 'M' : 'L') + sx(p.date).toFixed(1) + ',' + sy(p.weight).toFixed(1)).join(' ');
  const goalPath = 'M' + sx(first.date).toFixed(1) + ',' + sy(first.weight).toFixed(1) + ' L' + sx(deadlineISO).toFixed(1) + ',' + sy(goalWeight).toFixed(1);
  const dots = history.map((p) => ({ x: sx(p.date), y: sy(p.weight), date: p.date, weight: p.weight }));
  const yTicks: AxisTick[] = evenTicks(yMin, yMax, 4).map((v) => ({ pos: sy(v), label: `${v} kg` }));
  const xTicks: AxisTick[] = [x0, x1].map((t) => {
    const iso = new Date(t).toISOString().slice(0, 10);
    return { pos: sx(iso), label: dayFull(iso) };
  });
  return { linePath, goalPath, dots, markerX: sx(deadlineISO), goalY: sy(goalWeight), yTicks, xTicks };
}

export interface MultiChartSeries {
  id: string;
  color: string;
  history: ChartPoint[];
  goal?: { targetWeight: number; deadlineISO: string } | null;
}

export interface MultiChartSeriesResult {
  id: string;
  color: string;
  linePath: string;
  dots: { x: number; y: number; date: string; weight: number }[];
  goalMarker: { x: number; y: number; label: string } | null;
}

export interface MultiChartResult {
  series: MultiChartSeriesResult[];
  yTicks: AxisTick[];
  xTicks: AxisTick[];
}

// Shared x/y domain across every included fighter, so lines are directly
// comparable on one chart (absolute kg, not normalized to % progress).
// Goal weights/deadlines are folded into the same domain so a target that's
// well outside anyone's current weight doesn't get clipped off-chart.
export function buildMultiWeightChart(allSeries: MultiChartSeries[], w: number, h: number): MultiChartResult {
  const pl = 40, pr = 14, pt = 14, pb = 30;
  const nonEmpty = allSeries.filter((s) => s.history.length > 0);
  if (nonEmpty.length === 0) return { series: [], yTicks: [], xTicks: [] };

  const allDates = nonEmpty.flatMap((s) => [
    ...s.history.map((p) => dateNum(p.date)),
    ...(s.goal ? [dateNum(s.goal.deadlineISO)] : []),
  ]);
  const allWeights = nonEmpty.flatMap((s) => [
    ...s.history.map((p) => p.weight),
    ...(s.goal ? [s.goal.targetWeight] : []),
  ]);
  const x0 = Math.min(...allDates);
  const x1 = Math.max(...allDates);
  let yMin = Math.min(...allWeights);
  let yMax = Math.max(...allWeights);
  const pad = (yMax - yMin) * 0.15 || 1;
  yMin -= pad;
  yMax += pad;

  const sx = (d: string) => pl + ((dateNum(d) - x0) / ((x1 - x0) || 1)) * (w - pl - pr);
  const sxT = (t: number) => pl + (((t - x0) / ((x1 - x0) || 1))) * (w - pl - pr);
  const sy = (wt: number) => h - pb - ((wt - yMin) / (yMax - yMin)) * (h - pt - pb);

  const series: MultiChartSeriesResult[] = nonEmpty.map((s) => ({
    id: s.id,
    color: s.color,
    linePath: s.history.map((p, i) => (i === 0 ? 'M' : 'L') + sx(p.date).toFixed(1) + ',' + sy(p.weight).toFixed(1)).join(' '),
    dots: s.history.map((p) => ({ x: sx(p.date), y: sy(p.weight), date: p.date, weight: p.weight })),
    goalMarker: s.goal ? { x: sx(s.goal.deadlineISO), y: sy(s.goal.targetWeight), label: `Goal: ${s.goal.targetWeight} kg by ${dayFull(s.goal.deadlineISO)}` } : null,
  }));

  const yTicks: AxisTick[] = evenTicks(yMin, yMax, 5).map((v) => ({ pos: sy(v), label: `${v} kg` }));
  const tickCount = 5;
  const xTicks: AxisTick[] = Array.from({ length: tickCount }, (_, i) => {
    const t = x0 + ((x1 - x0) * i) / (tickCount - 1 || 1);
    const iso = new Date(t).toISOString().slice(0, 10);
    return { pos: sxT(t), label: dayFull(iso) };
  });

  return { series, yTicks, xTicks };
}

export type DateRange = '1m' | '3m' | 'all';

export function filterHistoryByRange(history: ChartPoint[], range: DateRange, today: string): ChartPoint[] {
  if (range === 'all') return history;
  const months = range === '1m' ? 1 : 3;
  const cutoff = new Date(today + 'T00:00:00');
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffTime = cutoff.getTime();
  return history.filter((p) => dateNum(p.date) >= cutoffTime);
}

export function computeStatus(history: ChartPoint[], goalWeight: number, deadline: string, today: string) {
  const first = history[0];
  const last = history[history.length - 1];
  const totalDays = (dateNum(deadline) - dateNum(first.date)) / 86400000;
  const elapsedDays = (dateNum(today) - dateNum(first.date)) / 86400000;
  const frac = totalDays > 0 ? Math.min(1, Math.max(0, elapsedDays / totalDays)) : 1;
  const expected = first.weight + (goalWeight - first.weight) * frac;
  const diff = last.weight - expected;
  let status = 'On Track';
  let color = 'oklch(0.68 0.15 145)';
  if (diff > 0.3) {
    status = 'Behind';
    color = 'oklch(0.58 0.2 25)';
  } else if (diff < -0.3) {
    status = 'Ahead';
    color = 'oklch(0.68 0.15 145)';
  } else {
    color = 'oklch(0.78 0.15 90)';
  }
  const kgRemaining = +(last.weight - goalWeight).toFixed(1);
  const daysLeft = Math.round((dateNum(deadline) - dateNum(today)) / 86400000);
  return { status, color, kgRemaining, daysLeft, current: last.weight };
}
