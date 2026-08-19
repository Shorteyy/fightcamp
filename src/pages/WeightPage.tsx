import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useGalaDirectory } from '../hooks/useGalaDirectory';
import { buildWeightChart, computeStatus } from '../lib/chart';
import { effectiveDeadline, linkedGala } from '../lib/goals';
import { todayISO } from '../lib/date';
import type { Goal, WeightEntry } from '../types/database';

export function WeightPage() {
  const { fighter, profile } = useAuth();
  const { galasById, loading: galasLoading } = useGalaDirectory();
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [goalHistory, setGoalHistory] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [goalWeight, setGoalWeight] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const load = useCallback(async () => {
    if (!fighter) return;
    setLoading(true);
    const { data } = await supabase.from('weight_entries').select('*').eq('fighter_id', fighter.profile_id).order('entry_date');
    setHistory(data ?? []);

    const { data: goals } = await supabase.from('goals').select('*').eq('fighter_id', fighter.profile_id).order('created_at', { ascending: false });
    const rows = (goals ?? []) as Goal[];
    setActiveGoal(rows.find((g) => g.status === 'active') ?? null);
    setGoalHistory(rows.filter((g) => g.status !== 'active'));

    setLoading(false);
  }, [fighter]);

  useEffect(() => {
    load();
  }, [load]);

  if (!fighter || !profile) return <Navigate to="/dashboard" replace />;
  if (loading || galasLoading) return <div style={{ color: 'var(--muted-2)' }}>Loading…</div>;

  const today = todayISO();
  const deadline = activeGoal ? effectiveDeadline(activeGoal, galasById) : null;
  const gala = activeGoal ? linkedGala(activeGoal, galasById) : null;

  const startCreate = () => {
    setGoalWeight('');
    setGoalDeadline('');
    setCreatingNew(true);
    setEditing(false);
  };

  const startEdit = () => {
    if (!activeGoal) return;
    setGoalWeight(activeGoal.target_weight_kg.toString());
    setGoalDeadline(activeGoal.deadline ?? '');
    setEditing(true);
    setCreatingNew(false);
  };

  const createGoal = async () => {
    if (!goalWeight || !goalDeadline) return;
    setSavingGoal(true);
    await supabase.from('goals').insert({ fighter_id: fighter.profile_id, target_weight_kg: parseFloat(goalWeight), deadline: goalDeadline, created_by: profile.id });
    setSavingGoal(false);
    setCreatingNew(false);
    await load();
  };

  const saveEdit = async () => {
    if (!activeGoal || !goalWeight) return;
    setSavingGoal(true);
    // Editing a manual deadline always clears any gala link — you're overriding it with a custom one.
    await supabase.from('goals').update({ target_weight_kg: parseFloat(goalWeight), deadline: goalDeadline || null, gala_id: null }).eq('id', activeGoal.id);
    setSavingGoal(false);
    setEditing(false);
    await load();
  };

  const unlinkFromGala = async () => {
    if (!activeGoal) return;
    setUnlinking(true);
    await supabase.from('goals').update({ gala_id: null }).eq('id', activeGoal.id);
    setUnlinking(false);
    await load();
  };

  const markGoal = async (status: 'achieved' | 'abandoned') => {
    if (!activeGoal) return;
    await supabase.from('goals').update({ status }).eq('id', activeGoal.id);
    await load();
  };

  const deleteGoal = async (id: string) => {
    if (!confirm('Delete this goal from your history?')) return;
    await supabase.from('goals').delete().eq('id', id);
    await load();
  };

  const submitWeight = async () => {
    if (!value) return;
    setSaving(true);
    await supabase.from('weight_entries').upsert({ fighter_id: fighter.profile_id, entry_date: date, weight_kg: parseFloat(value) }, { onConflict: 'fighter_id,entry_date' });
    setValue('');
    setSaving(false);
    await load();
  };

  const goalForm = (onSubmit: () => void, submitLabel: string, showCancel: boolean, onCancel: () => void) => (
    <div className="card" style={{ maxWidth: 420, marginBottom: 24 }}>
      <div className="label" style={{ fontSize: 16, marginBottom: 16 }}>{submitLabel === 'SAVE GOAL' ? 'SET YOUR GOAL' : submitLabel}</div>
      <input className="input" style={{ marginBottom: 12 }} type="number" placeholder="Goal weight (kg)" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
      <input className="input" style={{ marginBottom: 18 }} type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} min={today} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={onSubmit} disabled={savingGoal || !goalWeight || !goalDeadline}>
          {savingGoal ? 'SAVING…' : submitLabel}
        </button>
        {showCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );

  if (!activeGoal && !creatingNew) {
    return (
      <div>
        <h1 className="heading" style={{ fontSize: 44, margin: '0 0 24px 0' }}>WEIGHT &amp; GOALS</h1>
        {goalForm(createGoal, 'SAVE GOAL', false, () => {})}
        {goalHistory.length > 0 && (
          <GoalHistoryList goals={goalHistory} galasById={galasById} onDelete={deleteGoal} />
        )}
      </div>
    );
  }

  if (creatingNew) {
    return (
      <div>
        <h1 className="heading" style={{ fontSize: 44, margin: '0 0 24px 0' }}>WEIGHT &amp; GOALS</h1>
        {goalForm(createGoal, 'START NEW GOAL', true, () => setCreatingNew(false))}
      </div>
    );
  }

  const status = activeGoal && deadline && history.length > 0
    ? computeStatus(history.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), activeGoal.target_weight_kg, deadline, today)
    : null;
  const chart = activeGoal && deadline && history.length > 0
    ? buildWeightChart(history.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), activeGoal.target_weight_kg, deadline, 760, 300)
    : null;
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

      {editing ? (
        goalForm(saveEdit, 'SAVE CHANGES', true, () => setEditing(false))
      ) : (
        status && (
          <div className="card" style={{ borderLeft: `4px solid ${status.color}`, marginBottom: 24, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="heading" style={{ fontSize: 24, color: status.color }}>{status.status.toUpperCase()}</div>
            <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>{Math.abs(status.kgRemaining)} kg remaining</div>
            <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>{status.daysLeft} days left</div>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: 11 }} onClick={startEdit}>Edit</button>
              <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: 11 }} onClick={startCreate}>Start new goal</button>
              <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => markGoal('achieved')}>Mark achieved</button>
            </div>
          </div>
        )
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20, marginBottom: 24 }}>
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

      {goalHistory.length > 0 && <GoalHistoryList goals={goalHistory} galasById={galasById} onDelete={deleteGoal} />}
    </div>
  );
}

function GoalHistoryList({ goals, galasById, onDelete }: { goals: Goal[]; galasById: Parameters<typeof effectiveDeadline>[1]; onDelete: (id: string) => void }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="label" style={{ fontSize: 16, marginBottom: 14 }}>GOAL HISTORY</div>
      {goals.map((g) => {
        const gDeadline = effectiveDeadline(g, galasById);
        const gGala = linkedGala(g, galasById);
        return (
          <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <div>
              <strong>{g.target_weight_kg} kg</strong>
              <span style={{ color: 'var(--muted-2)' }}> by {gDeadline ?? '—'}{gGala ? ` (${gGala.name})` : ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: g.status === 'achieved' ? 'oklch(0.68 0.15 145)' : 'var(--muted-3)', letterSpacing: '0.5px' }}>{g.status.toUpperCase()}</span>
              <button onClick={() => onDelete(g.id)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
