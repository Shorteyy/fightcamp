import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { MEAL_GROUPS, MEAL_GROUP_META, DAY_LABELS } from '../lib/trainingTypes';
import { AssignMealPlanModal } from './AssignMealPlanModal';
import type { DirectoryEntry } from '../hooks/useProfileDirectory';
import type { MealPlan, MealPlanItem } from '../types/database';

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
  const [cells, setCells] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<{ name: string; cells: Record<string, string> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    supabase.from('meal_plan_items').select('*').eq('meal_plan_id', plan.id).then(({ data }) => {
      const map: Record<string, string> = {};
      for (const it of (data ?? []) as MealPlanItem[]) map[`${it.day_of_week}:${it.meal_group}`] = it.description;
      setCells(map);
      setOriginal({ name: plan.name, cells: map });
      setLoading(false);
    });
  }, [plan.id, plan.name]);

  const dirty = original != null && (name !== original.name || JSON.stringify(cells) !== JSON.stringify(original.cells));

  const setCell = (day: number, group: string, value: string) => {
    setCells((c) => ({ ...c, [`${day}:${group}`]: value }));
  };

  const save = async () => {
    setSaving(true);
    if (name !== plan.name) {
      await supabase.from('meal_plans').update({ name, updated_at: new Date().toISOString() }).eq('id', plan.id);
    }
    const rows = DAY_LABELS.flatMap((_, day) =>
      MEAL_GROUPS.map((group) => ({
        meal_plan_id: plan.id,
        day_of_week: day,
        meal_group: group,
        description: cells[`${day}:${group}`] ?? '',
      })),
    );
    await supabase.from('meal_plan_items').upsert(rows, { onConflict: 'meal_plan_id,day_of_week,meal_group' });
    setSaving(false);
    setOriginal({ name, cells });
    onSaved();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
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

        {loading ? (
          <div style={{ color: 'var(--muted-2)', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, maxHeight: '55vh', overflowY: 'auto', marginBottom: 16 }}>
            {DAY_LABELS.map((label, dayIndex) => (
              <div key={label} className="card" style={{ padding: 14 }}>
                <div className="label" style={{ fontSize: 14, marginBottom: 10 }}>{label}</div>
                {MEAL_GROUPS.map((group) => (
                  <div key={group} style={{ marginBottom: 8 }}>
                    <strong style={{ color: 'oklch(0.9 0.004 40)', fontSize: 11 }}>{MEAL_GROUP_META[group].label}</strong>
                    {canEdit ? (
                      <textarea
                        value={cells[`${dayIndex}:${group}`] ?? ''}
                        onChange={(e) => setCell(dayIndex, group, e.target.value)}
                        placeholder="—"
                        className="input"
                        style={{ fontSize: 12, minHeight: 36, resize: 'vertical', marginTop: 4 }}
                      />
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 4, minHeight: 20 }}>{cells[`${dayIndex}:${group}`] || '—'}</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {canEdit && (
            <>
              <button className="btn-primary" style={{ padding: '10px 20px' }} onClick={save} disabled={saving || !dirty}>
                {saving ? 'SAVING…' : 'SAVE'}
              </button>
              <span style={{ fontSize: 12, color: dirty ? 'var(--accent)' : 'var(--muted-4)' }}>
                {dirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
            </>
          )}
          {canAssign && (
            <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setAssignOpen(true)}>Send to fighters…</button>
          )}
        </div>
      </div>

      {assignOpen && <AssignMealPlanModal plan={plan} directory={directory} onClose={() => setAssignOpen(false)} onAssigned={onSaved} />}
    </div>
  );
}
