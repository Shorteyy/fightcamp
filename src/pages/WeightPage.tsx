import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useGalaDirectory } from '../hooks/useGalaDirectory';
import { buildWeightChart, computeStatus } from '../lib/chart';
import { effectiveDeadline, linkedGala } from '../lib/goals';
import { todayISO } from '../lib/date';
import type { WeightEntry } from '../types/database';

export function WeightPage() {
  const { fighter, refreshFighter } = useAuth();
  const { galasById, loading: galasLoading } = useGalaDirectory();
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const [goalWeight, setGoalWeight] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const load = useCallback(async () => {
    if (!fighter) return;
    setLoading(true);
    const { data } = await supabase.from('weight_entries').select('*').eq('fighter_id', fighter.profile_id).order('entry_date');
    setHistory(data ?? []);
    setLoading(false);
  }, [fighter]);

  useEffect(() => {
    load();
  }, [load]);

  if (!fighter) return <Navigate to="/dashboard" replace />;
  if (loading || galasLoading) return <div style={{ color: 'var(--muted-2)' }}>Loading…</div>;

  const deadline = effectiveDeadline(fighter, galasById);
  const gala = linkedGala(fighter, galasById);
  const hasGoal = fighter.goal_weight_kg != null && deadline != null;
  const today = todayISO();

  const saveGoal = async () => {
    if (!goalWeight || !goalDeadline) return;
    setSavingGoal(true);
    // A manually-entered deadline always overrides/clears any gala link.
    await supabase.from('fighters').update({ goal_weight_kg: parseFloat(goalWeight), goal_deadline: goalDeadline, goal_gala_id: null }).eq('profile_id', fighter.profile_id);
    setSavingGoal(false);
    await refreshFighter();
  };

  const unlinkFromGala = async () => {
    setUnlinking(true);
    await supabase.from('fighters').update({ goal_gala_id: null }).eq('profile_id', fighter.profile_id);
    setUnlinking(false);
    await refreshFighter();
  };

  const submitWeight = async () => {
    if (!value) return;
    setSaving(true);
    await supabase.from('weight_entries').upsert({ fighter_id: fighter.profile_id, entry_date: date, weight_kg: parseFloat(value) }, { onConflict: 'fighter_id,entry_date' });
    setValue('');
    setSaving(false);
    await load();
  };

  if (!hasGoal) {
    return (
      <div>
        <h1 className="heading" style={{ fontSize: 44, margin: '0 0 24px 0' }}>WEIGHT &amp; GOALS</h1>
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="label" style={{ fontSize: 16, marginBottom: 16 }}>SET YOUR GOAL</div>
          <input className="input" style={{ marginBottom: 12 }} type="number" placeholder="Goal weight (kg)" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
          <input className="input" style={{ marginBottom: 18 }} type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} min={today} />
          <button className="btn-primary" style={{ width: '100%' }} onClick={saveGoal} disabled={savingGoal || !goalWeight || !goalDeadline}>
            {savingGoal ? 'SAVING…' : 'SAVE GOAL'}
          </button>
        </div>
      </div>
    );
  }

  const status = history.length > 0 ? computeStatus(history.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), fighter.goal_weight_kg!, deadline!, today) : null;
  const chart = history.length > 0 ? buildWeightChart(history.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), fighter.goal_weight_kg!, deadline!, 760, 300) : null;
  const recentEntries = [...history].reverse().slice(0, 6);

  return (
    <div>
      <h1 className="heading" style={{ fontSize: 44, margin: '0 0 24px 0' }}>WEIGHT &amp; GOALS</h1>

      {gala && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 14 }}>
            🥊 Fight night at <strong>{gala.name}</strong>{status ? ` — ${status.daysLeft} days left` : ''}
          </div>
          <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: 11 }} onClick={unlinkFromGala} disabled={unlinking}>
            Unlink
          </button>
        </div>
      )}

      {status && (
        <div className="card" style={{ borderLeft: `4px solid ${status.color}`, marginBottom: 24, display: 'flex', gap: 36, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="heading" style={{ fontSize: 24, color: status.color }}>{status.status.toUpperCase()}</div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>{Math.abs(status.kgRemaining)} kg remaining</div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>{status.daysLeft} days left</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        {chart ? (
          <svg width="100%" height="300" viewBox="0 0 760 300">
            <line x1={chart.markerX} y1="0" x2={chart.markerX} y2="270" stroke="oklch(0.5 0.01 40)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={chart.markerX} y="288" fontSize="11" fill="oklch(0.6 0.01 40)" textAnchor="middle">Goal: {deadline}</text>
            <path d={chart.goalPath} stroke="oklch(0.5 0.01 40)" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
            <path d={chart.linePath} stroke="oklch(0.58 0.2 25)" strokeWidth="3" fill="none" />
            {chart.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="4" fill="oklch(0.58 0.2 25)" />)}
            <circle cx={chart.markerX} cy={chart.goalY} r="5" fill="none" stroke="oklch(0.5 0.01 40)" strokeWidth="2" />
          </svg>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--muted-3)' }}>Log your first weight entry to see your progress chart.</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20 }}>
        <div className="card" style={{ padding: 22 }}>
          <div className="label" style={{ fontSize: 16, marginBottom: 16 }}>LOG WEIGHT</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input className="input" type="number" placeholder="kg" value={value} onChange={(e) => setValue(e.target.value)} />
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} />
          </div>
          <button className="btn-primary" style={{ width: '100%' }} onClick={submitWeight} disabled={saving || !value}>
            {saving ? 'LOGGING…' : 'LOG WEIGHT'}
          </button>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div className="label" style={{ fontSize: 16, marginBottom: 14 }}>RECENT ENTRIES</div>
          {recentEntries.map((e) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--muted-2)' }}>{e.entry_date}</span>
              <span style={{ fontWeight: 600 }}>{e.weight_kg} kg</span>
            </div>
          ))}
          {recentEntries.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)' }}>No entries yet.</div>}
        </div>
      </div>
    </div>
  );
}
