import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useProfileDirectory } from '../hooks/useProfileDirectory';
import { TrainingDetailModal } from '../components/TrainingDetailModal';
import { PlanTrainingModal } from '../components/PlanTrainingModal';
import { TRAINING_TYPE_META, TRAINING_TYPES } from '../lib/trainingTypes';
import { useIsMobile } from '../hooks/useIsMobile';
import { todayISO, weekStart, weekDates, addDays, dayLabel, dayFull } from '../lib/date';
import type { Training } from '../types/database';

export function CalendarPage() {
  const { fighter } = useAuth();
  const { directory } = useProfileDirectory();
  const isMobile = useIsMobile();

  const today = todayISO();
  const [start, setStart] = useState(weekStart(today));
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendees, setAttendees] = useState<Record<string, string[]>>({});
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const days = weekDates(start);
  const end = days[6];

  const load = useCallback(async () => {
    const { data: rows } = await supabase.from('trainings').select('*').gte('training_date', start).lte('training_date', end).order('start_time');
    setTrainings(rows ?? []);
    const ids = (rows ?? []).map((t) => t.id);
    if (ids.length > 0) {
      const { data: att } = await supabase.from('training_attendees').select('training_id, fighter_id').in('training_id', ids);
      const map: Record<string, string[]> = {};
      for (const row of att ?? []) map[row.training_id] = [...(map[row.training_id] ?? []), row.fighter_id];
      setAttendees(map);
    } else {
      setAttendees({});
    }
  }, [start, end]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedTraining = trainings.find((t) => t.id === selectedTrainingId) ?? null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <h1 className="heading" style={{ fontSize: 44, margin: 0 }}>CALENDAR</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-secondary" onClick={() => setStart(addDays(start, -7))}>‹ Prev</button>
          <div style={{ color: 'var(--muted-2)', fontSize: 14 }}>{dayFull(start)} – {dayFull(end)}</div>
          <button className="btn-secondary" onClick={() => setStart(addDays(start, 7))}>Next ›</button>
          <button className="btn-secondary" onClick={() => setStart(weekStart(today))}>Today</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 28 }}>
        {TRAINING_TYPES.map((key) => {
          const meta = TRAINING_TYPE_META[key];
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-2)' }}>
              <span style={{ width: 9, height: 9, background: meta.color, display: 'inline-block' }} />{meta.label}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12, overflowX: 'auto' }}>
        {days.map((date) => {
          const isToday = date === today;
          const dayTrainings = trainings.filter((t) => t.training_date === date);
          return (
            <div key={date}>
              <div style={{ textAlign: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: `2px solid ${isToday ? 'var(--accent)' : 'var(--border)'}` }}>
                <div className="heading" style={{ fontSize: 13, color: isToday ? 'var(--accent)' : 'var(--muted-1)' }}>{dayLabel(date)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-3)' }}>{dayFull(date)}</div>
              </div>
              {dayTrainings.map((t) => {
                const meta = TRAINING_TYPE_META[t.type];
                const ids = (attendees[t.id] ?? []).slice(0, 2);
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTrainingId(t.id)}
                    style={{ background: 'var(--card)', borderLeft: `3px solid ${meta.color}`, padding: '8px 10px', marginBottom: 8, cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', color: meta.color, marginBottom: 4 }}>{meta.abbr}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 6 }}>{t.start_time.slice(0, 5)}</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {ids.map((id) => {
                        const d = directory[id];
                        if (!d) return null;
                        return (
                          <div key={id} style={{ width: 16, height: 16, borderRadius: '50%', background: d.hueColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700 }}>
                            {d.initials}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {dayTrainings.length === 0 && (
                <div style={{ border: '1px dashed var(--border)', padding: '14px 8px', textAlign: 'center', fontSize: 11, color: 'var(--muted-4)' }}>No trainings</div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setPlanOpen(true)}
        className="btn-primary"
        style={{
          position: 'fixed',
          bottom: isMobile ? 80 : 36,
          right: isMobile ? 20 : 40,
          padding: isMobile ? '14px 20px' : '16px 26px',
          fontSize: isMobile ? 14 : 16,
          boxShadow: '0 8px 24px oklch(0.58 0.2 25 / 0.3)',
        }}
      >
        {isMobile ? '+ PLAN' : '+ PLAN TRAINING'}
      </button>

      {selectedTraining && (
        <TrainingDetailModal
          training={selectedTraining}
          attendeeIds={attendees[selectedTraining.id] ?? []}
          directory={directory}
          currentFighterId={fighter?.profile_id ?? null}
          onClose={() => setSelectedTrainingId(null)}
          onChanged={load}
        />
      )}

      {planOpen && (
        <PlanTrainingModal defaultDate={today} onClose={() => setPlanOpen(false)} onCreated={load} />
      )}
    </div>
  );
}
