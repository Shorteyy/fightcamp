import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Goal } from '../types/database';

// Keyed by fighter_id. RLS naturally scopes this to "my own active goal" for a
// fighter and "everyone's" for a coach — same self-or-coach policy as the rest
// of the schema, so no extra filtering needed here.
export function useActiveGoals() {
  const [goalsByFighter, setGoalsByFighter] = useState<Record<string, Goal>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('goals').select('*').eq('status', 'active');
    const map: Record<string, Goal> = {};
    for (const g of (data ?? []) as Goal[]) map[g.fighter_id] = g;
    setGoalsByFighter(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { goalsByFighter, loading, refresh: load };
}
