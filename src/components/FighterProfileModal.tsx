import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TRAINING_TYPE_META, TRAINING_TYPES } from '../lib/trainingTypes';
import { dayFull, todayISO } from '../lib/date';
import { buildWeightChart } from '../lib/chart';
import type { DirectoryEntry } from '../hooks/useProfileDirectory';
import type { Fighter, Training, TrainingType, WeightEntry } from '../types/database';

interface Props {
  fighter: Fighter;
  profile: DirectoryEntry;
  isCoach: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function FighterProfileModal({ fighter, profile, isCoach, onClose, onChanged }: Props) {
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [upcoming, setUpcoming] = useState<Training[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<TrainingType, number>>({ kickboxing: 0, running: 0, swimming: 0, strength: 0, recovery: 0 });
  const [editing, setEditing] = useState(false);
  const [goalWeight, setGoalWeight] = useState(fighter.goal_weight_kg?.toString() ?? '');
  const [goalDeadline, setGoalDeadline] = useState(fighter.goal_deadline ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('weight_entries').select('*').eq('fighter_id', fighter.profile_id).order('entry_date').then(({ data }) => setHistory(data ?? []));

    supabase
      .from('training_attendees')
      .select('training_id')
      .eq('fighter_id', fighter.profile_id)
      .then(async ({ data }) => {
        const ids = (data ?? []).map((r) => r.training_id);
        if (ids.length === 0) return;
        const { data: trainingsData } = await supabase.from('trainings').select('*').in('id', ids);
        const trainings = (trainingsData ?? []) as Training[];
        const counts: Record<TrainingType, number> = { kickboxing: 0, running: 0, swimming: 0, strength: 0, recovery: 0 };
        const today = todayISO();
        const upcomingList: Training[] = [];
        for (const t of trainings) {
          counts[t.type]++;
          if (t.training_date >= today) upcomingList.push(t);
        }
        upcomingList.sort((a, b) => (a.training_date + a.start_time).localeCompare(b.training_date + b.start_time));
        setUpcoming(upcomingList);
        setTypeCounts(counts);
      });
  }, [fighter.profile_id]);

  const saveGoal = async () => {
    setSaving(true);
    await supabase
      .from('fighters')
      .update({ goal_weight_kg: goalWeight ? parseFloat(goalWeight) : null, goal_deadline: goalDeadline || null })
      .eq('profile_id', fighter.profile_id);
    setSaving(false);
    setEditing(false);
    onChanged();
  };

  const hasGoal = fighter.goal_weight_kg != null && fighter.goal_deadline;
  const chart = hasGoal && history.length > 0
    ? buildWeightChart(history.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), fighter.goal_weight_kg!, fighter.goal_deadline!, 480, 180)
    : null;
  const maxCount = Math.max(1, ...Object.values(typeCounts));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: profile.hueColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{profile.initials}</div>
            <div className="heading" style={{ fontSize: 26 }}>{profile.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>

        {editing ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 4 }}>Goal weight (kg)</div>
              <input className="input" type="number" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} style={{ width: 120 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 4 }}>Deadline</div>
              <input className="input" type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} style={{ width: 150 }} />
            </div>
            <button className="btn-primary" style={{ padding: '10px 16px' }} onClick={saveGoal} disabled={saving}>SAVE</button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--muted-2)', marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>Current: <strong style={{ color: 'var(--text)' }}>{history[history.length - 1]?.weight_kg ?? '—'} kg</strong></div>
            <div>Goal: <strong style={{ color: 'var(--text)' }}>{fighter.goal_weight_kg ?? 'not set'} kg</strong></div>
            <div>Deadline: {fighter.goal_deadline ?? 'not set'}</div>
            {isCoach && (
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setEditing(true)}>Edit goal</button>
            )}
          </div>
        )}

        {chart ? (
          <svg width="100%" height="180" viewBox="0 0 480 180">
            <line x1={chart.markerX} y1="0" x2={chart.markerX} y2="150" stroke="oklch(0.5 0.01 40)" strokeWidth="1" strokeDasharray="3 3" />
            <path d={chart.goalPath} stroke="oklch(0.5 0.01 40)" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
            <path d={chart.linePath} stroke="oklch(0.58 0.2 25)" strokeWidth="2.5" fill="none" />
            {chart.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="3" fill="oklch(0.58 0.2 25)" />)}
          </svg>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted-4)' }}>No goal/weight history yet to chart.</div>
        )}

        <div className="label" style={{ fontSize: 15, margin: '20px 0 10px 0' }}>UPCOMING TRAININGS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {upcoming.map((u) => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{u.title}</span>
              <span style={{ color: 'var(--muted-2)' }}>{dayFull(u.training_date)} · {u.start_time.slice(0, 5)}</span>
            </div>
          ))}
          {upcoming.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)' }}>No upcoming trainings.</div>}
        </div>

        <div className="label" style={{ fontSize: 15, marginBottom: 10 }}>TRAINING COUNT BY TYPE</div>
        {TRAINING_TYPES.map((key) => {
          const meta = TRAINING_TYPE_META[key];
          const count = typeCounts[key];
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 80, fontSize: 12, color: 'var(--muted-2)' }}>{meta.label}</div>
              <div style={{ flex: 1, height: 8, background: 'var(--track)' }}>
                <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: meta.color }} />
              </div>
              <div style={{ width: 16, fontSize: 12, textAlign: 'right' }}>{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
