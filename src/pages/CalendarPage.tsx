import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useProfileDirectory } from '../hooks/useProfileDirectory';
import { useGalaDirectory } from '../hooks/useGalaDirectory';
import { TrainingDetailModal } from '../components/TrainingDetailModal';
import { PlanTrainingModal } from '../components/PlanTrainingModal';
import { GalaDetailModal } from '../components/GalaDetailModal';
import { TRAINING_TYPE_META, TRAINING_TYPES } from '../lib/trainingTypes';
import { GALA_COLOR } from '../lib/galas';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  todayISO, weekStart, weekDates, addDays, addMonths, addYears,
  dayLabel, dayFull, monthGridDates, monthLabel, shortMonthLabel, isSameMonth, monthStart, yearStart, yearEnd,
} from '../lib/date';
import type { Gala, Training, TrainingType } from '../types/database';

type ViewMode = 'week' | 'month' | 'year';

export function CalendarPage() {
  const { fighter, profile } = useAuth();
  const { directory } = useProfileDirectory();
  const { galas, refresh: refreshGalas } = useGalaDirectory();
  const isMobile = useIsMobile();

  const today = todayISO();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(today);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendees, setAttendees] = useState<Record<string, string[]>>({});
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [selectedGalaId, setSelectedGalaId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [filterProfileId, setFilterProfileId] = useState<string>('');

  const rangeStart = viewMode === 'week' ? weekStart(anchor) : viewMode === 'month' ? monthGridDates(anchor)[0] : yearStart(anchor);
  const rangeEnd = viewMode === 'week' ? weekDates(weekStart(anchor))[6] : viewMode === 'month' ? monthGridDates(anchor)[41] : yearEnd(anchor);

  const load = useCallback(async () => {
    const { data: rows } = await supabase.from('trainings').select('*').gte('training_date', rangeStart).lte('training_date', rangeEnd).order('start_time');
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
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedTraining = trainings.find((t) => t.id === selectedTrainingId) ?? null;
  const selectedGala = galas.find((g) => g.id === selectedGalaId) ?? null;

  const filteredTrainings = filterProfileId
    ? trainings.filter((t) => t.created_by === filterProfileId || (attendees[t.id] ?? []).includes(filterProfileId))
    : trainings;

  const goPrev = () => {
    if (viewMode === 'week') setAnchor(addDays(anchor, -7));
    else if (viewMode === 'month') setAnchor(addMonths(anchor, -1));
    else setAnchor(addYears(anchor, -1));
  };
  const goNext = () => {
    if (viewMode === 'week') setAnchor(addDays(anchor, 7));
    else if (viewMode === 'month') setAnchor(addMonths(anchor, 1));
    else setAnchor(addYears(anchor, 1));
  };
  const goToday = () => setAnchor(today);

  const jumpToWeek = (date: string) => {
    setAnchor(date);
    setViewMode('week');
  };
  const jumpToMonth = (date: string) => {
    setAnchor(date);
    setViewMode('month');
  };

  const headerLabel =
    viewMode === 'week' ? `${dayFull(rangeStart)} – ${dayFull(rangeEnd)}` :
    viewMode === 'month' ? monthLabel(anchor) :
    anchor.slice(0, 4);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <h1 className="heading" style={{ fontSize: 44, margin: 0 }}>CALENDAR</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--panel)', border: '1px solid var(--border)' }}>
            {(['week', 'month', 'year'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{ padding: '8px 14px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 12, background: viewMode === m ? 'var(--accent)' : 'transparent', color: viewMode === m ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn-secondary" onClick={goPrev}>‹ Prev</button>
          <div style={{ color: 'var(--muted-2)', fontSize: 14, minWidth: 160, textAlign: 'center' }}>{headerLabel}</div>
          <button className="btn-secondary" onClick={goNext}>Next ›</button>
          <button className="btn-secondary" onClick={goToday}>Today</button>
          <select
            className="input"
            style={{ width: 'auto', padding: '9px 10px', fontSize: 13 }}
            value={filterProfileId}
            onChange={(e) => setFilterProfileId(e.target.value)}
          >
            <option value="">All participants</option>
            {Object.values(directory).sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-2)' }}>
          <span style={{ width: 9, height: 9, background: GALA_COLOR, display: 'inline-block' }} />Gala
        </div>
      </div>

      {viewMode === 'week' && (
        <WeekView
          days={weekDates(rangeStart)}
          today={today}
          trainings={filteredTrainings}
          galas={galas}
          attendees={attendees}
          directory={directory}
          onSelectTraining={setSelectedTrainingId}
          onSelectGala={setSelectedGalaId}
        />
      )}
      {viewMode === 'month' && (
        <MonthView
          anchor={anchor}
          today={today}
          trainings={filteredTrainings}
          galas={galas}
          onSelectDay={jumpToWeek}
        />
      )}
      {viewMode === 'year' && (
        <YearView
          anchor={anchor}
          today={today}
          trainings={filteredTrainings}
          galas={galas}
          onSelectMonth={jumpToMonth}
          onSelectDay={jumpToWeek}
        />
      )}

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
          isCoach={profile?.role === 'coach'}
          onClose={() => setSelectedTrainingId(null)}
          onChanged={load}
        />
      )}

      {planOpen && (
        <PlanTrainingModal defaultDate={anchor >= today ? anchor : today} onClose={() => setPlanOpen(false)} onCreated={load} />
      )}

      {selectedGala && (
        <GalaDetailModal gala={selectedGala} directory={directory} onClose={() => setSelectedGalaId(null)} onGalaChanged={refreshGalas} />
      )}
    </div>
  );
}

interface WeekViewProps {
  days: string[];
  today: string;
  trainings: Training[];
  galas: Gala[];
  attendees: Record<string, string[]>;
  directory: ReturnType<typeof useProfileDirectory>['directory'];
  onSelectTraining: (id: string) => void;
  onSelectGala: (id: string) => void;
}

function WeekView({ days, today, trainings, galas, attendees, directory, onSelectTraining, onSelectGala }: WeekViewProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12, overflowX: 'auto' }}>
      {days.map((date) => {
        const isToday = date === today;
        const dayTrainings = trainings.filter((t) => t.training_date === date);
        const dayGalas = galas.filter((g) => g.event_date === date);
        return (
          <div key={date}>
            <div style={{ textAlign: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: `2px solid ${isToday ? 'var(--accent)' : 'var(--border)'}` }}>
              <div className="heading" style={{ fontSize: 13, color: isToday ? 'var(--accent)' : 'var(--muted-1)' }}>{dayLabel(date)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-3)' }}>{dayFull(date)}</div>
            </div>
            {dayGalas.map((g) => (
              <div
                key={g.id}
                onClick={() => onSelectGala(g.id)}
                style={{ background: GALA_COLOR, color: 'oklch(0.15 0.006 40)', padding: '10px', marginBottom: 8, cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', marginBottom: 2 }}>★ GALA</div>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{g.name}</div>
              </div>
            ))}
            {dayTrainings.map((t) => {
              const meta = TRAINING_TYPE_META[t.type];
              const cancelled = t.cancelled_at != null;
              const ids = (attendees[t.id] ?? []).slice(0, 2);
              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTraining(t.id)}
                  style={{ background: 'var(--card)', borderLeft: `3px solid ${cancelled ? 'var(--muted-4)' : meta.color}`, padding: '8px 10px', marginBottom: 8, cursor: 'pointer', opacity: cancelled ? 0.6 : 1 }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', color: cancelled ? 'var(--muted-3)' : meta.color, marginBottom: 4 }}>
                    {meta.abbr}{cancelled ? ' · CANCELLED' : ''}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, textDecoration: cancelled ? 'line-through' : 'none' }}>{t.title}</div>
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
            {dayTrainings.length === 0 && dayGalas.length === 0 && (
              <div style={{ border: '1px dashed var(--border)', padding: '14px 8px', textAlign: 'center', fontSize: 11, color: 'var(--muted-4)' }}>No trainings</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface MonthViewProps {
  anchor: string;
  today: string;
  trainings: Training[];
  galas: Gala[];
  onSelectDay: (date: string) => void;
}

function MonthView({ anchor, today, trainings, galas, onSelectDay }: MonthViewProps) {
  const dates = monthGridDates(anchor);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
      {dates.map((date) => {
        const inMonth = isSameMonth(date, monthStart(anchor));
        const isToday = date === today;
        const dayTrainings = trainings.filter((t) => t.training_date === date);
        const dayGalas = galas.filter((g) => g.event_date === date);
        const activeTypes = Array.from(new Set(dayTrainings.filter((t) => !t.cancelled_at).map((t) => t.type))).slice(0, 4);
        const hasCancelled = dayTrainings.some((t) => t.cancelled_at != null);
        return (
          <div
            key={date}
            onClick={() => onSelectDay(date)}
            className="card"
            style={{
              padding: 8,
              minHeight: 74,
              cursor: 'pointer',
              opacity: inMonth ? 1 : 0.35,
              borderColor: isToday ? 'var(--accent)' : 'var(--border)',
              borderWidth: isToday ? 2 : 1,
            }}
          >
            <div style={{ fontSize: 12, color: isToday ? 'var(--accent)' : 'var(--muted-2)', fontWeight: isToday ? 700 : 400, marginBottom: 6 }}>
              {Number(date.slice(8, 10))}
            </div>
            {dayGalas.length > 0 && (
              <div style={{ fontSize: 9, fontWeight: 700, color: GALA_COLOR, marginBottom: 3 }}>★ {dayGalas[0].name}</div>
            )}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              {activeTypes.map((type) => (
                <span key={type} style={{ width: 6, height: 6, borderRadius: '50%', background: TRAINING_TYPE_META[type as TrainingType].color, display: 'inline-block' }} />
              ))}
              {hasCancelled && <span style={{ fontSize: 8, color: 'var(--muted-4)', textDecoration: 'line-through' }}>cancelled</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface YearViewProps {
  anchor: string;
  today: string;
  trainings: Training[];
  galas: Gala[];
  onSelectMonth: (date: string) => void;
  onSelectDay: (date: string) => void;
}

function YearView({ anchor, today, trainings, galas, onSelectMonth, onSelectDay }: YearViewProps) {
  const yearStartDate = yearStart(anchor);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStartDate, i));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
      {months.map((monthAnchor) => {
        const dates = monthGridDates(monthAnchor);
        return (
          <div key={monthAnchor} className="card" style={{ padding: 14 }}>
            <div className="label" onClick={() => onSelectMonth(monthAnchor)} style={{ fontSize: 14, marginBottom: 8, cursor: 'pointer' }}>
              {shortMonthLabel(monthAnchor)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {dates.map((date) => {
                const inMonth = isSameMonth(date, monthAnchor);
                const isToday = date === today;
                const hasGala = galas.some((g) => g.event_date === date);
                const hasTraining = trainings.some((t) => t.training_date === date);
                return (
                  <div
                    key={date}
                    onClick={(e) => { e.stopPropagation(); onSelectDay(date); }}
                    title={date}
                    style={{
                      aspectRatio: '1',
                      cursor: inMonth ? 'pointer' : 'default',
                      opacity: inMonth ? 1 : 0.25,
                      background: hasGala ? GALA_COLOR : 'transparent',
                      border: isToday ? '1px solid var(--accent)' : hasTraining ? '1px solid var(--muted-3)' : '1px solid transparent',
                      borderRadius: 2,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
