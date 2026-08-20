import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { TRAINING_TYPE_META, TRAINING_TYPES } from '../lib/trainingTypes';
import { todayISO } from '../lib/date';
import { useAuth } from '../auth/AuthContext';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import type { TrainingType } from '../types/database';

interface Props {
  defaultDate: string;
  onClose: () => void;
  onCreated: () => void;
}

export function PlanTrainingModal({ defaultDate, onClose, onCreated }: Props) {
  useModalScrollLock();
  const { profile, fighter } = useAuth();
  const [type, setType] = useState<TrainingType>('kickboxing');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('18:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || !profile) return;
    setSubmitting(true);
    setError(null);

    const { data: training, error: insertError } = await supabase
      .from('trainings')
      .insert({
        type,
        title: title.trim(),
        training_date: date,
        start_time: time,
        location: location.trim() || 'TBD',
        notes: notes.trim(),
        created_by: profile.id,
      })
      .select()
      .single();

    if (insertError || !training) {
      setError(insertError?.message ?? 'Could not create training.');
      setSubmitting(false);
      return;
    }

    if (fighter) {
      await supabase.from('training_attendees').insert({ training_id: training.id, fighter_id: fighter.profile_id });
    }

    setSubmitting(false);
    onCreated();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="heading" style={{ fontSize: 24 }}>PLAN TRAINING</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted-3)', letterSpacing: '0.5px', marginBottom: 8 }}>TYPE</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {TRAINING_TYPES.map((key) => {
            const meta = TRAINING_TYPE_META[key];
            const active = type === key;
            return (
              <button
                key={key}
                onClick={() => setType(key)}
                style={{
                  padding: '8px 14px',
                  border: `1px solid ${meta.color}`,
                  background: active ? meta.color : 'transparent',
                  color: active ? 'oklch(0.98 0 0)' : meta.color,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {meta.abbr}
              </button>
            );
          })}
        </div>

        <input className="input" style={{ marginBottom: 12 }} placeholder="Training title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input" style={{ marginBottom: 12 }} type="date" value={date} onChange={(e) => setDate(e.target.value)} min={todayISO()} />
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <input className="input" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <textarea
          className="input"
          style={{ height: 70, marginBottom: 18, resize: 'none' }}
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" style={{ width: '100%' }} onClick={submit} disabled={submitting || !title.trim()}>
          {submitting ? 'PLANNING…' : 'PLAN TRAINING'}
        </button>
      </div>
    </div>
  );
}
