import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useProfileDirectory } from '../hooks/useProfileDirectory';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from '../components/PaginationControls';
import { MEAL_GROUPS, MEAL_GROUP_META } from '../lib/trainingTypes';
import { MealPlanEditorModal } from '../components/MealPlanEditorModal';
import { LogFromPlanModal } from '../components/LogFromPlanModal';
import { NutritionHistoryPanel } from '../components/NutritionHistoryPanel';
import { DIETARY_RESTRICTIONS, dietaryRestrictionLabel } from '../lib/dietaryRestrictions';
import { todayISO, dayOfWeekIndex } from '../lib/date';
import type { Fighter, MealEntry, MealGroup, MealPlan, MealPlanItem } from '../types/database';

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
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim() || !calories) return;
    onSubmit({ name: name.trim(), calories: parseInt(calories, 10) || 0, protein_g: parseFloat(protein) || 0, carbs_g: parseFloat(carbs) || 0, fat_g: parseFloat(fat) || 0 });
  };

  const estimate = async () => {
    if (!name.trim()) return;
    setEstimating(true);
    setEstimateError(null);
    const { data, error } = await supabase.functions.invoke('estimate-nutrition', { body: { items: [{ id: 'x', description: name.trim() }] } });
    setEstimating(false);
    if (error || data?.error) {
      setEstimateError(data?.error ?? error?.message ?? 'Could not estimate.');
      return;
    }
    const r = data.results?.[0];
    if (r) {
      setCalories(String(r.calories));
      setProtein(String(r.protein_g));
      setCarbs(String(r.carbs_g));
      setFat(String(r.fat_g));
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: '1 1 140px' }} placeholder="Food name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" style={{ width: 80 }} type="number" placeholder="kcal" value={calories} onChange={(e) => setCalories(e.target.value)} />
        <input className="input" style={{ width: 70 }} type="number" placeholder="P g" value={protein} onChange={(e) => setProtein(e.target.value)} />
        <input className="input" style={{ width: 70 }} type="number" placeholder="C g" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        <input className="input" style={{ width: 70 }} type="number" placeholder="F g" value={fat} onChange={(e) => setFat(e.target.value)} />
        <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }} onClick={estimate} disabled={estimating || !name.trim()}>
          {estimating ? '…' : 'Estimate with AI'}
        </button>
        <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }} onClick={submit}>Add</button>
        <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }} onClick={onCancel}>Cancel</button>
      </div>
      {estimateError && <div className="error-text" style={{ marginTop: 6 }}>{estimateError}</div>}
    </div>
  );
}

