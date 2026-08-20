import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from '../components/PaginationControls';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { MEAL_GROUPS, MEAL_GROUP_META } from '../lib/trainingTypes';
import type { MealEntry } from '../types/database';

const MACRO_LABELS: { key: 'protein' | 'carbs' | 'fat'; label: string; target: number }[] = [
  { key: 'protein', label: 'PROTEIN', target: 180 },
  { key: 'carbs', label: 'CARBS', target: 260 },
  { key: 'fat', label: 'FAT', target: 70 },
];

interface Props {
  fighterId: string;
  dailyCalorieTarget: number;
}

// Reused for both a fighter's own "History" tab and a coach drilling into
// a follower's log — same day-by-day totals + expandable detail, driven by
// whichever fighterId is passed in. RLS (self-or-coach) governs access.
export function NutritionHistoryPanel({ fighterId, dailyCalorieTarget }: Props) {
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from('meal_entries').select('*').eq('fighter_id', fighterId).order('entry_date', { ascending: false }).then(({ data }) => {
      setEntries((data ?? []) as MealEntry[]);
      setLoading(false);
    });
  }, [fighterId]);

  const dailyTotals = Array.from(new Set(entries.map((e) => e.entry_date))).map((date) => {
    const dayEntries = entries.filter((e) => e.entry_date === date);
    return {
      date,
      calories: dayEntries.reduce((a, e) => a + e.calories, 0),
      protein: dayEntries.reduce((a, e) => a + e.protein_g, 0),
      carbs: dayEntries.reduce((a, e) => a + e.carbs_g, 0),
      fat: dayEntries.reduce((a, e) => a + e.fat_g, 0),
    };
  });
  const pagination = usePagination(dailyTotals);
  const selectedEntries = selectedDate ? entries.filter((e) => e.entry_date === selectedDate) : [];

  useModalScrollLock(selectedDate != null);

  if (loading) return <div style={{ color: 'var(--muted-2)', fontSize: 13 }}>Loading…</div>;

  return (
    <div>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1fr 1fr', gap: 8, fontSize: 11, color: 'var(--muted-3)', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
          <div>DATE</div>
          <div>CALORIES</div>
          {MACRO_LABELS.map((m) => <div key={m.key}>{m.label}</div>)}
        </div>
        {pagination.pageItems.map((d) => (
          <div
            key={d.date}
            onClick={() => setSelectedDate(d.date)}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1fr 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}
          >
            <div>{d.date}</div>
            <div style={{ fontWeight: 600 }}>{d.calories} / {dailyCalorieTarget} kcal</div>
            <div style={{ color: 'var(--muted-2)' }}>{d.protein}g / {MACRO_LABELS[0].target}g</div>
            <div style={{ color: 'var(--muted-2)' }}>{d.carbs}g / {MACRO_LABELS[1].target}g</div>
            <div style={{ color: 'var(--muted-2)' }}>{d.fat}g / {MACRO_LABELS[2].target}g</div>
          </div>
        ))}
        {dailyTotals.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)', padding: '8px 0' }}>No logged days yet.</div>}
        <PaginationControls page={pagination.page} totalPages={pagination.totalPages} onChange={pagination.setPage} />
      </div>

      {selectedDate && (
        <div className="modal-backdrop" onClick={() => setSelectedDate(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="heading" style={{ fontSize: 22 }}>{selectedDate}</div>
              <button onClick={() => setSelectedDate(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
            </div>
            {MEAL_GROUPS.map((group) => {
              const items = selectedEntries.filter((e) => e.meal_group === group);
              return (
                <div key={group} style={{ marginBottom: 14 }}>
                  <div className="label" style={{ fontSize: 14, marginBottom: 8 }}>{MEAL_GROUP_META[group].label}</div>
                  {items.map((it) => (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span>{it.name}</span>
                      <span style={{ color: 'var(--muted-2)' }}>{it.calories} kcal</span>
                    </div>
                  ))}
                  {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)' }}>Nothing logged.</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
