import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MEAL_GROUPS, MEAL_GROUP_META, DAY_LABELS } from '../lib/trainingTypes';
import { dayOfWeekIndex, todayISO } from '../lib/date';
import type { MealGroup, MealPlan, MealPlanItem } from '../types/database';

interface RowState {
  selected: boolean;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Props {
  ownerId: string;
  plans: MealPlan[];
  onClose: () => void;
  onLogged: () => void;
}

export function LogFromPlanModal({ ownerId, plans, onClose, onLogged }: Props) {
  const followingPlan = plans.find((p) => p.is_following);
  const [planId, setPlanId] = useState<string | null>(followingPlan?.id ?? plans[0]?.id ?? null);
  const [dayIndex, setDayIndex] = useState(dayOfWeekIndex(todayISO()));
  const [items, setItems] = useState<MealPlanItem[]>([]);
  const [rows, setRows] = useState<Record<MealGroup, RowState>>({} as Record<MealGroup, RowState>);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!planId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    supabase.from('meal_plan_items').select('*').eq('meal_plan_id', planId).then(({ data }) => {
      setItems((data ?? []) as MealPlanItem[]);
      setLoading(false);
    });
  }, [planId]);

  useEffect(() => {
    const next: Record<MealGroup, RowState> = {} as Record<MealGroup, RowState>;
    for (const group of MEAL_GROUPS) {
      const item = items.find((it) => it.day_of_week === dayIndex && it.meal_group === group);
      const hasContent = !!(item?.name?.trim() || item?.description?.trim());
      next[group] = {
        selected: false,
        name: item?.name?.trim() || item?.description?.trim() || '',
        calories: item?.calories ?? 0,
        protein_g: item?.protein_g ?? 0,
        carbs_g: item?.carbs_g ?? 0,
        fat_g: item?.fat_g ?? 0,
      };
      if (!hasContent) next[group].name = '';
    }
    setRows(next);
  }, [items, dayIndex]);

  const setRow = (group: MealGroup, patch: Partial<RowState>) => {
    setRows((r) => ({ ...r, [group]: { ...r[group], ...patch } }));
  };

  const selectedCount = Object.values(rows).filter((r) => r.selected).length;

  const submit = async () => {
    const toInsert = MEAL_GROUPS
      .filter((g) => rows[g]?.selected && rows[g].name.trim())
      .map((g) => ({
        fighter_id: ownerId,
        entry_date: todayISO(),
        meal_group: g,
        name: rows[g].name.trim(),
        calories: Math.round(rows[g].calories) || 0,
        protein_g: rows[g].protein_g || 0,
        carbs_g: rows[g].carbs_g || 0,
        fat_g: rows[g].fat_g || 0,
      }));
    if (toInsert.length === 0) return;
    setSubmitting(true);
    await supabase.from('meal_entries').insert(toInsert);
    setSubmitting(false);
    onLogged();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="heading" style={{ fontSize: 22 }}>LOG FROM A MEAL PLAN</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>

        {plans.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted-3)' }}>You don't have any meal plans yet.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <select className="input" style={{ flex: '1 1 200px' }} value={planId ?? ''} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.is_following ? ' (following)' : ''}</option>
                ))}
              </select>
              <select className="input" style={{ width: 110 }} value={dayIndex} onChange={(e) => setDayIndex(Number(e.target.value))}>
                {DAY_LABELS.map((label, i) => (
                  <option key={label} value={i}>{label}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div style={{ color: 'var(--muted-2)', fontSize: 13 }}>Loading…</div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {MEAL_GROUPS.map((group) => {
                  const row = rows[group];
                  if (!row) return null;
                  const empty = !row.name.trim();
                  return (
                    <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', opacity: empty ? 0.5 : 1 }}>
                      <input type="checkbox" checked={row.selected} disabled={empty} onChange={(e) => setRow(group, { selected: e.target.checked })} />
                      <div style={{ width: 70, fontSize: 11, color: 'var(--muted-3)', letterSpacing: '0.5px' }}>{MEAL_GROUP_META[group].label}</div>
                      {empty ? (
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--muted-4)' }}>Nothing planned</div>
                      ) : (
                        <>
                          <div style={{ flex: 1, fontSize: 13 }}>{row.name}</div>
                          <input
                            className="input"
                            type="number"
                            style={{ width: 70, fontSize: 12 }}
                            value={row.calories}
                            onChange={(e) => setRow(group, { calories: parseInt(e.target.value, 10) || 0 })}
                          />
                          <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>kcal</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button className="btn-primary" style={{ width: '100%' }} onClick={submit} disabled={submitting || selectedCount === 0}>
              {submitting ? 'LOGGING…' : `LOG ${selectedCount || ''} MEAL${selectedCount === 1 ? '' : 'S'}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
