import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { TRAINING_TYPE_META, TRAINING_TYPES } from '../lib/trainingTypes';
import { dayFull, todayISO } from '../lib/date';
import { buildWeightChart } from '../lib/chart';
import { effectiveDeadline, linkedGala } from '../lib/goals';
import { useGalaDirectory } from '../hooks/useGalaDirectory';
import type { DirectoryEntry } from '../hooks/useProfileDirectory';
import type { Fighter, Goal, Training, TrainingType, WeightEntry } from '../types/database';

interface Props {
  fighter: Fighter;
  profile: DirectoryEntry;
  isCoach: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function FighterProfileModal({ fighter, profile, isCoach, onClose, onChanged }: Props) {
  const { profile: myProfile } = useAuth();
  const { galasById } = useGalaDirectory();
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [upcoming, setUpcoming] = useState<Training[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<TrainingType, number>>({ kickboxing: 0, running: 0, swimming: 0, strength: 0, recovery: 0 });
  const [editing, setEditing] = useState(false);
  const [goalWeight, setGoalWeight] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('weight_entries').select('*').eq('fighter_id', fighter.profile_id).order('entry_date').then(({ data }) => setHistory(data ?? []));

    supabase.from('goals').select('*').eq('fighter_id', fighter.profile_id).eq('status', 'active').maybeSingle().then(({ data }) => {
      const goal = (data as Goal) ?? null;
      setActiveGoal(goal);
      setGoalWeight(goal?.target_weight_kg.toString() ?? '');
      setGoalDeadline(goal?.deadline ?? '');
    });

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
          if (!t.cancelled_at) counts[t.type]++;
          if (t.training_date >= today) upcomingList.push(t);
        }
        upcomingList.sort((a, b) => (a.training_date + a.start_time).localeCompare(b.training_date + b.start_time));
        setUpcoming(upcomingList);
        setTypeCounts(counts);
      });
  }, [fighter.profile_id]);

  const saveGoal = async () => {
    if (!goalWeight || !myProfile) return;
    setSaving(true);
    // A manually-entered deadline always overrides/clears any gala link (same rule as the Weight page).
    if (activeGoal) {
      await supabase.from('goals').update({ target_weight_kg: parseFloat(goalWeight), deadline: goalDeadline || null, gala_id: null }).eq('id', activeGoal.id);
    } else {
      await supabase.from('goals').insert({ fighter_id: fighter.profile_id, target_weight_kg: parseFloat(goalWeight), deadline: goalDeadline || null, created_by: myProfile.id });
    }
    setSaving(false);
    setEditing(false);
    onChanged();
  };

  const toggleRole = async () => {
    setRoleBusy(true);
    setRoleError(null);
    const nextRole = profile.role === 'coach' ? 'fighter' : 'coach';
    const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', fighter.profile_id);
    setRoleBusy(false);
    if (error) {
      setRoleError(error.message.includes('last coach') ? 'Cannot demote the last coach — promote someone else first.' : error.message);
      return;
    }
    onChanged();
  };

  const deleteMember = async () => {
    if (!confirm(`Permanently delete ${profile.name}? Their login, weight history, goals, nutrition log, and meal plans are gone for good. Trainings/galas they created stay (marked "Removed user"). This cannot be undone.`)) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId: fighter.profile_id } });
    setDeleteBusy(false);
    if (error || data?.error) {
      setDeleteError(data?.error ?? error?.message ?? 'Could not delete this member.');
      return;
    }
    onChanged();
    onClose();
  };

  const deadline = activeGoal ? effectiveDeadline(activeGoal, galasById) : null;
  const gala = activeGoal ? linkedGala(activeGoal, galasById) : null;
  const hasGoal = activeGoal != null && deadline != null;
  const chart = hasGoal && history.length > 0
    ? buildWeightChart(history.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), activeGoal!.target_weight_kg, deadline!, 480, 180)
    : null;
  const maxCount = Math.max(1, ...Object.values(typeCounts));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: profile.hueColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{profile.initials}</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="heading" style={{ fontSize: 26 }}>{profile.name}</div>
                {profile.role === 'coach' && (
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 3, padding: '1px 6px' }}>COACH</span>
                )}
              </div>
              {isCoach && (
                <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 10, marginTop: 4 }} onClick={toggleRole} disabled={roleBusy}>
                  {roleBusy ? '…' : profile.role === 'coach' ? 'Demote to fighter' : 'Promote to coach'}
                </button>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>
        {roleError && <div className="error-text" style={{ marginBottom: 16 }}>{roleError}</div>}

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
            <div>Goal: <strong style={{ color: 'var(--text)' }}>{activeGoal?.target_weight_kg ?? 'not set'} kg</strong></div>
            <div>Deadline: {deadline ?? 'not set'}{gala ? ` (${gala.name})` : ''}</div>
            {isCoach && (
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setEditing(true)}>Edit goal</button>
            )}
          </div>
        )}

        {chart ? (
          <svg width="100%" height="180" viewBox="0 0 480 180">
            {chart.yTicks.map((t, i) => (
              <g key={i}>
                <line x1={38} y1={t.pos} x2={470} y2={t.pos} stroke="oklch(0.28 0.012 40)" strokeWidth="1" />
                <text x={34} y={t.pos + 3} fontSize="9" fill="oklch(0.55 0.01 40)" textAnchor="end">{t.label}</text>
              </g>
            ))}
            <line x1={chart.markerX} y1="0" x2={chart.markerX} y2="150" stroke="oklch(0.5 0.01 40)" strokeWidth="1" strokeDasharray="3 3" />
            <path d={chart.goalPath} stroke="oklch(0.5 0.01 40)" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
            <path d={chart.linePath} stroke="oklch(0.58 0.2 25)" strokeWidth="2.5" fill="none" />
            {chart.dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r="3" fill="oklch(0.58 0.2 25)">
                <title>{d.date}: {d.weight} kg</title>
              </circle>
            ))}
          </svg>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted-4)' }}>No goal/weight history yet to chart.</div>
        )}

        <div className="label" style={{ fontSize: 15, margin: '20px 0 10px 0' }}>UPCOMING TRAININGS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {upcoming.map((u) => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)', opacity: u.cancelled_at ? 0.6 : 1 }}>
              <span style={{ textDecoration: u.cancelled_at ? 'line-through' : 'none' }}>{u.title}{u.cancelled_at ? ' (cancelled)' : ''}</span>
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

        {isCoach && (
          <>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16 }}>
              {deleteError && <div className="error-text" style={{ marginBottom: 10 }}>{deleteError}</div>}
              <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12, color: 'var(--accent)' }} onClick={deleteMember} disabled={deleteBusy}>
                {deleteBusy ? 'DELETING…' : 'DELETE MEMBER'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
