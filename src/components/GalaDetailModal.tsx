import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { PARTICIPATION_META, PARTICIPATION_TYPES } from '../lib/galas';
import { dayFull } from '../lib/date';
import { CreateGalaModal } from './CreateGalaModal';
import type { DirectoryEntry } from '../hooks/useProfileDirectory';
import type { Gala, GalaParticipant, GalaParticipationType, Goal } from '../types/database';

interface Props {
  gala: Gala;
  directory: Record<string, DirectoryEntry>;
  onClose: () => void;
  onGalaChanged: () => void;
}

export function GalaDetailModal({ gala, directory, onClose, onGalaChanged }: Props) {
  const { profile, fighter } = useAuth();
  const [participants, setParticipants] = useState<GalaParticipant[]>([]);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [goalWeightInput, setGoalWeightInput] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('gala_participants').select('*').eq('gala_id', gala.id);
    setParticipants((data ?? []) as GalaParticipant[]);

    if (fighter) {
      const { data: goal } = await supabase.from('goals').select('*').eq('fighter_id', fighter.profile_id).eq('status', 'active').maybeSingle();
      const g = (goal as Goal) ?? null;
      setActiveGoal(g);
      setGoalWeightInput(g?.target_weight_kg.toString() ?? '');
    }

    setLoading(false);
  }, [gala.id, fighter]);

  useEffect(() => {
    load();
  }, [load]);

  const myParticipation = participants.find((p) => p.profile_id === profile?.id) ?? null;
  const isCoach = profile?.role === 'coach';

  const setParticipation = async (type: GalaParticipationType) => {
    if (!profile) return;
    if (myParticipation?.participation_type === type) {
      await supabase.from('gala_participants').delete().eq('gala_id', gala.id).eq('profile_id', profile.id);
    } else {
      await supabase.from('gala_participants').upsert(
        { gala_id: gala.id, profile_id: profile.id, participation_type: type },
        { onConflict: 'gala_id,profile_id' },
      );
    }
    await load();
  };

  const confirmFightingGoal = async () => {
    if (!fighter || !profile || !goalWeightInput) return;
    setSavingGoal(true);
    if (activeGoal) {
      await supabase.from('goals').update({ target_weight_kg: parseFloat(goalWeightInput), gala_id: gala.id, deadline: null }).eq('id', activeGoal.id);
    } else {
      await supabase.from('goals').insert({ fighter_id: fighter.profile_id, target_weight_kg: parseFloat(goalWeightInput), gala_id: gala.id, created_by: profile.id });
    }
    setSavingGoal(false);
    await load();
  };

  const grouped: Record<GalaParticipationType, GalaParticipant[]> = { attending: [], attending_vip: [], fighting: [], cornering: [] };
  for (const p of participants) grouped[p.participation_type].push(p);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div className="heading" style={{ fontSize: 28 }}>{gala.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted-1)', marginTop: 6 }}>{dayFull(gala.event_date)} · {gala.location || 'Location TBD'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCoach && (
              <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => setEditOpen(true)}>Edit</button>
            )}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
          </div>
        </div>

        {gala.poster_url && (
          <div style={{ marginBottom: 14 }}>
            <a href={gala.poster_url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>View poster</a>
          </div>
        )}
        {gala.notes && <div style={{ fontSize: 14, color: 'oklch(0.85 0.005 40)', lineHeight: 1.5, marginBottom: 20 }}>{gala.notes}</div>}

        <div className="label" style={{ fontSize: 14, marginBottom: 10 }}>YOUR PARTICIPATION</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {PARTICIPATION_TYPES.map((type) => {
            const meta = PARTICIPATION_META[type];
            const active = myParticipation?.participation_type === type;
            return (
              <button
                key={type}
                onClick={() => setParticipation(type)}
                style={{ padding: '8px 14px', border: `1px solid ${meta.color}`, background: active ? meta.color : 'transparent', color: active ? 'oklch(0.98 0 0)' : meta.color, fontSize: 12, fontWeight: 700 }}
              >
                {meta.label.toUpperCase()}{active ? ' ✕' : ''}
              </button>
            );
          })}
        </div>
        {myParticipation && <div style={{ fontSize: 11, color: 'var(--muted-4)', marginBottom: 20 }}>Click your selection again to remove it.</div>}

        {myParticipation?.participation_type === 'fighting' && fighter && (
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--muted-1)', marginBottom: 10 }}>
              {activeGoal?.gala_id === gala.id
                ? `Goal weight confirmed for this fight: ${activeGoal.target_weight_kg} kg · deadline is this gala's date.`
                : 'Set your goal weight for this fight — the deadline will be this gala\'s date.'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" type="number" placeholder="Goal weight (kg)" value={goalWeightInput} onChange={(e) => setGoalWeightInput(e.target.value)} style={{ width: 160 }} />
              <button className="btn-primary" style={{ padding: '10px 16px' }} onClick={confirmFightingGoal} disabled={savingGoal || !goalWeightInput}>
                {activeGoal?.gala_id === gala.id ? 'UPDATE' : 'CONFIRM'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--muted-2)', fontSize: 13 }}>Loading attendees…</div>
        ) : (
          PARTICIPATION_TYPES.map((type) => {
            const list = grouped[type];
            if (list.length === 0) return null;
            const meta = PARTICIPATION_META[type];
            return (
              <div key={type} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: meta.color, marginBottom: 8 }}>{meta.label.toUpperCase()} ({list.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map((p) => {
                    const d = directory[p.profile_id];
                    if (!d) return null;
                    return (
                      <div key={p.profile_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: d.hueColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{d.initials}</div>
                        <span style={{ fontSize: 13 }}>{d.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        {!loading && participants.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)' }}>No one has declared participation yet.</div>}
      </div>

      {editOpen && (
        <CreateGalaModal editing={gala} onClose={() => setEditOpen(false)} onSaved={onGalaChanged} />
      )}
    </div>
  );
}
