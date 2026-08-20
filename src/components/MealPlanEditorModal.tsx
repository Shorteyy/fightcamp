import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { MEAL_GROUPS, MEAL_GROUP_META, DAY_LABELS } from '../lib/trainingTypes';
import { AssignMealPlanModal } from './AssignMealPlanModal';
import { GenerateMealPlanPanel, type GeneratedPlan } from './GenerateMealPlanPanel';
import { ShoppingListPanel } from './ShoppingListPanel';
import { DIETARY_RESTRICTIONS, dietaryRestrictionLabel } from '../lib/dietaryRestrictions';
import type { DirectoryEntry } from '../hooks/useProfileDirectory';
import type { MealPlan, MealPlanItem } from '../types/database';

interface CellState {
  description: string;
  name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

const EMPTY_CELL: CellState = { description: '', name: null, calories: null, protein_g: null, carbs_g: null, fat_g: null };

interface Props {
  plan: MealPlan;
  directory: Record<string, DirectoryEntry>;
  canAssign: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function MealPlanEditorModal({ plan, directory, canAssign, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const isOwner = profile?.id === plan.owner_id;
  const canEdit = isOwner || profile?.role === 'coach';

  const [name, setName] = useState(plan.name);
  const [tags, setTags] = useState<string[]>(plan.dietary_tags);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [original, setOriginal] = useState<{ name: string; tags: string[]; cells: Record<string, CellState> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [expandedCell, setExpandedCell] = useState<{ day: number; group: string } | null>(null);

  useEffect(() => {
    supabase.from('meal_plan_items').select('*').eq('meal_plan_id', plan.id).then(({ data }) => {
      const map: Record<string, CellState> = {};
      for (const it of (data ?? []) as MealPlanItem[]) {
        map[`${it.day_of_week}:${it.meal_group}`] = {
          description: it.description,
          name: it.name,
          calories: it.calories,
          protein_g: it.protein_g,
          carbs_g: it.carbs_g,
          fat_g: it.fat_g,
        };
      }
      setCells(map);
      setOriginal({ name: plan.name, tags: plan.dietary_tags, cells: map });
      setLoading(false);
    });
  }, [plan.id, plan.name, plan.dietary_tags]);

  const dirty = original != null && (
    name !== original.name ||
    JSON.stringify([...tags].sort()) !== JSON.stringify([...original.tags].sort()) ||
    JSON.stringify(cells) !== JSON.stringify(original.cells)
  );

  const toggleTag = (value: string) => {
    setTags((t) => (t.includes(value) ? t.filter((v) => v !== value) : [...t, value]));
  };

  const setDescription = (day: number, group: string, value: string) => {
    const key = `${day}:${group}`;
    setCells((c) => ({ ...c, [key]: { ...(c[key] ?? EMPTY_CELL), description: value } }));
  };

  const setCellName = (day: number, group: string, value: string) => {
    const key = `${day}:${group}`;
    setCells((c) => ({ ...c, [key]: { ...(c[key] ?? EMPTY_CELL), name: value || null } }));
  };

  const save = async () => {
    setSaving(true);
    if (name !== plan.name || JSON.stringify([...tags].sort()) !== JSON.stringify([...plan.dietary_tags].sort())) {
      await supabase.from('meal_plans').update({ name, dietary_tags: tags, updated_at: new Date().toISOString() }).eq('id', plan.id);
    }
    const rows = DAY_LABELS.flatMap((_, day) =>
      MEAL_GROUPS.map((group) => {
        const c = cells[`${day}:${group}`] ?? EMPTY_CELL;
        return {
          meal_plan_id: plan.id,
          day_of_week: day,
          meal_group: group,
          description: c.description,
          name: c.name,
          calories: c.calories,
          protein_g: c.protein_g,
          carbs_g: c.carbs_g,
          fat_g: c.fat_g,
        };
      }),
    );
    await supabase.from('meal_plan_items').upsert(rows, { onConflict: 'meal_plan_id,day_of_week,meal_group' });
    setSaving(false);
    setOriginal({ name, tags, cells });
    onSaved();
  };

  const applyGenerated = (generated: GeneratedPlan) => {
    const next: Record<string, CellState> = {};
    for (const d of generated.days) {
      next[`${d.dayOfWeek}:${d.mealGroup}`] = {
        description: d.description,
        name: d.name,
        calories: d.calories,
        protein_g: d.protein_g,
        carbs_g: d.carbs_g,
        fat_g: d.fat_g,
      };
    }
    setCells(next);
    setName(generated.planName);
    setTags(generated.dietaryRestrictionsUsed ?? []);
    setGenerateOpen(false);
  };

  const estimateMissing = async () => {
    const targets = Object.entries(cells).filter(([, c]) => c.description.trim() && c.calories == null);
    if (targets.length === 0) return;
    setEstimating(true);
    setEstimateError(null);
    const { data, error } = await supabase.functions.invoke('estimate-nutrition', {
      body: { items: targets.map(([key, c]) => ({ id: key, description: c.description })) },
    });
    setEstimating(false);
    if (error || data?.error) {
      setEstimateError(data?.error ?? error?.message ?? 'Could not estimate values.');
      return;
    }
    setCells((prev) => {
      const next = { ...prev };
      for (const r of data.results as { id: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]) {
        const existing = next[r.id];
        // Only fill cells still missing calories — never overwrite a manual/existing value.
        if (existing && existing.calories == null) {
          next[r.id] = { ...existing, calories: r.calories, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g };
        }
      }
      return next;
    });
  };

  const missingCount = Object.values(cells).filter((c) => c.description.trim() && c.calories == null).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 760 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 }}>
          {canEdit ? (
            <input className="input" style={{ fontSize: 18, fontWeight: 700, flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <div className="heading" style={{ fontSize: 22 }}>{name}</div>
          )}
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 16 }}>
          Owned by {directory[plan.owner_id]?.name ?? '—'}{!canEdit ? ' · read-only' : ''}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-3)', letterSpacing: '0.5px' }}>TAGS:</span>
          {canEdit ? (
            DIETARY_RESTRICTIONS.map((r) => {
              const active = tags.includes(r.value);
              return (
                <button
                  key={r.value}
                  onClick={() => toggleTag(r.value)}
                  style={{ padding: '3px 9px', border: '1px solid var(--border-light)', background: active ? 'var(--accent)' : 'transparent', color: active ? 'oklch(0.98 0 0)' : 'var(--muted-2)', fontSize: 11, borderRadius: 3 }}
                >
                  {r.label}
                </button>
              );
            })
          ) : tags.length > 0 ? (
            tags.map((t) => (
              <span key={t} style={{ padding: '3px 9px', border: '1px solid var(--border-light)', fontSize: 11, borderRadius: 3, color: 'var(--muted-2)' }}>{dietaryRestrictionLabel(t)}</span>
            ))
          ) : (
            <span style={{ fontSize: 11, color: 'var(--muted-4)' }}>none</span>
          )}
        </div>

