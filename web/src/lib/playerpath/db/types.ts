/**
 * PlayerPath practice persistence — types for the `drill_sessions` table.
 *
 * One row per practice result. Each game owns its own scoring logic and
 * writes its own shape into `payload`; nothing here interprets a score.
 */

/**
 * `drill_type` values. These are the activity ids from
 * `@/data/practiceActivities` so a row joins straight to the catalog, plus
 * `practice-session` for a completed plan session from PracticePlanner.
 *
 * Live data already uses `inside-ten`, `inside-twenty`, and `line-test` —
 * do not rename those.
 */
export const DRILL_TYPES = [
  'inside-ten',
  'inside-twenty',
  'winners-circle',
  'lag-putt-test',
  'line-test',
  'wedge-standard',
  'approach-standard',
  'driver-standard',
  'round-simulation',
  'practice-session',
] as const;

export type DrillType = (typeof DRILL_TYPES)[number];

export type DrillPayload = Record<string, unknown>;

export interface DrillSessionRow {
  id: string;
  player_id: string;
  drill_type: string;
  payload: DrillPayload;
  client_id: string;
  /** ISO timestamp */
  played_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * What a caller supplies. `player_id` is filled in from the session — the
 * insert policy requires it to equal `auth.uid()`, so callers never set it.
 *
 * `client_id` must be generated when the practice session is *created* on the
 * device, not when it is sent. It is the idempotency key: the table is unique
 * on (player_id, drill_type, client_id), so re-sending a queued write or
 * re-running the local-history upload updates the row instead of duplicating.
 */
export interface DrillSessionInput {
  drill_type: DrillType;
  payload: DrillPayload;
  client_id: string;
  played_at: string;
}

/** A row as sent to Supabase, with the player resolved. */
export interface DrillSessionInsert extends DrillSessionInput {
  player_id: string;
}

/** Per-drill recency, for the practice progress strip. Never a score. */
export interface DrillActivitySummary {
  drillType: string;
  count: number;
  lastPlayed: string;
}
