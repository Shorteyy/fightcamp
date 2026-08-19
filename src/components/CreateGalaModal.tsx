import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { todayISO } from '../lib/date';
import type { Gala } from '../types/database';

interface Props {
  editing?: Gala | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CreateGalaModal({ editing, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const [name, setName] = useState(editing?.name ?? '');
  const [date, setDate] = useState(editing?.event_date ?? todayISO());
  const [location, setLocation] = useState(editing?.location ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [posterUrl, setPosterUrl] = useState(editing?.poster_url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || !profile) return;
    setSubmitting(true);
    setError(null);

    const payload = {
      name: name.trim(),
      event_date: date,
      location: location.trim(),
      notes: notes.trim(),
      poster_url: posterUrl.trim() || null,
    };

    const { error: saveError } = editing
      ? await supabase.from('galas').update(payload).eq('id', editing.id)
      : await supabase.from('galas').insert({ ...payload, created_by: profile.id });

    if (saveError) {
      setError(saveError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="heading" style={{ fontSize: 24 }}>{editing ? 'EDIT GALA' : 'CREATE GALA'}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>

        <input className="input" style={{ marginBottom: 12 }} placeholder="Gala name" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="input" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <textarea
          className="input"
          style={{ height: 70, marginBottom: 12, resize: 'none' }}
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <input className="input" style={{ marginBottom: 18 }} placeholder="Poster URL (optional)" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} />
        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" style={{ width: '100%' }} onClick={submit} disabled={submitting || !name.trim()}>
          {submitting ? 'SAVING…' : editing ? 'SAVE CHANGES' : 'CREATE GALA'}
        </button>
      </div>
    </div>
  );
}
