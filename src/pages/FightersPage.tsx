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
import { computeStatus, buildMultiWeightChart } from '../lib/chart';
import { effectiveDeadline } from '../lib/goals';
import { todayISO } from '../lib/date';
import type { Fighter, WeightEntry } from '../types/database';

type Tab = 'overview' | 'weights' | 'graph';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'weights', label: 'WEIGHTS' },
  { id: 'graph', label: 'GRAPH' },
];

export function FightersPage() {
  const { profile } = useAuth();
  const { directory } = useProfileDirectory();
  const { galasById, loading: galasLoading } = useGalaDirectory();
  const { goalsByFighter, loading: goalsLoading, refresh: refreshGoals } = useActiveGoals();
  const [tab, setTab] = useState<Tab>('overview');
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [weightByFighter, setWeightByFighter] = useState<Record<string, WeightEntry[]>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toggledOff, setToggledOff] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const isCoach = profile?.role === 'coach';

  const load = useCallback(async () => {
    setLoading(true);
    // Every profile has a fighters row now (coaches included), but this roster is
    // specifically "who trains" — so it excludes coach profiles.
    const { data: fighterProfiles } = await supabase.from('profiles').select('id').eq('role', 'fighter');
    const fighterProfileIds = new Set((fighterProfiles ?? []).map((p) => p.id));
    const { data: fRows } = await supabase.from('fighters').select('*');
    const filtered = (fRows ?? []).filter((f) => fighterProfileIds.has(f.profile_id));
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
    .map((f) => ({
      id: f.profile_id,
      color: directory[f.profile_id]?.hueColor ?? 'oklch(0.6 0.1 0)',
      history: (weightByFighter[f.profile_id] ?? []).map((e) => ({ date: e.entry_date, weight: e.weight_kg })),
    }));
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
        <h1 className="heading" style={{ fontSize: 44, margin: 0 }}>FIGHTERS</h1>
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
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{d?.name}</div>
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
                + ADD FIGHTER
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
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
          {chart.series.length > 0 ? (
            <svg width="100%" height="360" viewBox="0 0 800 360">
              {chart.series.map((s) => (
                <g key={s.id}>
                  <path d={s.linePath} stroke={s.color} strokeWidth="2.5" fill="none" />
                  {s.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="3" fill={s.color} />)}
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
          }}
        />
      )}
    </div>
  );
}
