import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { TRAINING_TYPE_META } from '../lib/trainingTypes';
import { dayFull } from '../lib/date';
import type { Training } from '../types/database';
import type { DirectoryEntry } from '../hooks/useProfileDirectory';

interface Props {
  training: Training;
  attendeeIds: string[];
  directory: Record<string, DirectoryEntry>;
  currentFighterId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export function TrainingDetailModal({ training, attendeeIds, directory, currentFighterId, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const meta = TRAINING_TYPE_META[training.type];
  const joined = currentFighterId ? attendeeIds.includes(currentFighterId) : false;

  const join = async () => {
    if (!currentFighterId) return;
    setBusy(true);
    await supabase.from('training_attendees').insert({ training_id: training.id, fighter_id: currentFighterId });
    setBusy(false);
    onChanged();
  };

  const leave = async () => {
    if (!currentFighterId) return;
    setBusy(true);
    await supabase.from('training_attendees').delete().eq('training_id', training.id).eq('fighter_id', currentFighterId);
    setBusy(false);
    onChanged();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ borderTop: `4px solid ${meta.color}`, width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: meta.color, marginBottom: 6 }}>{meta.abbr}</div>
            <div className="heading" style={{ fontSize: 26 }}>{training.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted-1)', marginBottom: 16 }}>
          {dayFull(training.training_date)} · {training.start_time.slice(0, 5)} · {training.location}
        </div>
        {training.notes && <div style={{ fontSize: 14, color: 'oklch(0.85 0.005 40)', lineHeight: 1.5, marginBottom: 20 }}>{training.notes}</div>}
        <div className="label" style={{ fontSize: 14, marginBottom: 10 }}>ATTENDEES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {attendeeIds.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)' }}>No one has joined yet.</div>}
          {attendeeIds.map((id) => {
            const d = directory[id];
            if (!d) return null;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: d.hueColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{d.initials}</div>
                <span style={{ fontSize: 13 }}>{d.name}</span>
              </div>
            );
          })}
        </div>
        {currentFighterId && (
          joined ? (
            <button className="btn-secondary" style={{ width: '100%', padding: 14 }} onClick={leave} disabled={busy}>LEAVE TRAINING</button>
          ) : (
            <button className="btn-primary" style={{ width: '100%' }} onClick={join} disabled={busy}>JOIN TRAINING</button>
          )
        )}
      </div>
    </div>
  );
}
