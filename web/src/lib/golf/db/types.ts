export type Lie =
  | 'Tee'
  | 'Fairway'
  | 'Rough'
  | 'Sand'
  | 'Recovery'
  | 'Green';

export type RoundType = 'Practice' | 'Qualifying' | 'Tournament';

export type ClubCategory = 'Driver' | 'Non-driver';

export type MissDirection = 'Left' | 'Right';

export type PuttDirection = 'Long' | 'Short';

export type ShotSegment =
  | 'Drive'
  | 'Approach'
  | 'ShortGame'
  | 'Recovery'
  | 'Putt'
  | 'Other';

export interface CourseRow {
  id: string;
  player_id: string;
  name: string;
  par_hole_1: number;
  par_hole_2: number;
  par_hole_3: number;
  par_hole_4: number;
  par_hole_5: number;
  par_hole_6: number;
  par_hole_7: number;
  par_hole_8: number;
  par_hole_9: number;
  par_hole_10: number;
  par_hole_11: number;
  par_hole_12: number;
  par_hole_13: number;
  par_hole_14: number;
  par_hole_15: number;
  par_hole_16: number;
  par_hole_17: number;
  par_hole_18: number;
  created_at: string;
  updated_at: string;
}

export interface RoundRow {
  id: string;
  player_id: string;
  course_id: string | null;
  played_on: string;
  round_type: RoundType;
  round_number: number | null;
  location_city: string | null;
  location_state: string | null;
  weather_temp_f: number | null;
  weather_wind_mph: number | null;
  weather_wind_dir: string | null;
  weather_precip: number | null;
  created_at: string;
  updated_at: string;
}

export interface HoleRow {
  id: string;
  round_id: string;
  hole_number: number;
  par: number;
  created_at: string;
  updated_at: string;
}

export interface ShotRow {
  id: string;
  hole_id: string;
  shot_number: number;
  starting_lie: Lie;
  starting_distance: number;
  ending_lie: Lie;
  ending_distance: number;
  has_penalty: boolean;
  club_category: ClubCategory | null;
  miss_direction: MissDirection | null;
  putt_long_short: PuttDirection | null;
  created_at: string;
  updated_at: string;
}

export type CourseInsert = Omit<CourseRow, 'created_at' | 'updated_at'>;
export type RoundInsert = Omit<RoundRow, 'created_at' | 'updated_at'>;
export type HoleInsert = Omit<HoleRow, 'created_at' | 'updated_at'>;
export type ShotInsert = Omit<ShotRow, 'created_at' | 'updated_at'>;

export type RoundUpdate = Partial<RoundInsert> & { id: string };
export type HoleUpdate = Partial<HoleInsert> & { id: string };
export type ShotUpdate = Partial<ShotInsert> & { id: string };

export type DrillType =
  | 'inside-ten'
  | 'inside-twenty'
  | 'winners-circle'
  | 'lag-putt-test'
  | 'line-test'
  | 'driver-standard'
  | 'wedge-standard'
  | 'approach-standard'
  | 'round-simulation'
  | 'practice-planner';

export interface DrillSessionRow {
  id: string;
  player_id: string;
  drill_type: DrillType;
  payload: unknown;
  client_id: string;
  played_at: string;
  created_at: string;
  updated_at: string;
}

export type DrillSessionInsert = Omit<DrillSessionRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export interface DrillSessionDelete {
  player_id: string;
  drill_type: DrillType;
  client_id: string;
}
