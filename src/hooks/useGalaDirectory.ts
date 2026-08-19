import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Gala } from '../types/database';

export function useGalaDirectory() {
  const [galasById, setGalasById] = useState<Record<string, Gala>>({});
  const [galas, setGalas] = useState<Gala[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('galas').select('*').order('event_date');
    const rows = (data ?? []) as Gala[];
    setGalas(rows);
    const map: Record<string, Gala> = {};
    for (const g of rows) map[g.id] = g;
    setGalasById(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { galas, galasById, loading, refresh: load };
}
