import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hueColor, initialsOf } from '../lib/avatar';
import type { UserRole } from '../types/database';

export interface DirectoryEntry {
  id: string;
  name: string;
  initials: string;
  hueColor: string;
  role: UserRole;
}

// `profiles` is readable by every authenticated user (unlike `fighters`, which is
// RLS-restricted to the owner + coaches), so this is the source for rendering
// anyone's name/avatar/role anywhere in the app (attendee lists, etc.).
export function useProfileDirectory() {
  const [directory, setDirectory] = useState<Record<string, DirectoryEntry>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_hue, role');
    if (!data) return;
    const map: Record<string, DirectoryEntry> = {};
    for (const row of data) {
      map[row.id] = { id: row.id, name: row.full_name, initials: initialsOf(row.full_name), hueColor: hueColor(row.avatar_hue), role: row.role };
    }
    setDirectory(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { directory, loading, refresh: load };
}
