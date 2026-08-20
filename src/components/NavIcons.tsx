// Small hand-rolled line icons for the mobile bottom nav — the app has no
// icon library and these six are simple enough not to warrant adding one.
// All use currentColor so they inherit the nav link's active/inactive color.
interface IconProps {
  size?: number;
}

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function HouseIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M3.5 11.5 12 4l8.5 7.5" />
      <path d="M5.5 10v9.5a1 1 0 0 0 1 1h4v-6.5h3v6.5h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

export function CalendarIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3.2v3.6M16 3.2v3.6M3.5 9.8h17" />
    </svg>
  );
}

export function TicketIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M3 8.5a1.8 1.8 0 0 1 1.8-1.8h14.4A1.8 1.8 0 0 1 21 8.5v1.8a1.8 1.8 0 0 0 0 3.4v1.8a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 15.5v-1.8a1.8 1.8 0 0 0 0-3.4Z" />
      <path d="M13.5 6.7v10.6" strokeDasharray="2.2 2.2" />
    </svg>
  );
}

export function PeopleIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.3 20c.4-3.8 2.9-6.3 6.2-6.3s5.8 2.5 6.2 6.3" />
      <circle cx="17.2" cy="8.8" r="2.3" />
      <path d="M15.3 13.9c2.3.4 4 2.3 4.3 5.3" />
    </svg>
  );
}

export function DumbbellIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect x="1.5" y="9" width="3" height="6" rx="1" />
      <rect x="19.5" y="9" width="3" height="6" rx="1" />
      <rect x="5.5" y="10.3" width="3" height="3.4" rx="0.6" />
      <rect x="15.5" y="10.3" width="3" height="3.4" rx="0.6" />
      <path d="M8.5 12h7" />
    </svg>
  );
}

export function UtensilsIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M6 2.5v6.3M8.5 2.5v6.3M6 8.8c0 2 1.1 3 2.5 3v9.7" />
      <path d="M17 2.5c-2 .4-3 3-3 6s1 5.2 3 5.6v7.4" />
    </svg>
  );
}
