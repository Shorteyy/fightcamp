import { useEffect } from 'react';

// Module-level so stacked modals (one modal opening another) don't unlock
// the page until the last one actually closes.
let lockCount = 0;

// The app shell's own scroll container (.app-content — see AppShell.tsx)
// stays scrollable behind a position:fixed modal backdrop on mobile even
// though it visually sits underneath it (a well-known iOS/Android touch-
// scroll quirk) — locking just document.body isn't enough. Call this from
// every modal component; pass `enabled` for modals whose JSX is embedded
// inline in a page rather than only mounted while open.
export function useModalScrollLock(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const scrollRegion = document.querySelector<HTMLElement>('.app-content');
    if (lockCount === 0) {
      document.body.style.overflow = 'hidden';
      if (scrollRegion) scrollRegion.style.overflow = 'hidden';
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = '';
        if (scrollRegion) scrollRegion.style.overflow = '';
      }
    };
  }, [enabled]);
}
