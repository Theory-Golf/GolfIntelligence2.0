'use client';

/**
 * One-time upload of practice history that predates account sync.
 *
 * Every game wrote to localStorage before results were stored per player, so
 * a player arriving on a synced build has history on the device that the
 * database has never seen. This pushes it up once.
 *
 * Safety rests entirely on `client_id`: each adapter derives it exactly the
 * way that game's live write path does, and `drill_sessions` is unique on
 * (player_id, drill_type, client_id). So a session that has already synced
 * updates its row rather than adding a second copy — which means a re-run,
 * an interrupted run, or a run racing a live write are all harmless.
 */

import {
  LS_INSIDE_TEN_SESSIONS,
  LS_INSIDE_TWENTY_SESSIONS,
  LS_LAG_PUTT_SESSIONS,
  LS_LINE_TEST_SESSIONS,
  LS_PUTTING_SESSIONS,
  LS_WINNERS_CIRCLE_RUNS,
  LS_DRIVER_STANDARD,
  LS_WEDGE_STANDARD_HISTORY,
  LS_APPROACH_STANDARD_SESSIONS,
  LS_PRACTICE_SESSIONS,
  LS_PRACTICE_MIGRATED,
} from '@/lib/constants';
import { derivedClientId } from './clientId';
import { getCurrentPlayerId } from './db';
import { saveDrillSession } from './db';
import type { DrillSessionInsert, DrillType } from './db';

type Row = Record<string, unknown>;

function readJSON(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Sessions are stored either as a bare array or wrapped as {version, sessions|runs}. */
function readList(key: string, wrappedField?: string): Row[] {
  const parsed = readJSON(key);
  if (Array.isArray(parsed)) return parsed as Row[];
  if (parsed && typeof parsed === 'object' && wrappedField) {
    const inner = (parsed as Row)[wrappedField];
    if (Array.isArray(inner)) return inner as Row[];
  }
  return [];
}

function iso(value: unknown, fallback?: unknown): string {
  if (typeof value === 'string' && value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof value === 'number' && value > 0) return new Date(value).toISOString();
  if (fallback !== undefined) return iso(fallback);
  return new Date().toISOString();
}

type Adapter = {
  drillType: DrillType;
  read: () => Row[];
  /** Must match the game's live write path exactly, or rows duplicate. */
  clientId: (row: Row) => string | null;
  playedAt: (row: Row) => string;
};

const ADAPTERS: Adapter[] = [
  {
    drillType: 'inside-ten',
    read: () => readList(LS_INSIDE_TEN_SESSIONS, 'sessions'),
    clientId: (r) => (typeof r.id === 'string' ? r.id : null),
    playedAt: (r) => iso(r.timestamp, r.date),
  },
  {
    drillType: 'inside-twenty',
    read: () => readList(LS_INSIDE_TWENTY_SESSIONS, 'sessions'),
    clientId: (r) => (typeof r.id === 'string' ? r.id : null),
    playedAt: (r) => iso(r.timestamp, r.date),
  },
  {
    drillType: 'winners-circle',
    read: () => readList(LS_WINNERS_CIRCLE_RUNS, 'runs'),
    clientId: (r) => (typeof r.id === 'string' ? r.id : null),
    playedAt: (r) => iso(r.timestamp, r.date),
  },
  {
    drillType: 'lag-putt-test',
    read: () => readList(LS_LAG_PUTT_SESSIONS),
    // Sessions saved on a synced build already carry a clientId; older ones
    // are keyed on Date.now() and get the derived value the game would use.
    clientId: (r) =>
      typeof r.clientId === 'string' && r.clientId
        ? r.clientId
        : r.id != null
          ? derivedClientId('lag-putt-test', r.id as string | number)
          : null,
    playedAt: (r) => iso(r.date, r.id),
  },
  {
    drillType: 'line-test',
    read: () => readList(LS_LINE_TEST_SESSIONS),
    clientId: (r) =>
      typeof r.session_id === 'string' ? derivedClientId('line-test', r.session_id) : null,
    playedAt: (r) => iso(r.timestamp),
  },
  {
    drillType: 'wedge-standard',
    read: () => readList(LS_WEDGE_STANDARD_HISTORY),
    clientId: (r) =>
      r.id != null ? derivedClientId('wedge-standard', r.id as string | number) : null,
    playedAt: (r) => iso(r.date, r.id),
  },
  {
    drillType: 'approach-standard',
    read: () => readList(LS_APPROACH_STANDARD_SESSIONS),
    clientId: (r) =>
      typeof r.id === 'string' ? derivedClientId('approach-standard', r.id) : null,
    playedAt: (r) => iso(r.completedAt, r.startedAt),
  },
  {
    drillType: 'driver-standard',
    // Driver Standard keeps its history nested inside one state blob.
    read: () => {
      const parsed = readJSON(LS_DRIVER_STANDARD);
      if (parsed && typeof parsed === 'object') {
        const history = (parsed as Row).history;
        if (Array.isArray(history)) return history as Row[];
      }
      return [];
    },
    clientId: (r) =>
      r.timestamp != null
        ? derivedClientId('driver-standard', r.timestamp as string | number)
        : null,
    playedAt: (r) => iso(r.timestamp),
  },
  {
    drillType: 'round-simulation',
    read: () => readList(LS_PUTTING_SESSIONS),
    clientId: (r) =>
      r.id != null ? derivedClientId('round-simulation', r.id as string | number) : null,
    playedAt: (r) => iso(r.date, r.id),
  },
  {
    // Completed sessions from The Plan, stored by PracticePlanner/storage.ts.
    drillType: 'practice-session',
    read: () => readList(LS_PRACTICE_SESSIONS),
    clientId: (r) =>
      typeof r.id === 'string' ? derivedClientId('practice-session', r.id) : null,
    playedAt: (r) => iso(r.completedAt, r.date),
  },
];

export type MigrationResult = {
  uploaded: number;
  skipped: number;
  failed: number;
};

/**
 * Upload local practice history for the signed-in player, once.
 *
 * Returns null when there is nothing to do — signed out, already migrated,
 * or no local history. Writes directly rather than through the offline queue:
 * this is a bulk backfill, and a failure just means it retries next load.
 */
export async function migrateLocalHistory(): Promise<MigrationResult | null> {
  if (typeof window === 'undefined') return null;
  try {
    if (window.localStorage.getItem(LS_PRACTICE_MIGRATED)) return null;
  } catch {
    return null;
  }

  const playerId = await getCurrentPlayerId();
  if (!playerId) return null;

  const result: MigrationResult = { uploaded: 0, skipped: 0, failed: 0 };

  for (const adapter of ADAPTERS) {
    let rows: Row[] = [];
    try {
      rows = adapter.read();
    } catch {
      continue;
    }
    for (const row of rows) {
      const clientId = adapter.clientId(row);
      if (!clientId) {
        result.skipped += 1;
        continue;
      }
      const insert: DrillSessionInsert = {
        player_id: playerId,
        drill_type: adapter.drillType,
        client_id: clientId,
        played_at: adapter.playedAt(row),
        payload: row,
      };
      try {
        await saveDrillSession(insert);
        result.uploaded += 1;
      } catch (err) {
        console.error('[migrateLocalHistory]', adapter.drillType, err);
        result.failed += 1;
      }
    }
  }

  // Only mark done if nothing failed, so a partial run retries next load.
  // Re-uploading what already landed is harmless — client_id makes it an update.
  if (result.failed === 0) {
    try {
      window.localStorage.setItem(LS_PRACTICE_MIGRATED, new Date().toISOString());
    } catch {
      /* storage unavailable — retry next load */
    }
  }

  return result;
}
