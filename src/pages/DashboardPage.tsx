import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useProfileDirectory } from '../hooks/useProfileDirectory';
import { useGalaDirectory } from '../hooks/useGalaDirectory';
import { TrainingDetailModal } from '../components/TrainingDetailModal';
import { GalaDetailModal } from '../components/GalaDetailModal';
import { TRAINING_TYPE_META } from '../lib/trainingTypes';
import { PARTICIPATION_META, GALA_COLOR } from '../lib/galas';
import { effectiveDeadline } from '../lib/goals';
import { todayISO, weekStart, weekDates, dayFull, dayOfWeekIndex } from '../lib/date';
import { buildWeightChart, computeStatus } from '../lib/chart';
import { sortWeightEntries } from '../lib/weight';
import { MEAL_GROUPS, MEAL_GROUP_META } from '../lib/trainingTypes';
import type { Gala, GalaParticipationType, Goal, MealPlan, MealPlanItem, Training, WeightEntry } from '../types/database';

export function DashboardPage() {
  const { profile, fighter } = useAuth();
  const { directory } = useProfileDirectory();
  const { galasById, refresh: refreshGalas } = useGalaDirectory();
  const navigate = useNavigate();

  const [todaysTrainings, setTodaysTrainings] = useState<Training[]>([]);
  const [attendees, setAttendees] = useState<Record<string, string[]>>({});
  const [weekTrainingCount, setWeekTrainingCount] = useState(0);
  const [fighterCount, setFighterCount] = useState(0);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [caloriesToday, setCaloriesToday] = useState(0);
  const [followingPlan, setFollowingPlan] = useState<MealPlan | null>(null);
  const [followingPlanItems, setFollowingPlanItems] = useState<MealPlanItem[]>([]);
  const [myGalaParticipation, setMyGalaParticipation] = useState<Record<string, GalaParticipationType>>({});
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [selectedGalaId, setSelectedGalaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const today = todayISO();
  const wStart = weekStart(today);
  const wEnd = weekDates(wStart)[6];

  const load = useCallback(async () => {
    setLoading(true);

    const { data: todays } = await supabase.from('trainings').select('*').eq('training_date', today).order('start_time');
    setTodaysTrainings(todays ?? []);

    const { data: weekTrainings } = await supabase
      .from('trainings')
      .select('id, cancelled_at')
      .gte('training_date', wStart)
      .lte('training_date', wEnd);
    const weekIds = (weekTrainings ?? []).filter((t) => !t.cancelled_at).map((t) => t.id);

    const allTrainingIds = Array.from(new Set([...(todays ?? []).map((t) => t.id), ...weekIds]));
    if (allTrainingIds.length > 0) {
      const { data: att } = await supabase.from('training_attendees').select('training_id, fighter_id').in('training_id', allTrainingIds);
      const map: Record<string, string[]> = {};
      for (const row of att ?? []) {
        map[row.training_id] = [...(map[row.training_id] ?? []), row.fighter_id];
      }
      setAttendees(map);

      if (fighter) {
        const mine = weekIds.filter((id) => (map[id] ?? []).includes(fighter.profile_id));
        setWeekTrainingCount(mine.length);
      } else {
        setWeekTrainingCount(weekIds.length);
      }
    } else {
      setAttendees({});
      setWeekTrainingCount(0);
    }

    if (profile?.role === 'coach') {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'fighter');
      setFighterCount(count ?? 0);
    }

    if (fighter) {
      const { data: hist } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('fighter_id', fighter.profile_id);
      setWeightHistory(sortWeightEntries((hist ?? []) as WeightEntry[]));

      const { data: goal } = await supabase.from('goals').select('*').eq('fighter_id', fighter.profile_id).eq('status', 'active').maybeSingle();
      setActiveGoal((goal as Goal) ?? null);

      const { data: meals } = await supabase
        .from('meal_entries')
        .select('calories')
        .eq('fighter_id', fighter.profile_id)
        .eq('entry_date', today);
      setCaloriesToday((meals ?? []).reduce((a, m) => a + m.calories, 0));

      const { data: fp } = await supabase.from('meal_plans').select('*').eq('owner_id', fighter.profile_id).eq('is_following', true).maybeSingle();
      const plan = (fp as MealPlan) ?? null;
      setFollowingPlan(plan);
      if (plan) {
        const { data: items } = await supabase.from('meal_plan_items').select('*').eq('meal_plan_id', plan.id).eq('day_of_week', dayOfWeekIndex(today));
        setFollowingPlanItems((items ?? []) as MealPlanItem[]);
      } else {
        setFollowingPlanItems([]);
      }
    }

    if (profile) {
      const { data: parts } = await supabase.from('gala_participants').select('gala_id, participation_type').eq('profile_id', profile.id);
      const map: Record<string, GalaParticipationType> = {};
      for (const p of parts ?? []) map[p.gala_id] = p.participation_type;
      setMyGalaParticipation(map);
    }

    setLoading(false);
  }, [today, wStart, wEnd, fighter, profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div style={{ color: 'var(--muted-2)' }}>Loading…</div>;

  const deadline = activeGoal ? effectiveDeadline(activeGoal, galasById) : null;
  const hasGoal = activeGoal != null && deadline != null;
  const status = hasGoal && weightHistory.length > 0
    ? computeStatus(weightHistory.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), activeGoal!.target_weight_kg, deadline!, today)
    : null;
  const chart = hasGoal && weightHistory.length > 0
    ? buildWeightChart(weightHistory.map((h) => ({ date: h.entry_date, weight: h.weight_kg })), activeGoal!.target_weight_kg, deadline!, 400, 140)
    : null;

  const selectedTraining = todaysTrainings.find((t) => t.id === selectedTrainingId) ?? null;
  const selectedGala = selectedGalaId ? galasById[selectedGalaId] ?? null : null;
  const myUpcomingGalas: Gala[] = Object.keys(myGalaParticipation)
    .map((id) => galasById[id])
    .filter((g): g is Gala => !!g && g.event_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div>
      <h1 className="heading" style={{ fontSize: 44, margin: '0 0 2px 0' }}>DASHBOARD</h1>
      <div style={{ color: 'var(--muted-3)', fontSize: 14, marginBottom: 32 }}>
        {new Date(today + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>

      <div className="label" style={{ fontSize: 18, marginBottom: 14 }}>TODAY'S TRAININGS</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 36 }}>
        {todaysTrainings.map((t) => {
          const meta = TRAINING_TYPE_META[t.type];
          const cancelled = t.cancelled_at != null;
          const ids = (attendees[t.id] ?? []).slice(0, 4);
          return (
            <div
              key={t.id}
              onClick={() => setSelectedTrainingId(t.id)}
              className="card"
              style={{ borderLeft: `4px solid ${cancelled ? 'var(--muted-4)' : meta.color}`, width: 260, padding: 18, cursor: 'pointer', opacity: cancelled ? 0.6 : 1 }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: cancelled ? 'var(--muted-3)' : meta.color, marginBottom: 8 }}>
                {meta.abbr}{cancelled ? ' · CANCELLED' : ''}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, textDecoration: cancelled ? 'line-through' : 'none' }}>{t.title}</div>
              <div style={{ color: 'var(--muted-2)', fontSize: 13, marginBottom: 14 }}>{t.start_time.slice(0, 5)} · {t.location}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {ids.map((id) => {
                  const d = directory[id];
                  if (!d) return null;
                  return (
                    <div key={id} style={{ width: 24, height: 24, borderRadius: '50%', background: d.hueColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                      {d.initials}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {todaysTrainings.length === 0 && (
          <div style={{ border: '1px dashed var(--border-light)', padding: 24, width: 260, color: 'var(--muted-3)', fontSize: 13 }}>No trainings scheduled today.</div>
        )}
      </div>

      {myUpcomingGalas.length > 0 && (
        <>
          <div className="label" style={{ fontSize: 18, marginBottom: 14 }}>YOUR UPCOMING GALAS</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 36 }}>
            {myUpcomingGalas.map((g) => (
              <div
                key={g.id}
                onClick={() => setSelectedGalaId(g.id)}
                className="card"
                style={{ borderTop: `4px solid ${GALA_COLOR}`, width: 260, padding: 18, cursor: 'pointer' }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: GALA_COLOR, marginBottom: 8 }}>
                  ★ {PARTICIPATION_META[myGalaParticipation[g.id]].label.toUpperCase()}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{g.name}</div>
                <div style={{ color: 'var(--muted-2)', fontSize: 13 }}>{dayFull(g.event_date)} · {g.location || 'Location TBD'}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {fighter && (
        <>
          <div className="label" style={{ fontSize: 18, marginBottom: 14 }}>TODAY'S MEALPLAN</div>
          <div className="card" style={{ padding: '18px 22px', marginBottom: 36 }}>
            {!followingPlan ? (
              <div style={{ fontSize: 13, color: 'var(--muted-3)' }}>
                You're not following a meal plan yet.{' '}
                <button onClick={() => navigate('/nutrition')} style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, fontSize: 13, textDecoration: 'underline' }}>
                  Pick one
                </button>
              </div>
            ) : followingPlanItems.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--muted-3)' }}>Nothing planned for today in "{followingPlan.name}".</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 12 }}>Following <strong style={{ color: 'var(--text)' }}>{followingPlan.name}</strong></div>
                {MEAL_GROUPS.map((group) => {
                  const item = followingPlanItems.find((it) => it.meal_group === group);
                  const name = item?.name?.trim() || item?.description?.trim();
                  if (!name) return null;
                  return (
                    <div key={group} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <div>
                        <span style={{ color: 'var(--muted-3)', fontSize: 11, marginRight: 8 }}>{MEAL_GROUP_META[group].label}</span>
                        {name}
                      </div>
                      {item?.calories != null && <span style={{ color: 'var(--muted-2)' }}>{item.calories} kcal</span>}
                    </div>
                  );
                })}
                <button className="btn-secondary" style={{ marginTop: 14, padding: '8px 16px', fontSize: 12 }} onClick={() => navigate('/nutrition')}>
                  Log these in Nutrition →
                </button>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: fighter ? '1.3fr 1fr' : '1fr', gap: 20 }}>
        {fighter && (
          <div className="card">
            <div className="label" style={{ fontSize: 18, marginBottom: 16 }}>WEIGHT PROGRESS</div>
            {hasGoal && chart ? (
              <>
                <svg width="100%" height="140" viewBox="0 0 400 140">
                  {chart.yTicks.map((t, i) => (
                    <g key={i}>
                      <line x1={38} y1={t.pos} x2={390} y2={t.pos} stroke="oklch(0.28 0.012 40)" strokeWidth="1" />
                      <text x={34} y={t.pos + 3} fontSize="9" fill="oklch(0.55 0.01 40)" textAnchor="end">{t.label}</text>
                    </g>
                  ))}
                  <path d={chart.goalPath} stroke="oklch(0.5 0.01 40)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                  <path d={chart.linePath} stroke="oklch(0.58 0.2 25)" strokeWidth="2.5" fill="none" />
                  {chart.dots.map((d, i) => (
                    <circle key={i} cx={d.x} cy={d.y} r="3" fill="oklch(0.58 0.2 25)">
                      <title>{dayFull(d.date)}: {d.weight} kg</title>
                    </circle>
                  ))}
                </svg>
                <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 13, color: 'var(--muted-2)' }}>
                  <div>Current: <strong style={{ color: 'var(--text)' }}>{status!.current} kg</strong></div>
                  <div>Goal: <strong style={{ color: 'var(--text)' }}>{activeGoal!.target_weight_kg} kg</strong></div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--muted-3)' }}>
                No goal set yet.{' '}
                <button onClick={() => navigate('/weight')} style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, fontSize: 13, textDecoration: 'underline' }}>
                  Set your goal
                </button>
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '18px 22px', flex: 1 }}>
            <div className="heading" style={{ fontSize: 32 }}>{weekTrainingCount}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-3)', letterSpacing: '0.5px' }}>TRAININGS THIS WEEK</div>
          </div>
          {fighter && (
            <>
              <div className="card" style={{ padding: '18px 22px', flex: 1 }}>
                <div className="heading" style={{ fontSize: 32 }}>{caloriesToday}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-3)', letterSpacing: '0.5px' }}>CALORIES LOGGED TODAY</div>
              </div>
              <div className="card" style={{ padding: '18px 22px', flex: 1 }}>
                <div className="heading" style={{ fontSize: 32 }}>{status ? status.daysLeft : '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-3)', letterSpacing: '0.5px' }}>DAYS UNTIL GOAL DEADLINE</div>
              </div>
            </>
          )}
          {profile?.role === 'coach' && (
            <div className="card" style={{ padding: '18px 22px', flex: 1 }}>
              <div className="heading" style={{ fontSize: 32 }}>{fighterCount}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-3)', letterSpacing: '0.5px' }}>FIGHTERS COACHED</div>
            </div>
          )}
        </div>
      </div>

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

      {selectedGala && (
        <GalaDetailModal
          gala={selectedGala}
          directory={directory}
          onClose={() => setSelectedGalaId(null)}
          onGalaChanged={() => {
            refreshGalas();
            load();
          }}
        />
      )}
    </div>
  );
}
