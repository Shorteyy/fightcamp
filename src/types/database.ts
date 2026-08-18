export type UserRole = 'coach' | 'fighter';
export type TrainingType = 'kickboxing' | 'running' | 'swimming' | 'strength' | 'recovery';
export type MealGroup = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  avatar_hue: number;
  created_at: string;
}

export interface Fighter {
  profile_id: string;
  goal_weight_kg: number | null;
  goal_deadline: string | null;
  daily_calorie_target: number;
  created_at: string;
}

export interface WeightEntry {
  id: string;
  fighter_id: string;
  entry_date: string;
  weight_kg: number;
  created_at: string;
}

export interface Training {
  id: string;
  type: TrainingType;
  title: string;
  training_date: string;
  start_time: string;
  location: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface TrainingAttendee {
  training_id: string;
  fighter_id: string;
  joined_at: string;
}

export interface MealEntry {
  id: string;
  fighter_id: string;
  entry_date: string;
  meal_group: MealGroup;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
}

export interface MealPlanEntry {
  id: string;
  fighter_id: string;
  day_of_week: number;
  meal_group: MealGroup;
  description: string;
}

