'use client';

import { getDrillSessions } from './db';
import type { DrillSessionRow, DrillType } from './db';

/**
 * Merge a game's local history with the copy held in the player's account.
 *
 * Every game keeps its own local history list and, since practice results
 * started syncing, also writes each result to `drill_sessions`. Reading stayed
 * local-only, which meant a session played on a phone was invisible on a
 * laptop even though the row was in the database the whole time. This closes
 * that: local loads first so the list is instant and works offline, then the
 * account copy is folded in.
 *
 * Local entries win on conflict — a device's own record of a session it just
 * played is the freshest — and anything the account has that the device does
 * not is appended. Returns null when the account copy could not be fetched
 * (signed out, offline), so callers simply keep what they already showed.
 */
export async function syncDrillHistory<T>(opts: {
  drillType: DrillType;
  /** What the device already had. */
  local: T[];
  /** Rebuild the game's own session shape from a stored row. */
  hydrate: (row: DrillSessionRow) => T;
  /** Stable identity, so the same session from both sources collapses to one. */
  keyOf: (item: T) => string;
  /** Sort key, newest first. */
  sortKey: (item: T) => number;
}): Promise<T[] | null> {
  const { drillType, local, hydrate, keyOf, sortKey } = opts;

  let rows: DrillSessionRow[];
  try {
    rows = await getDrillSessions(drillType);
  } catch {
    return null; // signed out or offline — the local list stands
  }

  const merged = new Map<string, T>();
  for (const item of local) merged.set(keyOf(item), item);
  for (const row of rows) {
    let item: T;
    try {
      item = hydrate(row);
    } catch {
      continue; // a payload shape we no longer understand — skip it
    }
    const key = keyOf(item);
    if (!merged.has(key)) merged.set(key, item);
  }

  return [...merged.values()].sort((a, b) => sortKey(b) - sortKey(a));
}

/** Milliseconds from a stored `played_at`, falling back to 0. */
export function playedAtMs(row: DrillSessionRow): number {
  const t = Date.parse(row.played_at);
  return Number.isNaN(t) ? 0 : t;
}

/** `YYYY-MM-DD` from a stored row, preferring an explicit payload date. */
export function playedOnISO(row: DrillSessionRow): string {
  const d = row.payload?.date;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  return row.played_at.slice(0, 10);
}
