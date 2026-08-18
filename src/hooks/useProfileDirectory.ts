import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hueColor, initialsOf } from '../lib/avatar';

export interface DirectoryEntry {
  id: string;
  name: string;
  initials: string;
  hueColor: string;
}

// `profiles` is readable by every authenticated user (unlike `fighters`, which is
// RLS-restricted to the owner + coaches), so this is the source for rendering
// anyone's name/avatar anywhere in the app (attendee lists, etc.).
export function useProfileDirectory() {
  const [directory, setDirectory] = useState<Record<string, DirectoryEntry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, full_name, avatar_hue')
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, DirectoryEntry> = {};
        for (const row of data) {
          map[row.id] = { id: row.id, name: row.full_name, initials: initialsOf(row.full_name), hueColor: hueColor(row.avatar_hue) };
        }
        setDirectory(map);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { directory, loading };
}
