import type { TrainingType } from '../types/database';

export const TRAINING_TYPE_META: Record<TrainingType, { label: string; color: string; abbr: string }> = {
  kickboxing: { label: 'Kickboxing', color: 'oklch(0.58 0.2 25)', abbr: 'KB' },
  running: { label: 'Running', color: 'oklch(0.68 0.15 145)', abbr: 'RUN' },
  swimming: { label: 'Swimming', color: 'oklch(0.65 0.13 230)', abbr: 'SWM' },
  strength: { label: 'Strength', color: 'oklch(0.78 0.15 90)', abbr: 'STR' },
  recovery: { label: 'Recovery', color: 'oklch(0.65 0.13 300)', abbr: 'REC' },
};

export const TRAINING_TYPES = Object.keys(TRAINING_TYPE_META) as TrainingType[];

export const MEAL_GROUP_META: Record<string, { label: string }> = {
  breakfast: { label: 'BREAKFAST' },
  lunch: { label: 'LUNCH' },
  dinner: { label: 'DINNER' },
  snack: { label: 'SNACKS' },
};

export const MEAL_GROUPS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
