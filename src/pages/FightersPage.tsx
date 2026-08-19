import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useProfileDirectory } from '../hooks/useProfileDirectory';
import { useGalaDirectory } from '../hooks/useGalaDirectory';
import { ShareFighterModal } from '../components/ShareFighterModal';
import { FighterProfileModal } from '../components/FighterProfileModal';
import { computeStatus } from '../lib/chart';
import { effectiveDeadline } from '../lib/goals';
import { todayISO } from '../lib/date';
import type { Fighter, WeightEntry } from '../types/database';

export function FightersPage() {
  const { profile } = useAuth();
  const { directory } = useProfileDirectory();
  const { galasById, loading: galasLoading } = useGalaDirectory();
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [weightByFighter, setWeightByFighter] = useState<Record<string, WeightEntry[]>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Every profile has a fighters row now (coaches included), but this roster is
    // specifically "who I coach" — so it excludes coach profiles, including your own.
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

  if (profile && profile.role !== 'coach') return <Navigate to="/dashboard" replace />;
  if (loading || galasLoading) return <div style={{ color: 'var(--muted-2)' }}>Loading…</div>;

  const today = todayISO();
  const selected = fighters.find((f) => f.profile_id === selectedId) ?? null;

  return (
    <div>
      <h1 className="heading" style={{ fontSize: 44, margin: '0 0 24px 0' }}>FIGHTERS</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18 }}>
        {fighters.map((f) => {
          const d = directory[f.profile_id];
          const hist = weightByFighter[f.profile_id] ?? [];
          const deadline = effectiveDeadline(f, galasById);
          const hasGoal = f.goal_weight_kg != null && deadline != null;
          const status = hasGoal && hist.length > 0 ? computeStatus(hist.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), f.goal_weight_kg!, deadline!, today) : null;
          const first = hist[0]?.weight_kg;
          const range = status && first != null ? first - f.goal_weight_kg! : 0;
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
                Current: <strong style={{ color: 'var(--text)' }}>{hist[hist.length - 1]?.weight_kg ?? '—'} kg</strong> · Goal: <strong style={{ color: 'var(--text)' }}>{f.goal_weight_kg ?? '—'} kg</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 10 }}>Deadline: {deadline ?? '—'}</div>
              <div style={{ height: 6, background: 'var(--track)', width: '100%' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          );
        })}
        <div
          onClick={() => setShareOpen(true)}
          style={{ border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 170, cursor: 'pointer', color: 'var(--muted-3)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1 }}
        >
          + ADD FIGHTER
        </div>
      </div>

      {shareOpen && <ShareFighterModal onClose={() => setShareOpen(false)} />}
      {selected && directory[selected.profile_id] && (
        <FighterProfileModal
          fighter={selected}
          profile={directory[selected.profile_id]}
          isCoach={profile?.role === 'coach'}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
