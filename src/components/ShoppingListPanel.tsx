import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { downloadShoppingListPdf } from '../lib/shoppingListPdf';
import type { MealPlan, ShoppingListCategory } from '../types/database';

interface Props {
  plan: MealPlan;
  onClose: () => void;
  onSaved: () => void;
}

export function ShoppingListPanel({ plan, onClose, onSaved }: Props) {
  useModalScrollLock();
  const [list, setList] = useState<ShoppingListCategory[] | null>(plan.shopping_list);
  const [generatedAt, setGeneratedAt] = useState<string | null>(plan.shopping_list_generated_at);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const generate = async () => {
    setGenerating(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke('generate-shopping-list', { body: { mealPlanId: plan.id } });
    if (fnError || data?.error) {
      setGenerating(false);
      setError(data?.error ?? fnError?.message ?? 'Could not generate a shopping list.');
      return;
    }
    const categories = data.categories as ShoppingListCategory[];
    const now = new Date().toISOString();
    const { error: updErr } = await supabase.from('meal_plans').update({ shopping_list: categories, shopping_list_generated_at: now }).eq('id', plan.id);
    setGenerating(false);
    if (updErr) {
      setError('Generated, but could not save the list — try again.');
      return;
    }
    setList(categories);
    setGeneratedAt(now);
    setChecked(new Set());
    onSaved();
  };

  const toggleCheck = (key: string) => {
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div className="heading" style={{ fontSize: 22 }}>SHOPPING LIST</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 16 }}>{plan.name}</div>

        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ padding: '10px 18px' }} onClick={generate} disabled={generating}>
            {generating ? 'GENERATING…' : list ? 'REGENERATE' : 'GENERATE'}
          </button>
          {list && (
            <button className="btn-secondary" onClick={() => downloadShoppingListPdf(plan.name, list)}>
              Export PDF
            </button>
          )}
        </div>

        {generatedAt && <div style={{ fontSize: 11, color: 'var(--muted-4)', marginBottom: 14 }}>Generated {new Date(generatedAt).toLocaleString()}</div>}

        {list ? (
          <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            {list.map((cat) => (
              <div key={cat.category} style={{ marginBottom: 16 }}>
                <div className="label" style={{ fontSize: 13, marginBottom: 8, color: 'var(--accent)' }}>{cat.category.toUpperCase()}</div>
                {cat.items.map((item) => {
                  const key = `${cat.category}:${item.name}`;
                  const isChecked = checked.has(key);
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', opacity: isChecked ? 0.5 : 1 }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(key)} />
                      <span style={{ flex: 1, fontSize: 13, textDecoration: isChecked ? 'line-through' : 'none' }}>{item.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted-3)' }}>{item.quantity}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          !generating && <div style={{ fontSize: 13, color: 'var(--muted-3)' }}>No shopping list yet — generate one from this plan's meals.</div>
        )}
      </div>
    </div>
  );
}
