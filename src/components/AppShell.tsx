import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'DASHBOARD' },
  { to: '/calendar', label: 'CALENDAR' },
  { to: '/galas', label: 'GALAS' },
  { to: '/fighters', label: 'TEAM' },
  { to: '/weight', label: 'WEIGHT & GOALS', fighterOnly: true },
  { to: '/nutrition', label: 'NUTRITION', fighterOnly: true },
];

export function AppShell() {
  const { profile, fighter, signOut } = useAuth();
  const isMobile = useIsMobile();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.fighterOnly && !fighter) return false;
    return true;
  });

  const initials = profile
    ? profile.full_name.trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)
    : '';

  const navLinkStyle = (isActive: boolean) => ({
    textAlign: 'left' as const,
    background: 'transparent',
    border: 'none',
    borderLeft: isMobile ? 'none' : `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
    padding: isMobile ? '0' : '12px 14px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: isMobile ? 11 : 16,
    letterSpacing: isMobile ? '1px' : '1.2px',
    color: isActive ? 'var(--text)' : 'var(--muted-1)',
    cursor: 'pointer',
    textDecoration: 'none',
    display: isMobile ? 'flex' : 'block',
    flexDirection: 'column' as const,
    alignItems: 'center',
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {!isMobile && (
        <div style={{ width: 240, minWidth: 240, height: '100%', background: 'var(--panel)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '32px 20px', gap: 4 }}>
          <div className="heading" style={{ fontSize: 26, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
            <span style={{ width: 10, height: 10, background: 'var(--accent)', display: 'inline-block' }} />
            FIGHT CAMP
          </div>
          {visibleItems.map((item) => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => navLinkStyle(isActive)}>
              {item.label}
            </NavLink>
          ))}
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `oklch(0.62 0.16 ${profile?.avatar_hue ?? 0})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-3)' }}>{profile?.role === 'coach' ? 'Coach' : 'Fighter'}</div>
            </div>
            <button onClick={signOut} title="Log out" className="btn-secondary" style={{ padding: '6px 10px', fontSize: 11 }}>
              OUT
            </button>
          </div>
        </div>
      )}

      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: 'var(--panel)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 150 }}>
          {visibleItems.map((item) => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => navLinkStyle(isActive)}>
              {item.label}
            </NavLink>
          ))}
        </div>
      )}

      <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: isMobile ? '24px 20px 100px 20px' : '36px 40px 100px 40px', position: 'relative' }}>
        <Outlet />
      </div>
    </div>
  );
}
