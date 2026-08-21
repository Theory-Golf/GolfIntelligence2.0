/**
 * Shared constants — localStorage keys, magic strings, etc.
 * Single source of truth to avoid scattered string literals.
 */

// ── Theme ──────────────────────────────────────────────────────────────
export const LS_THEME = 'tg-theme';

// ── Yardage Cards (shared between Standard & Weather) ──────────────────
export const LS_CLUBS = 'yc4_clubs';
export const LS_WEDGES = 'yc4_wedges';
export const LS_HOME_ZIP = 'yc4_homezip';

// ── Round Simulation ───────────────────────────────────────────────────
export const LS_PUTTING_SESSIONS = 'putting-sessions';
export const LS_PUTTING_PUTTERS = 'putting-putters';

// ── Lag Putt Test ──────────────────────────────────────────────────────
export const LS_LAG_PUTT_SESSIONS = 'lag-putt-sessions';

// ── Line Test ──────────────────────────────────────────────────────────
export const LS_LINE_TEST_SESSIONS = 'lineTest:sessions';

// ── Inside Ten (Putting Hub) ──────────────────────────────────
export const LS_INSIDE_TEN_SESSIONS = 'theory.golf:player-path:inside-ten:v1';

// Inside Twenty (Putting Hub)
export const LS_INSIDE_TWENTY_SESSIONS = 'theory.golf:player-path:inside-twenty:v1';

// Winners Circle (Putting Hub)
export const LS_WINNERS_CIRCLE_RUNS = 'theory.golf:player-path:winners-circle:v1';

// ── Standards tools ────────────────────────────────────────────────────
// These keys were hard-coded inside their components. The VALUES must not
// change — players have history stored under them, and the one-time upload
// in lib/playerpath/migrateLocal.ts reads them. New keys should follow the
// `theory.golf:player-path:<tool>:v1` convention above.
export const LS_DRIVER_STANDARD = 'driver-standard:v1';
export const LS_WEDGE_STANDARD_WEDGES = 'wm-wedges';
export const LS_WEDGE_STANDARD_LEVEL = 'wm-level';
export const LS_WEDGE_STANDARD_HISTORY = 'wm-history';
export const LS_WEDGE_STANDARD_STATS = 'wm-stats';
export const LS_WEDGE_STANDARD_CREATIVE = 'wm-creative';
export const LS_APPROACH_STANDARD_PLAYER = 'as_player';
export const LS_APPROACH_STANDARD_SESSIONS = 'as_sessions';

// ── Practice planner (The Plan) ────────────────────────────────────────
// Written by components/PracticePlanner/storage.ts under the tg_practice_
// prefix. Declared here so the one-time upload can read completed sessions.
export const LS_PRACTICE_SESSIONS = 'tg_practice_sessions';
export const LS_PRACTICE_CURRENT_SESSION = 'tg_practice_currentSession';

// ── Practice sync ──────────────────────────────────────────────────────
// Set once local practice history has been uploaded to the player's account.
export const LS_PRACTICE_MIGRATED = 'tg_practice_migrated_v1';
