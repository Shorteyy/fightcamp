export type UserRole = 'coach' | 'fighter';
export type TrainingType = 'kickboxing' | 'running' | 'swimming' | 'strength' | 'recovery';
export type MealGroup = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type GalaParticipationType = 'attending' | 'attending_vip' | 'fighting' | 'cornering';
export type GoalStatus = 'active' | 'achieved' | 'abandoned';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  avatar_hue: number;
  created_at: string;
}

export interface Fighter {
  profile_id: string;
  daily_calorie_target: number;
  created_at: string;
}

export interface Goal {
  id: string;
  fighter_id: string;
  target_weight_kg: number;
  deadline: string | null;
  gala_id: string | null;
  status: GoalStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
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

export interface MealPlan {
  id: string;
  name: string;
  owner_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MealPlanItem {
  id: string;
  meal_plan_id: string;
  day_of_week: number;
  meal_group: MealGroup;
  description: string;
}

export interface Gala {
  id: string;
  name: string;
  event_date: string;
  location: string;
  notes: string;
  poster_url: string | null;
  created_by: string;
  created_at: string;
}

export interface GalaParticipant {
  gala_id: string;
  profile_id: string;
  participation_type: GalaParticipationType;
  created_at: string;
}