export function NutritionPage() {
  const { fighter, profile, refreshFighter } = useAuth();
  const { directory } = useProfileDirectory();
  const [tab, setTab] = useState<'today' | 'plan' | 'all' | 'history' | 'followers'>('today');
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [openForm, setOpenForm] = useState<MealGroup | null>(null);
  const [myPlans, setMyPlans] = useState<MealPlan[]>([]);
  const [allPlans, setAllPlans] = useState<MealPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [myTagFilter, setMyTagFilter] = useState<string[]>([]);
  const [allTagFilter, setAllTagFilter] = useState<string[]>([]);
  const [tagFilterSeeded, setTagFilterSeeded] = useState(false);
  const [followingItems, setFollowingItems] = useState<MealPlanItem[]>([]);
  const [logFromPlanOpen, setLogFromPlanOpen] = useState(false);
  const [followerPlans, setFollowerPlans] = useState<MealPlan[]>([]);
  const [fightersById, setFightersById] = useState<Record<string, Fighter>>({});
  const [selectedFollowerId, setSelectedFollowerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const today = todayISO();
  const isCoach = profile?.role === 'coach';

  const load = useCallback(async () => {
    if (!fighter || !profile) return;
    setLoading(true);
    const { data } = await supabase.from('meal_entries').select('*').eq('fighter_id', fighter.profile_id).eq('entry_date', today);
    setEntries(data ?? []);

    const { data: plans } = await supabase.from('meal_plans').select('*').eq('owner_id', profile.id).order('updated_at', { ascending: false });
    const myPlanRows = (plans ?? []) as MealPlan[];
    setMyPlans(myPlanRows);

    const { data: all } = await supabase.from('meal_plans').select('*').order('updated_at', { ascending: false });
    setAllPlans((all ?? []) as MealPlan[]);

    const following = myPlanRows.find((p) => p.is_following);
    if (following) {
      const { data: fItems } = await supabase.from('meal_plan_items').select('*').eq('meal_plan_id', following.id).eq('day_of_week', dayOfWeekIndex(today));
      setFollowingItems((fItems ?? []) as MealPlanItem[]);
    } else {
      setFollowingItems([]);
    }

    if (profile.role === 'coach') {
      const { data: fp } = await supabase.from('meal_plans').select('*').eq('is_following', true);
      setFollowerPlans((fp ?? []) as MealPlan[]);
      const { data: allFighters } = await supabase.from('fighters').select('*');
      setFightersById(Object.fromEntries(((allFighters ?? []) as Fighter[]).map((f) => [f.profile_id, f])));
    }

    setLoading(false);
  }, [fighter, profile, today]);

  useEffect(() => {
    load();
  }, [load]);

  // "My Plans" defaults to filtering by the fighter's own restrictions (once,
  // the first time they're known) — so setting a restriction actually does
  // something for you by default, not just for AI generation. Still freely
  // adjustable afterward. "All Plans" is a team-oversight view and stays
  // manual-only — a coach's own diet preference shouldn't hide other plans.
  useEffect(() => {
    if (!tagFilterSeeded && fighter && fighter.dietary_restrictions.length > 0) {
      setMyTagFilter(fighter.dietary_restrictions);
      setTagFilterSeeded(true);
    }
  }, [fighter, tagFilterSeeded]);

  const matches = (tags: string[], plan: MealPlan) => tags.length === 0 || plan.dietary_tags.some((t) => tags.includes(t));
  const toggleFilter = (setter: typeof setMyTagFilter, value: string) => {
    setter((f) => (f.includes(value) ? f.filter((v) => v !== value) : [...f, value]));
  };
  const filteredMyPlans = myPlans.filter((p) => matches(myTagFilter, p));
  const filteredAllPlans = allPlans.filter((p) => matches(allTagFilter, p));
  const myPlansPagination = usePagination(filteredMyPlans);
  const allPlansPagination = usePagination(filteredAllPlans);

  const followersPagination = usePagination(followerPlans);

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

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this meal plan?')) return;
    await supabase.from('meal_plans').delete().eq('id', id);
    await load();
  };

  const toggleFollowing = async (plan: MealPlan) => {
    if (plan.is_following) {
      await supabase.from('meal_plans').update({ is_following: false }).eq('id', plan.id);
    } else {
      await supabase.from('meal_plans').update({ is_following: false }).eq('owner_id', profile.id).eq('is_following', true);
      await supabase.from('meal_plans').update({ is_following: true }).eq('id', plan.id);
    }
    await load();
  };

  const quickLog = async (group: MealGroup, item: MealPlanItem) => {
    const name = item.name?.trim() || item.description?.trim();
    if (!name) return;
    await supabase.from('meal_entries').insert({
      fighter_id: fighter.profile_id,
      entry_date: today,
      meal_group: group,
      name,
      calories: item.calories ?? 0,
      protein_g: item.protein_g ?? 0,
      carbs_g: item.carbs_g ?? 0,
      fat_g: item.fat_g ?? 0,
    });
    await load();
  };

  const toggleRestriction = async (value: string) => {
    const current = fighter.dietary_restrictions ?? [];
    const next = current.includes(value) ? current.filter((r) => r !== value) : [...current, value];
    await supabase.from('fighters').update({ dietary_restrictions: next }).eq('profile_id', fighter.profile_id);
    await refreshFighter();
  };

  const selectedPlan = myPlans.find((p) => p.id === selectedPlanId) ?? allPlans.find((p) => p.id === selectedPlanId) ?? null;

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
            MY PLANS
          </button>
          <button
            onClick={() => setTab('all')}
            style={{ padding: '10px 18px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, background: tab === 'all' ? 'var(--accent)' : 'transparent', color: tab === 'all' ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
          >
            ALL PLANS
          </button>
          <button
            onClick={() => setTab('history')}
            style={{ padding: '10px 18px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, background: tab === 'history' ? 'var(--accent)' : 'transparent', color: tab === 'history' ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
          >
            HISTORY
          </button>
          {isCoach && (
            <button
              onClick={() => setTab('followers')}
              style={{ padding: '10px 18px', border: 'none', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, background: tab === 'followers' ? 'var(--accent)' : 'transparent', color: tab === 'followers' ? 'oklch(0.98 0 0)' : 'oklch(0.65 0.01 40)' }}
            >
              FOLLOWERS
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <span style={{ fontSize: 11, color: 'var(--muted-3)', letterSpacing: '0.5px' }}>DIETARY RESTRICTIONS:</span>
        {DIETARY_RESTRICTIONS.map((r) => {
          const active = fighter.dietary_restrictions?.includes(r.value);
          return (
            <button
              key={r.value}
              onClick={() => toggleRestriction(r.value)}
              style={{ padding: '4px 10px', border: '1px solid var(--border-light)', background: active ? 'var(--accent)' : 'transparent', color: active ? 'oklch(0.98 0 0)' : 'var(--muted-2)', fontSize: 11, borderRadius: 3 }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {tab === 'today' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn-secondary" onClick={() => setLogFromPlanOpen(true)}>Log from a meal plan…</button>
          </div>

          {followingItems.length > 0 && (
            <div className="card" style={{ padding: '18px 22px', marginBottom: 20, borderLeft: '4px solid var(--accent)' }}>
              <div className="label" style={{ fontSize: 14, marginBottom: 10 }}>SUGGESTED FROM YOUR PLAN TODAY</div>
              {MEAL_GROUPS.map((group) => {
                const item = followingItems.find((it) => it.meal_group === group);
                const name = item?.name?.trim() || item?.description?.trim();
                if (!name) return null;
                const alreadyLogged = entries.some((e) => e.meal_group === group && e.name === name);
                return (
                  <div key={group} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <div>
                      <span style={{ color: 'var(--muted-3)', fontSize: 11, marginRight: 8 }}>{MEAL_GROUP_META[group].label}</span>
                      {name}{item?.calories != null && <span style={{ color: 'var(--muted-2)' }}> · {item.calories} kcal</span>}
                    </div>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} disabled={alreadyLogged} onClick={() => quickLog(group, item!)}>
                      {alreadyLogged ? 'Logged' : 'Log this'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

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
      ) : tab === 'plan' ? (
        <>
          <PlanTagFilter tagFilter={myTagFilter} onToggle={(v) => toggleFilter(setMyTagFilter, v)} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {myPlansPagination.pageItems.map((p) => (
              <div key={p.id} onClick={() => setSelectedPlanId(p.id)} className="card" style={{ padding: 20, cursor: 'pointer', position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePlan(p.id); }}
                  style={{ position: 'absolute', top: 10, right: 10, background: 'transparent', border: 'none', color: 'var(--muted-3)', fontSize: 14 }}
                  title="Delete plan"
                >
                  ✕
                </button>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, paddingRight: 20 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 6 }}>Updated {p.updated_at.slice(0, 10)}</div>
                <PlanTagBadges tags={p.dietary_tags} />
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFollowing(p); }}
                  className="btn-secondary"
                  style={{ marginTop: 10, padding: '4px 10px', fontSize: 11, background: p.is_following ? 'var(--accent)' : 'transparent', color: p.is_following ? 'oklch(0.98 0 0)' : undefined }}
                >
                  {p.is_following ? 'FOLLOWING' : 'Follow'}
                </button>
              </div>
            ))}
            {filteredMyPlans.length === 0 && myPlans.length > 0 && <div style={{ color: 'var(--muted-3)', fontSize: 13 }}>No plans match the selected tags.</div>}
            <div
              onClick={createPlan}
              style={{ border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, cursor: 'pointer', color: 'var(--muted-3)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1 }}
            >
              + NEW PLAN
            </div>
          </div>
          <PaginationControls page={myPlansPagination.page} totalPages={myPlansPagination.totalPages} onChange={myPlansPagination.setPage} />
        </>
      ) : tab === 'all' ? (
        <>
          <PlanTagFilter tagFilter={allTagFilter} onToggle={(v) => toggleFilter(setAllTagFilter, v)} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {allPlansPagination.pageItems.map((p) => {
              const canDelete = p.owner_id === profile.id || isCoach;
              return (
                <div key={p.id} onClick={() => setSelectedPlanId(p.id)} className="card" style={{ padding: 20, cursor: 'pointer', position: 'relative' }}>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePlan(p.id); }}
                      style={{ position: 'absolute', top: 10, right: 10, background: 'transparent', border: 'none', color: 'var(--muted-3)', fontSize: 14 }}
                      title="Delete plan"
                    >
                      ✕
                    </button>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, paddingRight: canDelete ? 20 : 0 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 6 }}>{directory[p.owner_id]?.name ?? '—'} · Updated {p.updated_at.slice(0, 10)}</div>
                  <PlanTagBadges tags={p.dietary_tags} />
                  {p.owner_id === profile.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFollowing(p); }}
                      className="btn-secondary"
                      style={{ marginTop: 10, padding: '4px 10px', fontSize: 11, background: p.is_following ? 'var(--accent)' : 'transparent', color: p.is_following ? 'oklch(0.98 0 0)' : undefined }}
                    >
                      {p.is_following ? 'FOLLOWING' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })}
            {allPlans.length === 0 && <div style={{ color: 'var(--muted-3)', fontSize: 13 }}>No plans yet.</div>}
            {allPlans.length > 0 && filteredAllPlans.length === 0 && <div style={{ color: 'var(--muted-3)', fontSize: 13 }}>No plans match the selected tags.</div>}
          </div>
          <PaginationControls page={allPlansPagination.page} totalPages={allPlansPagination.totalPages} onChange={allPlansPagination.setPage} />
        </>
      ) : tab === 'history' ? (
        <NutritionHistoryPanel fighterId={fighter.profile_id} dailyCalorieTarget={fighter.daily_calorie_target} />
      ) : (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: 'var(--muted-3)', letterSpacing: '0.5px', paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <div>FOLLOWER</div>
            <div>PLAN</div>
          </div>
          {followersPagination.pageItems.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedFollowerId(p.owner_id)}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}
            >
              <div>{directory[p.owner_id]?.name ?? '—'}</div>
              <div style={{ color: 'var(--muted-2)' }}>{p.name}</div>
            </div>
          ))}
          {followerPlans.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-4)', padding: '8px 0' }}>No one is following a plan yet.</div>}
          <PaginationControls page={followersPagination.page} totalPages={followersPagination.totalPages} onChange={followersPagination.setPage} />
        </div>
      )}

      {selectedFollowerId && (
        <div className="modal-backdrop" onClick={() => setSelectedFollowerId(null)}>
          <div className="modal-panel" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="heading" style={{ fontSize: 22 }}>{directory[selectedFollowerId]?.name ?? '—'}'S LOG</div>
              <button onClick={() => setSelectedFollowerId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
            </div>
            <NutritionHistoryPanel fighterId={selectedFollowerId} dailyCalorieTarget={fightersById[selectedFollowerId]?.daily_calorie_target ?? 2400} />
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

      {logFromPlanOpen && (
        <LogFromPlanModal
          ownerId={fighter.profile_id}
          plans={myPlans}
          onClose={() => setLogFromPlanOpen(false)}
          onLogged={load}
        />
      )}
    </div>
  );
}

function PlanTagFilter({ tagFilter, onToggle }: { tagFilter: string[]; onToggle: (value: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <span style={{ fontSize: 11, color: 'var(--muted-3)', letterSpacing: '0.5px' }}>FILTER BY TAG:</span>
      {DIETARY_RESTRICTIONS.map((r) => {
        const active = tagFilter.includes(r.value);
        return (
          <button
            key={r.value}
            onClick={() => onToggle(r.value)}
            style={{ padding: '3px 9px', border: '1px solid var(--border-light)', background: active ? 'var(--accent)' : 'transparent', color: active ? 'oklch(0.98 0 0)' : 'var(--muted-2)', fontSize: 11, borderRadius: 3 }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function PlanTagBadges({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {tags.map((t) => (
        <span key={t} style={{ fontSize: 10, color: 'var(--muted-2)', border: '1px solid var(--border-light)', borderRadius: 3, padding: '1px 6px' }}>{dietaryRestrictionLabel(t)}</span>
      ))}
    </div>
  );
}
