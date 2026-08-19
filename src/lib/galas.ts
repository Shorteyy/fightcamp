import type { GalaParticipationType } from '../types/database';

export const PARTICIPATION_META: Record<GalaParticipationType, { label: string; color: string }> = {
  attending: { label: 'Attending', color: 'oklch(0.68 0.15 145)' },
  attending_vip: { label: 'Attending VIP', color: 'oklch(0.78 0.15 90)' },
  fighting: { label: 'Fighting', color: 'oklch(0.58 0.2 25)' },
  cornering: { label: 'Cornering', color: 'oklch(0.65 0.13 230)' },
};

export const PARTICIPATION_TYPES: GalaParticipationType[] = ['attending', 'attending_vip', 'fighting', 'cornering'];

// Distinct from every training-type color (red/green/blue/gold/purple) so galas read as events, not sessions.
export const GALA_COLOR = 'oklch(0.68 0.19 350)';