        {canEdit && generateOpen && (
          <GenerateMealPlanPanel ownerId={plan.owner_id} onGenerated={applyGenerated} onCancel={() => setGenerateOpen(false)} />
        )}

        {loading ? (
          <div style={{ color: 'var(--muted-2)', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14, maxHeight: '60vh', overflowY: 'auto', marginBottom: 16 }}>
            {DAY_LABELS.map((label, dayIndex) => (
              <div key={label} className="card" style={{ padding: 14 }}>
                <div className="label" style={{ fontSize: 14, marginBottom: 10 }}>{label}</div>
                {MEAL_GROUPS.map((group) => {
                  const cell = cells[`${dayIndex}:${group}`] ?? EMPTY_CELL;
                  const hasOverflow = cell.description.length > 90;
                  return (
                    <div key={group} style={{ marginBottom: 10, height: 150, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 4, padding: 8 }}>
                      <strong style={{ color: 'oklch(0.9 0.004 40)', fontSize: 11, marginBottom: 4 }}>{MEAL_GROUP_META[group].label}</strong>
                      {canEdit ? (
                        <>
                          <input
                            value={cell.name ?? ''}
                            onChange={(e) => setCellName(dayIndex, group, e.target.value)}
                            placeholder="Meal name"
                            className="input"
                            style={{ fontSize: 12, fontWeight: 600, padding: '4px 6px', marginBottom: 4 }}
                          />
                          <textarea
                            value={cell.description}
                            onChange={(e) => setDescription(dayIndex, group, e.target.value)}
                            placeholder="Description"
                            className="input"
                            style={{ fontSize: 12, flex: 1, resize: 'none', padding: '4px 6px' }}
                          />
                        </>
                      ) : (
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          {cell.name && <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{cell.name}</div>}
                          <div
                            style={{
                              fontSize: 12, color: 'var(--muted-2)', display: '-webkit-box',
                              WebkitLineClamp: cell.name ? 3 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}
                          >
                            {cell.description || '—'}
                          </div>
                          {hasOverflow && (
                            <button
                              onClick={() => setExpandedCell({ day: dayIndex, group })}
                              style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11, padding: 0, marginTop: 2, cursor: 'pointer' }}
                            >
                              Read more
                            </button>
                          )}
                        </div>
                      )}
                      {cell.calories != null && (
                        <div style={{ fontSize: 10, color: 'var(--muted-3)', marginTop: 4, flexShrink: 0 }}>
                          {cell.calories} kcal · P{cell.protein_g}g C{cell.carbs_g}g F{cell.fat_g}g
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {estimateError && <div className="error-text" style={{ marginBottom: 12 }}>{estimateError}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {canEdit && (
            <>
              <button className="btn-primary" style={{ padding: '10px 20px' }} onClick={save} disabled={saving || !dirty}>
                {saving ? 'SAVING…' : 'SAVE'}
              </button>
              <span style={{ fontSize: 12, color: dirty ? 'var(--accent)' : 'var(--muted-4)' }}>
                {dirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
              {!generateOpen && (
                <button className="btn-secondary" onClick={() => setGenerateOpen(true)}>Generate with AI…</button>
              )}
              {missingCount > 0 && (
                <button className="btn-secondary" onClick={estimateMissing} disabled={estimating}>
                  {estimating ? 'ESTIMATING…' : `Estimate missing values (${missingCount})`}
                </button>
              )}
              <button className="btn-secondary" onClick={() => setShoppingListOpen(true)}>Shopping list…</button>
            </>
          )}
          {canAssign && (
            <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setAssignOpen(true)}>Send to fighters…</button>
          )}
        </div>
      </div>

      {assignOpen && <AssignMealPlanModal plan={plan} directory={directory} onClose={() => setAssignOpen(false)} onAssigned={onSaved} />}
      {shoppingListOpen && <ShoppingListPanel plan={plan} onClose={() => setShoppingListOpen(false)} onSaved={onSaved} />}
      {expandedCell && (() => {
        const cell = cells[`${expandedCell.day}:${expandedCell.group}`] ?? EMPTY_CELL;
        return (
          <div className="modal-backdrop" onClick={() => setExpandedCell(null)}>
            <div className="modal-panel" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="heading" style={{ fontSize: 20 }}>{DAY_LABELS[expandedCell.day]} · {MEAL_GROUP_META[expandedCell.group].label}</div>
                <button onClick={() => setExpandedCell(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
              </div>
              {cell.name && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{cell.name}</div>}
              <div style={{ fontSize: 13, color: 'var(--muted-2)', whiteSpace: 'pre-wrap', marginBottom: 12 }}>{cell.description || '—'}</div>
              {cell.calories != null && (
                <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>{cell.calories} kcal · P{cell.protein_g}g C{cell.carbs_g}g F{cell.fat_g}g</div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
