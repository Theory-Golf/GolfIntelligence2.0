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

export interface CourseRow {
  id: string;
  /** Null for a course a player added for themselves. */
  school_id: string | null;
  /** Nullable in the database: a school course has no owning player. */
  player_id: string | null;
  created_by: string | null;
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
  // NOTE: rounds.course_id is NOT NULL in the database, but the round-entry
  // flow and roundSession both handle a null course. In practice the flow
  // always creates or matches a course before submit, so the two have never
  // disagreed at runtime. Typed nullable here to match the code that exists;
  // whether a course-less round should be allowed is a product decision, and
  // resolving it means changing one side or the other deliberately.
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
  weather_precip_type: string | null;
  /** Team the player belongs to now. Unused until team features land. */
  current_team_id: string | null;
  /** Team the player belonged to when the round was played. */
  team_id_at_round: string | null;
  course_difficulty: string | null;
  notes: string | null;
  /** Set when the round is submitted from review. Defaults false. */
  is_complete: boolean;
  synced_at: string | null;
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

// Columns the database fills in, or that carry a default -- omitted from the
// insert shape and re-added as optional, so adding a column to a Row type
// never forces every call site to start passing it explicitly.
type CourseOptionalOnInsert = 'school_id' | 'created_by';
type RoundOptionalOnInsert =
  | 'weather_precip_type'
  | 'current_team_id'
  | 'team_id_at_round'
  | 'course_difficulty'
  | 'notes'
  | 'is_complete'
  | 'synced_at';

export type CourseInsert =
  Omit<CourseRow, 'created_at' | 'updated_at' | CourseOptionalOnInsert> &
  Partial<Pick<CourseRow, CourseOptionalOnInsert>>;

export type RoundInsert =
  Omit<RoundRow, 'created_at' | 'updated_at' | RoundOptionalOnInsert> &
  Partial<Pick<RoundRow, RoundOptionalOnInsert>>;
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

/** One drill's activity rolled up across all of a player's sessions. */
export interface DrillActivitySummary {
  drillType: DrillType;
  count: number;
  /** ISO timestamp of the most recent session. */
  lastPlayed: string;
}

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
