import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useProfileDirectory } from '../hooks/useProfileDirectory';
import { MEAL_GROUPS, MEAL_GROUP_META } from '../lib/trainingTypes';
import { MealPlanEditorModal } from '../components/MealPlanEditorModal';
import { todayISO } from '../lib/date';
import type { MealEntry, MealGroup, MealPlan } from '../types/database';

const MACRO_TARGETS = [
  { key: 'protein_g' as const, label: 'Protein', target: 180, color: 'oklch(0.58 0.2 25)' },
  { key: 'carbs_g' as const, label: 'Carbs', target: 260, color: 'oklch(0.78 0.15 90)' },
  { key: 'fat_g' as const, label: 'Fat', target: 70, color: 'oklch(0.65 0.13 230)' },
];

function AddFoodForm({ onSubmit, onCancel }: { onSubmit: (v: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const submit = () => {
    if (!name.trim() || !calories) return;
    onSubmit({ name: name.trim(), calories: parseInt(calories, 10) || 0, protein_g: parseFloat(protein) || 0, carbs_g: parseFloat(carbs) || 0, fat_g: parseFloat(fat) || 0 });
  };

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      <input className="input" style={{ flex: '1 1 140px' }} placeholder="Food name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" style={{ width: 80 }} type="number" placeholder="kcal" value={calories} onChange={(e) => setCalories(e.target.value)} />
      <input className="input" style={{ width: 70 }} type="number" placeholder="P g" value={protein} onChange={(e) => setProtein(e.target.value)} />
      <input className="input" style={{ width: 70 }} type="number" placeholder="C g" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
      <input className="input" style={{ width: 70 }} type="number" placeholder="F g" value={fat} onChange={(e) => setFat(e.target.value)} />
      <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }} onClick={submit}>Add</button>
      <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }} onClick={onCancel}>Cancel</button>
    </div>
  );
}

export function NutritionPage() {
  const { fighter, profile } = useAuth();
  const { directory } = useProfileDirectory();
  const [tab, setTab] = useState<'today' | 'plan'>('today');
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [openForm, setOpenForm] = useState<MealGroup | null>(null);
  const [myPlans, setMyPlans] = useState<MealPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const today = todayISO();

  const load = useCallback(async () => {
    if (!fighter || !profile) return;
    setLoading(true);
    const { data } = await supabase.from('meal_entries').select('*').eq('fighter_id', fighter.profile_id).eq('entry_date', today);
    setEntries(data ?? []);

    const { data: plans } = await supabase.from('meal_plans').select('*').eq('owner_id', profile.id).order('updated_at', { ascending: false });
    setMyPlans((plans ?? []) as MealPlan[]);

    setLoading(false);
  }, [fighter, profile, today]);

  useEffect(() => {
    load();
  }, [load]);

  if (!fighter || !profile) return <Navigate to="/dashboard" replace />;
  if (loading) return <div style={{ color: 'var(--muted-2)' }}>Loading…</div>;

  const addFood = async (group: MealGroup, v: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }) => {
    await supabase.from('meal_entries').insert({ fighter_id: fighter.profile_id, entry_date: today, meal_group: group, ...v });
    setOpenForm(null);
    await load();
  };

  const createPlan = async () => {
    const { data } = await supabase.from('meal_plans').insert({ name: 'New Plan', owner_id: profile.id, created_by: profile.id }).select().single();
    if (data) {
      await load();
      setSelectedPlanId(data.id);
    }
  };

  const selectedPlan = myPlans.find((p) => p.id === selectedPlanId) ?? null;

  const caloriesConsumed = entries.reduce((a, e) => a + e.calories, 0);
  const caloriesTarget = fighter.daily_calorie_target;
  const r = 65;
  const circ = 2 * Math.PI * r;
  const ringPct = Math.min(1, caloriesConsumed / caloriesTarget);
  const ringOffset = circ * (1 - ringPct);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="heading" style={{ fontSize: 44, margin: 0 }}>NUTRITION</h1>
        <div style={{ display: 'flex', gap: 2, background: 'var(--panel)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setTab('today')}
            style={{ padding: '10px 18px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, background: tab === 'today' ? 'var(--accent)' : 'transparent', color: tab === 'today' ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
          >
            TODAY
          </button>
          <button
            onClick={() => setTab('plan')}
            style={{ padding: '10px 18px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, background: tab === 'plan' ? 'var(--accent)' : 'transparent', color: tab === 'plan' ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
          >
            MEAL PLAN
          </button>
        </div>
      </div>

      {tab === 'today' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, marginBottom: 28 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="150" height="150" viewBox="0 0 150 150">
                <circle cx="75" cy="75" r={r} fill="none" stroke="oklch(0.3 0.012 40)" strokeWidth="12" />
                <circle cx="75" cy="75" r={r} fill="none" stroke="oklch(0.58 0.2 25)" strokeWidth="12" strokeDasharray={circ.toFixed(1)} strokeDashoffset={ringOffset.toFixed(1)} transform="rotate(-90 75 75)" />
                <text x="75" y="70" fontSize="26" fontWeight="700" fill="oklch(0.97 0.004 40)" textAnchor="middle" fontFamily="Bebas Neue">{caloriesConsumed}</text>
                <text x="75" y="90" fontSize="11" fill="oklch(0.55 0.01 40)" textAnchor="middle">of {caloriesTarget} kcal</text>
              </svg>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
              {MACRO_TARGETS.map((m) => {
                const consumed = entries.reduce((a, e) => a + e[m.key], 0);
                const pct = Math.min(100, (consumed / m.target) * 100);
                return (
                  <div key={m.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-2)', marginBottom: 4 }}>
                      <span>{m.label}</span><span>{consumed}g / {m.target}g</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--track)', width: '100%' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: m.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {MEAL_GROUPS.map((group) => {
            const items = entries.filter((e) => e.meal_group === group);
            return (
              <div key={group} className="card" style={{ padding: '18px 22px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="label" style={{ fontSize: 16 }}>{MEAL_GROUP_META[group].label}</div>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setOpenForm(group)}>+ Add food</button>
                </div>
                {items.map((it) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span>{it.name}</span>
                    <span style={{ color: 'var(--muted-2)' }}>{it.calories} kcal</span>
                  </div>
                ))}
                {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)', padding: '6px 0' }}>No meals logged yet.</div>}
                {openForm === group && <AddFoodForm onSubmit={(v) => addFood(group, v)} onCancel={() => setOpenForm(null)} />}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
          {myPlans.map((p) => (
            <div key={p.id} onClick={() => setSelectedPlanId(p.id)} className="card" style={{ padding: 20, cursor: 'pointer' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>Updated {p.updated_at.slice(0, 10)}</div>
            </div>
          ))}
          <div
            onClick={createPlan}
            style={{ border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, cursor: 'pointer', color: 'var(--muted-3)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1 }}
          >
            + NEW PLAN
          </div>
        </div>
      )}

      {selectedPlan && (
        <MealPlanEditorModal
          plan={selectedPlan}
          directory={directory}
          canAssign={profile.role === 'coach'}
          onClose={() => setSelectedPlanId(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
