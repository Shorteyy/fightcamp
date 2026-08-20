import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { todayISO } from '../lib/date';
import type { Gala } from '../types/database';

interface Props {
  editing?: Gala | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CreateGalaModal({ editing, onClose, onSaved }: Props) {
  useModalScrollLock();
  const { profile } = useAuth();
  const [name, setName] = useState(editing?.name ?? '');
  const [date, setDate] = useState(editing?.event_date ?? todayISO());
  const [location, setLocation] = useState(editing?.location ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [posterUrl, setPosterUrl] = useState(editing?.poster_url ?? '');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(editing?.poster_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickFile = (file: File | null) => {
    setPosterFile(file);
    setPosterPreview(file ? URL.createObjectURL(file) : posterUrl || null);
  };

  const removeImage = () => {
    setPosterFile(null);
    setPosterUrl('');
    setPosterPreview(null);
  };

  const submit = async () => {
    if (!name.trim() || !profile) return;
    setSubmitting(true);
    setError(null);

    let finalPosterUrl = posterUrl.trim() || null;

    if (posterFile) {
      setUploading(true);
      const ext = posterFile.name.split('.').pop() || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('gala-images').upload(path, posterFile);
      setUploading(false);
      if (uploadError) {
        setError(uploadError.message);
        setSubmitting(false);
        return;
      }
      finalPosterUrl = supabase.storage.from('gala-images').getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      name: name.trim(),
      event_date: date,
      location: location.trim(),
      notes: notes.trim(),
      poster_url: finalPosterUrl,
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

        <div style={{ fontSize: 12, color: 'var(--muted-3)', letterSpacing: '0.5px', marginBottom: 8 }}>POSTER IMAGE (OPTIONAL)</div>
        {posterPreview && (
          <div style={{ position: 'relative', marginBottom: 10, height: 120, borderRadius: 4, overflow: 'hidden', background: 'var(--card)' }}>
            <img src={posterPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              onClick={removeImage}
              style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 3, padding: '2px 8px', fontSize: 11 }}
            >
              Remove
            </button>
          </div>
        )}
        <input
          className="input"
          style={{ marginBottom: 18 }}
          type="file"
          accept="image/*"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />

        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" style={{ width: '100%' }} onClick={submit} disabled={submitting || !name.trim()}>
          {uploading ? 'UPLOADING…' : submitting ? 'SAVING…' : editing ? 'SAVE CHANGES' : 'CREATE GALA'}
        </button>
      </div>
    </div>
  );
}
