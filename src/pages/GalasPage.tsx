import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useProfileDirectory } from '../hooks/useProfileDirectory';
import { useGalaDirectory } from '../hooks/useGalaDirectory';
import { CreateGalaModal } from '../components/CreateGalaModal';
import { GalaDetailModal } from '../components/GalaDetailModal';
import { GALA_COLOR } from '../lib/galas';
import { dayFull, todayISO } from '../lib/date';

export function GalasPage() {
  const { profile } = useAuth();
  const { directory } = useProfileDirectory();
  const { galas, loading, refresh } = useGalaDirectory();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = todayISO();
  const isCoach = profile?.role === 'coach';
  const upcoming = galas.filter((g) => g.event_date >= today);
  const past = [...galas.filter((g) => g.event_date < today)].reverse();
  const shown = tab === 'upcoming' ? upcoming : past;
  const selected = galas.find((g) => g.id === selectedId) ?? null;

  if (loading) return <div style={{ color: 'var(--muted-2)' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="heading" style={{ fontSize: 44, margin: 0 }}>GALAS</h1>
        <div style={{ display: 'flex', gap: 2, background: 'var(--panel)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setTab('upcoming')}
            style={{ padding: '10px 18px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, background: tab === 'upcoming' ? 'var(--accent)' : 'transparent', color: tab === 'upcoming' ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
          >
            UPCOMING
          </button>
          <button
            onClick={() => setTab('past')}
            style={{ padding: '10px 18px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, background: tab === 'past' ? 'var(--accent)' : 'transparent', color: tab === 'past' ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
          >
            PAST
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }}>
        {shown.map((g) => (
          <div key={g.id} onClick={() => setSelectedId(g.id)} className="card" style={{ borderTop: `4px solid ${GALA_COLOR}`, padding: 20, cursor: 'pointer' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: GALA_COLOR, marginBottom: 8 }}>★ GALA</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{g.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>{dayFull(g.event_date)}</div>
            <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>{g.location || 'Location TBD'}</div>
          </div>
        ))}
        {isCoach && tab === 'upcoming' && (
          <div
            onClick={() => setCreateOpen(true)}
            style={{ border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 130, cursor: 'pointer', color: 'var(--muted-3)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1 }}
          >
            + CREATE GALA
          </div>
        )}
        {shown.length === 0 && !isCoach && (
          <div style={{ color: 'var(--muted-3)', fontSize: 13 }}>No {tab} galas.</div>
        )}
      </div>

      {createOpen && <CreateGalaModal onClose={() => setCreateOpen(false)} onSaved={refresh} />}
      {selected && (
        <GalaDetailModal gala={selected} directory={directory} onClose={() => setSelectedId(null)} onGalaChanged={refresh} />
      )}
    </div>
  );
}
