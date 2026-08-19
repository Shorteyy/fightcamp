import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useProfileDirectory } from '../hooks/useProfileDirectory';
import { useGalaDirectory } from '../hooks/useGalaDirectory';
import { useActiveGoals } from '../hooks/useActiveGoals';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from '../components/PaginationControls';
import { ShareFighterModal } from '../components/ShareFighterModal';
import { FighterProfileModal } from '../components/FighterProfileModal';
import { computeStatus, buildMultiWeightChart, filterHistoryByRange, type DateRange } from '../lib/chart';
import { effectiveDeadline } from '../lib/goals';
import { todayISO, dayFull } from '../lib/date';
import type { Fighter, WeightEntry } from '../types/database';

type Tab = 'overview' | 'weights' | 'graph';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'weights', label: 'WEIGHTS' },
  { id: 'graph', label: 'GRAPH' },
];

export function FightersPage() {
  const { profile } = useAuth();
  const { directory, refresh: refreshDirectory } = useProfileDirectory();
  const { galasById, loading: galasLoading } = useGalaDirectory();
  const { goalsByFighter, loading: goalsLoading, refresh: refreshGoals } = useActiveGoals();
  const [tab, setTab] = useState<Tab>('overview');
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [weightByFighter, setWeightByFighter] = useState<Record<string, WeightEntry[]>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toggledOff, setToggledOff] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [loading, setLoading] = useState(true);

  const isCoach = profile?.role === 'coach';

  const load = useCallback(async () => {
    setLoading(true);
    // Every profile — coach or fighter — has a fighters row now, so this is the whole team.
    const { data: fRows } = await supabase.from('fighters').select('*');
    const filtered = (fRows ?? []) as Fighter[];
    setFighters(filtered);
    const ids = filtered.map((f) => f.profile_id);
    if (ids.length > 0) {
      const { data: entries } = await supabase.from('weight_entries').select('*').in('fighter_id', ids).order('entry_date');
      const map: Record<string, WeightEntry[]> = {};
      for (const e of entries ?? []) map[e.fighter_id] = [...(map[e.fighter_id] ?? []), e];
      setWeightByFighter(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const overviewPagination = usePagination(fighters);
  const allEntriesFlat = fighters
    .flatMap((f) => (weightByFighter[f.profile_id] ?? []).map((e) => ({ ...e, fighterId: f.profile_id })))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const weightsPagination = usePagination(allEntriesFlat);

  if (loading || galasLoading || goalsLoading) return <div style={{ color: 'var(--muted-2)' }}>Loading…</div>;

  const today = todayISO();
  const selected = fighters.find((f) => f.profile_id === selectedId) ?? null;

  const graphSeries = fighters
    .filter((f) => (weightByFighter[f.profile_id]?.length ?? 0) > 0 && !toggledOff.has(f.profile_id))
    .map((f) => {
      const fullHistory = (weightByFighter[f.profile_id] ?? []).map((e) => ({ date: e.entry_date, weight: e.weight_kg }));
      const goal = goalsByFighter[f.profile_id] ?? null;
      const goalDeadline = goal ? effectiveDeadline(goal, galasById) : null;
      return {
        id: f.profile_id,
        color: directory[f.profile_id]?.hueColor ?? 'oklch(0.6 0.1 0)',
        history: filterHistoryByRange(fullHistory, dateRange, today),
        goal: goal && goalDeadline ? { targetWeight: goal.target_weight_kg, deadlineISO: goalDeadline } : null,
      };
    });
  const chart = buildMultiWeightChart(graphSeries, 800, 360);

  const toggleFighter = (id: string) => {
    setToggledOff((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="heading" style={{ fontSize: 44, margin: 0 }}>TEAM</h1>
        <div style={{ display: 'flex', gap: 2, background: 'var(--panel)', border: '1px solid var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ padding: '10px 18px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18 }}>
            {overviewPagination.pageItems.map((f) => {
              const d = directory[f.profile_id];
              const hist = weightByFighter[f.profile_id] ?? [];
              const goal = goalsByFighter[f.profile_id] ?? null;
              const deadline = goal ? effectiveDeadline(goal, galasById) : null;
              const hasGoal = goal != null && deadline != null;
              const status = hasGoal && hist.length > 0 ? computeStatus(hist.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), goal!.target_weight_kg, deadline!, today) : null;
              const first = hist[0]?.weight_kg;
              const range = status && first != null && goal ? first - goal.target_weight_kg : 0;
              const pct = status && range > 0 ? Math.min(100, Math.max(0, ((first! - status.current) / range) * 100)) : 0;

              return (
                <div key={f.profile_id} onClick={() => setSelectedId(f.profile_id)} className="card" style={{ padding: 20, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: d?.hueColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                      {d?.initials}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{d?.name}</div>
                        {d?.role === 'coach' && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 3, padding: '1px 5px' }}>COACH</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: status?.color ?? 'var(--muted-3)', letterSpacing: '0.5px' }}>
                        {status ? status.status.toUpperCase() : 'NO GOAL SET'}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 4 }}>
                    Current: <strong style={{ color: 'var(--text)' }}>{hist[hist.length - 1]?.weight_kg ?? '—'} kg</strong> · Goal: <strong style={{ color: 'var(--text)' }}>{goal?.target_weight_kg ?? '—'} kg</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 10 }}>Deadline: {deadline ?? '—'}</div>
                  <div style={{ height: 6, background: 'var(--track)', width: '100%' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
              );
            })}
            {isCoach && (
              <div
                onClick={() => setShareOpen(true)}
                style={{ border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 170, cursor: 'pointer', color: 'var(--muted-3)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1 }}
              >
                + INVITE MEMBER
              </div>
            )}
          </div>
          <PaginationControls page={overviewPagination.page} totalPages={overviewPagination.totalPages} onChange={overviewPagination.setPage} />
        </>
      )}

      {tab === 'weights' && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11, color: 'var(--muted-3)', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <div>FIGHTER</div>
            <div>DATE</div>
            <div>WEIGHT</div>
          </div>
          {weightsPagination.pageItems.map((e) => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div>{directory[e.fighterId]?.name ?? '—'}</div>
              <div style={{ color: 'var(--muted-2)' }}>{e.entry_date}</div>
              <div style={{ fontWeight: 600 }}>{e.weight_kg} kg</div>
            </div>
          ))}
          {allEntriesFlat.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)', padding: '8px 0' }}>No weight entries yet.</div>}
          <PaginationControls page={weightsPagination.page} totalPages={weightsPagination.totalPages} onChange={weightsPagination.setPage} />
        </div>
      )}

      {tab === 'graph' && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {fighters.map((f) => {
                const d = directory[f.profile_id];
                const on = !toggledOff.has(f.profile_id);
                const hasHistory = (weightByFighter[f.profile_id]?.length ?? 0) > 0;
                if (!hasHistory) return null;
                return (
                  <button
                    key={f.profile_id}
                    onClick={() => toggleFighter(f.profile_id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: `1px solid ${d?.hueColor}`, background: on ? d?.hueColor : 'transparent', color: on ? 'oklch(0.15 0.006 40)' : d?.hueColor, fontSize: 12, fontWeight: 700 }}
                  >
                    {d?.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--panel)', border: '1px solid var(--border)' }}>
              {([['1m', '1M'], ['3m', '3M'], ['all', 'ALL TIME']] as [DateRange, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setDateRange(id)}
                  style={{ padding: '6px 12px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 11, background: dateRange === id ? 'var(--accent)' : 'transparent', color: dateRange === id ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {chart.series.length > 0 ? (
            <svg width="100%" height="360" viewBox="0 0 800 360">
              {chart.yTicks.map((t, i) => (
                <g key={i}>
                  <line x1={40} y1={t.pos} x2={800 - 14} y2={t.pos} stroke="oklch(0.28 0.012 40)" strokeWidth="1" />
                  <text x={34} y={t.pos + 4} fontSize="10" fill="oklch(0.55 0.01 40)" textAnchor="end">{t.label}</text>
                </g>
              ))}
              {chart.xTicks.map((t, i) => (
                <text key={i} x={t.pos} y={352} fontSize="10" fill="oklch(0.55 0.01 40)" textAnchor="middle">{t.label}</text>
              ))}
              {chart.series.map((s) => (
                <g key={s.id}>
                  <path d={s.linePath} stroke={s.color} strokeWidth="2.5" fill="none" />
                  {s.dots.map((d, i) => (
                    <circle key={i} cx={d.x} cy={d.y} r="3.5" fill={s.color}>
                      <title>{directory[s.id]?.name} — {dayFull(d.date)}: {d.weight} kg</title>
                    </circle>
                  ))}
                  {s.goalMarker && (
                    <g>
                      <circle cx={s.goalMarker.x} cy={s.goalMarker.y} r="6" fill="none" stroke={s.color} strokeWidth="2" strokeDasharray="3 2">
                        <title>{directory[s.id]?.name} — {s.goalMarker.label}</title>
                      </circle>
                    </g>
                  )}
                </g>
              ))}
            </svg>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--muted-3)' }}>No fighters with weight history selected.</div>
          )}
        </div>
      )}

      {shareOpen && <ShareFighterModal onClose={() => setShareOpen(false)} />}
      {selected && directory[selected.profile_id] && (
        <FighterProfileModal
          fighter={selected}
          profile={directory[selected.profile_id]}
          isCoach={isCoach}
          onClose={() => setSelectedId(null)}
          onChanged={() => {
            load();
            refreshGoals();
            refreshDirectory();
          }}
        />
      )}
    </div>
  );
}
