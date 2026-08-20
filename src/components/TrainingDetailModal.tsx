import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { TRAINING_TYPE_META } from '../lib/trainingTypes';
import { dayFull } from '../lib/date';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from './PaginationControls';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import type { Training } from '../types/database';
import type { DirectoryEntry } from '../hooks/useProfileDirectory';

interface Props {
  training: Training;
  attendeeIds: string[];
  directory: Record<string, DirectoryEntry>;
  currentFighterId: string | null;
  isCoach: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function TrainingDetailModal({ training, attendeeIds, directory, currentFighterId, isCoach, onClose, onChanged }: Props) {
  useModalScrollLock();
  const [busy, setBusy] = useState(false);
  const meta = TRAINING_TYPE_META[training.type];
  const cancelled = training.cancelled_at != null;
  const joined = currentFighterId ? attendeeIds.includes(currentFighterId) : false;
  const canManage = isCoach || training.created_by === currentFighterId;
  const { pageItems, page, totalPages, setPage } = usePagination(attendeeIds);

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

  const toggleCancel = async () => {
    setBusy(true);
    await supabase.from('trainings').update({ cancelled_at: cancelled ? null : new Date().toISOString() }).eq('id', training.id);
    setBusy(false);
    onChanged();
  };

  const deleteTraining = async () => {
    if (!confirm(`Delete "${training.title}"? This cannot be undone — attendee records go with it.`)) return;
    setBusy(true);
    await supabase.from('trainings').delete().eq('id', training.id);
    setBusy(false);
    onChanged();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ borderTop: `4px solid ${cancelled ? 'var(--muted-4)' : meta.color}`, width: 480, opacity: cancelled ? 0.85 : 1 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: cancelled ? 'var(--muted-3)' : meta.color, marginBottom: 6 }}>{meta.abbr}</div>
            <div className="heading" style={{ fontSize: 26, textDecoration: cancelled ? 'line-through' : 'none', color: cancelled ? 'var(--muted-2)' : 'var(--text)' }}>{training.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>
        {cancelled && (
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 3, padding: '2px 8px', marginBottom: 14 }}>
            CANCELLED
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--muted-1)', marginBottom: 16 }}>
          {dayFull(training.training_date)} · {training.start_time.slice(0, 5)} · {training.location}
        </div>
        {training.notes && <div style={{ fontSize: 14, color: 'oklch(0.85 0.005 40)', lineHeight: 1.5, marginBottom: 20 }}>{training.notes}</div>}
        <div className="label" style={{ fontSize: 14, marginBottom: 10 }}>ATTENDEES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          {attendeeIds.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)' }}>No one has joined yet.</div>}
          {pageItems.map((id) => {
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
        <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
        <div style={{ marginBottom: 16 }} />
        {!cancelled && currentFighterId && (
          joined ? (
            <button className="btn-secondary" style={{ width: '100%', padding: 14 }} onClick={leave} disabled={busy}>LEAVE TRAINING</button>
          ) : (
            <button className="btn-primary" style={{ width: '100%' }} onClick={join} disabled={busy}>JOIN TRAINING</button>
          )
        )}
        {canManage && (
          <div style={{ display: 'flex', gap: 10, marginTop: currentFighterId && !cancelled ? 10 : 0 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 12 }} onClick={toggleCancel} disabled={busy}>
              {cancelled ? 'UN-CANCEL' : 'CANCEL TRAINING'}
            </button>
            <button className="btn-secondary" style={{ flex: 1, padding: 12, color: 'var(--accent)' }} onClick={deleteTraining} disabled={busy}>
              DELETE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
