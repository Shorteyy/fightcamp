import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import type { DirectoryEntry } from '../hooks/useProfileDirectory';
import type { MealPlan, MealPlanItem } from '../types/database';

interface Props {
  plan: MealPlan;
  directory: Record<string, DirectoryEntry>;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignMealPlanModal({ plan, directory, onClose, onAssigned }: Props) {
  const { profile } = useAuth();
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id').neq('id', profile?.id ?? '').then(({ data }) => {
      setMemberIds((data ?? []).map((p) => p.id));
    });
  }, [profile?.id]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (!profile || selected.size === 0) return;
    setSubmitting(true);

    const { data: items } = await supabase.from('meal_plan_items').select('*').eq('meal_plan_id', plan.id);
    const sourceItems = (items ?? []) as MealPlanItem[];

    for (const fighterId of selected) {
      const { data: newPlan } = await supabase
        .from('meal_plans')
        .insert({ name: plan.name, owner_id: fighterId, created_by: profile.id, dietary_tags: plan.dietary_tags })
        .select()
        .single();
      if (!newPlan) continue;
      if (sourceItems.length > 0) {
        await supabase.from('meal_plan_items').insert(
          sourceItems.map((it) => ({
            meal_plan_id: newPlan.id,
            day_of_week: it.day_of_week,
            meal_group: it.meal_group,
            description: it.description,
            name: it.name,
            calories: it.calories,
            protein_g: it.protein_g,
            carbs_g: it.carbs_g,
            fat_g: it.fat_g,
          })),
        );
      }
    }

    setSubmitting(false);
    onAssigned();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="heading" style={{ fontSize: 22 }}>SEND "{plan.name.toUpperCase()}"</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted-1)', marginBottom: 16 }}>
          Each person gets their own editable copy — future edits to your plan won't affect theirs.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, maxHeight: 260, overflowY: 'auto' }}>
          {memberIds.map((id) => {
            const d = directory[id];
            if (!d) return null;
            const checked = selected.has(id);
            return (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(id)} />
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: d.hueColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{d.initials}</div>
                <span style={{ fontSize: 13 }}>{d.name}</span>
              </label>
            );
          })}
          {memberIds.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)' }}>No one else on the team yet.</div>}
        </div>
        <button className="btn-primary" style={{ width: '100%' }} onClick={send} disabled={submitting || selected.size === 0}>
          {submitting ? 'SENDING…' : `SEND TO ${selected.size || ''} PERSON${selected.size === 1 ? '' : 'S'}`.replace('PERSONS', 'PEOPLE')}
        </button>
      </div>
    </div>
  );
}
