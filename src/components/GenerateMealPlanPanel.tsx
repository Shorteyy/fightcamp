import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dietaryRestrictionLabel } from '../lib/dietaryRestrictions';
import { todayISO } from '../lib/date';
import type { Fighter, Goal, WeightEntry } from '../types/database';

export interface GeneratedPlan {
  planName: string;
  dailyCalorieTarget: number;
  days: {
    dayOfWeek: number;
    mealGroup: string;
    name: string;
    description: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }[];
}

interface Props {
  ownerId: string;
  onGenerated: (plan: GeneratedPlan) => void;
  onCancel: () => void;
}

export function GenerateMealPlanPanel({ ownerId, onGenerated, onCancel }: Props) {
  const [fighter, setFighter] = useState<Fighter | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [direction, setDirection] = useState<'goal' | 'calories'>('calories');
  const [targetCalories, setTargetCalories] = useState('2400');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [deadlineISO, setDeadlineISO] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from('fighters').select('*').eq('profile_id', ownerId).maybeSingle();
      setFighter(f as Fighter);
      if (f) setTargetCalories(String((f as Fighter).daily_calorie_target));

      const { data: g } = await supabase.from('goals').select('*').eq('fighter_id', ownerId).eq('status', 'active').maybeSingle();
      if (g) {
        setGoalWeightKg(String((g as Goal).target_weight_kg));
        setDirection('goal');
      }

      const { data: w } = await supabase.from('weight_entries').select('*').eq('fighter_id', ownerId).order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(1);
      const last = (w as WeightEntry[] | null)?.[0];
      if (last) setLatestWeight(last.weight_kg);

      setLoading(false);
    })();
  }, [ownerId]);

  const generate = async () => {
    setGenerating(true);
    setError(null);

    const body: Record<string, unknown> = {
      direction,
      dietaryRestrictions: fighter?.dietary_restrictions ?? [],
    };
    if (direction === 'calories') {
      const cal = parseInt(targetCalories, 10);
      if (!cal || cal < 800) {
        setError('Enter a valid daily calorie target.');
        setGenerating(false);
        return;
      }
      body.targetCalories = cal;
    } else {
      if (!latestWeight || !goalWeightKg || !deadlineISO) {
        setError('Need a current weight, goal weight, and deadline to generate from a goal.');
        setGenerating(false);
        return;
      }
      body.currentWeightKg = latestWeight;
      body.goalWeightKg = parseFloat(goalWeightKg);
      body.deadlineISO = deadlineISO;
    }

    const { data, error: fnError } = await supabase.functions.invoke('generate-mealplan', { body });
    setGenerating(false);
    if (fnError || data?.error) {
      setError(data?.error ?? fnError?.message ?? 'Could not generate a plan.');
      return;
    }
    onGenerated(data as GeneratedPlan);
  };

  if (loading) return <div className="card" style={{ padding: 16, marginBottom: 16, fontSize: 13, color: 'var(--muted-2)' }}>Loading…</div>;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div className="label" style={{ fontSize: 14, marginBottom: 12 }}>GENERATE WITH AI</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => setDirection('calories')}
          className="btn-secondary"
          style={{ background: direction === 'calories' ? 'var(--accent)' : 'transparent', color: direction === 'calories' ? 'oklch(0.98 0 0)' : undefined }}
        >
          From calorie target
        </button>
        <button
          onClick={() => setDirection('goal')}
          className="btn-secondary"
          style={{ background: direction === 'goal' ? 'var(--accent)' : 'transparent', color: direction === 'goal' ? 'oklch(0.98 0 0)' : undefined }}
        >
          From weight goal
        </button>
      </div>

      {direction === 'calories' ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 4 }}>Daily calories</div>
          <input className="input" type="number" style={{ width: 160 }} value={targetCalories} onChange={(e) => setTargetCalories(e.target.value)} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 4 }}>Current weight</div>
            <div style={{ padding: '10px 0', fontSize: 14 }}>{latestWeight != null ? `${latestWeight} kg` : 'No weight logged yet'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 4 }}>Goal weight (kg)</div>
            <input className="input" type="number" style={{ width: 120 }} value={goalWeightKg} onChange={(e) => setGoalWeightKg(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 4 }}>Deadline</div>
            <input className="input" type="date" value={deadlineISO} onChange={(e) => setDeadlineISO(e.target.value)} min={todayISO()} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 14 }}>
        Dietary restrictions: {fighter?.dietary_restrictions?.length ? fighter.dietary_restrictions.map(dietaryRestrictionLabel).join(', ') : 'none set'} (edit on the Nutrition page)
      </div>

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" style={{ padding: '10px 20px' }} onClick={generate} disabled={generating}>
          {generating ? 'GENERATING…' : 'GENERATE'}
        </button>
        <button className="btn-secondary" onClick={onCancel} disabled={generating}>Cancel</button>
      </div>
    </div>
  );
}
