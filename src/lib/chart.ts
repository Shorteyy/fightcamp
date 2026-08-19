export interface ChartPoint {
  date: string;
  weight: number;
}

export interface ChartResult {
  linePath: string;
  goalPath: string;
  dots: { x: number; y: number }[];
  markerX: number;
  goalY: number;
}

const dateNum = (iso: string) => new Date(iso + 'T00:00:00').getTime();

export function buildWeightChart(
  history: ChartPoint[],
  goalWeight: number,
  deadlineISO: string,
  w: number,
  h: number,
): ChartResult {
  const pl = 30, pr = 10, pt = 14, pb = 26;
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
  const dots = history.map((p) => ({ x: sx(p.date), y: sy(p.weight) }));
  return { linePath, goalPath, dots, markerX: sx(deadlineISO), goalY: sy(goalWeight) };
}

export interface MultiChartSeries {
  id: string;
  color: string;
  history: ChartPoint[];
}

export interface MultiChartResult {
  series: { id: string; color: string; linePath: string; dots: { x: number; y: number }[] }[];
  xAxis: { x: number; label: string }[];
}

// Shared x/y domain across every included fighter, so lines are directly
// comparable on one chart (absolute kg, not normalized to % progress).
export function buildMultiWeightChart(allSeries: MultiChartSeries[], w: number, h: number): MultiChartResult {
  const pl = 34, pr = 10, pt = 14, pb = 26;
  const nonEmpty = allSeries.filter((s) => s.history.length > 0);
  if (nonEmpty.length === 0) return { series: [], xAxis: [] };

  const allDates = nonEmpty.flatMap((s) => s.history.map((p) => dateNum(p.date)));
  const allWeights = nonEmpty.flatMap((s) => s.history.map((p) => p.weight));
  const x0 = Math.min(...allDates);
  const x1 = Math.max(...allDates);
  let yMin = Math.min(...allWeights);
  let yMax = Math.max(...allWeights);
  const pad = (yMax - yMin) * 0.15 || 1;
  yMin -= pad;
  yMax += pad;

  const sx = (d: string) => pl + ((dateNum(d) - x0) / ((x1 - x0) || 1)) * (w - pl - pr);
  const sy = (wt: number) => h - pb - ((wt - yMin) / (yMax - yMin)) * (h - pt - pb);

  const series = nonEmpty.map((s) => ({
    id: s.id,
    color: s.color,
    linePath: s.history.map((p, i) => (i === 0 ? 'M' : 'L') + sx(p.date).toFixed(1) + ',' + sy(p.weight).toFixed(1)).join(' '),
    dots: s.history.map((p) => ({ x: sx(p.date), y: sy(p.weight) })),
  }));

  const xAxis = [
    { x: sx(new Date(x0).toISOString().slice(0, 10)), label: new Date(x0).toISOString().slice(0, 10) },
    { x: sx(new Date(x1).toISOString().slice(0, 10)), label: new Date(x1).toISOString().slice(0, 10) },
  ];

  return { series, xAxis };
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
