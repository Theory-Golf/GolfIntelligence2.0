'use client';

import { LS_INSIDE_TEN_SESSIONS, LS_INSIDE_TWENTY_SESSIONS } from '@/lib/constants';
import { createBrowserClient } from './db/client';
import { upsertDrillSession } from './db/drillSessions';
import type { DrillType } from './db/types';

interface DrillMigrationConfig {
  drillType: DrillType;
  lsKey: string;
  getId: (session: unknown) => string;
  getPlayedAt: (session: unknown) => string;
}

// One entry per drill that has been migrated to Supabase sync (see
// useDrillHistory). Add a drill here in the same change that switches it
// over from raw localStorage reads/writes to the shared hook.
const MIGRATABLE_DRILLS: DrillMigrationConfig[] = [
  {
    drillType: 'inside-ten',
    lsKey: LS_INSIDE_TEN_SESSIONS,
    getId: (s) => (s as { id: string }).id,
    getPlayedAt: (s) => (s as { date: string }).date,
  },
  {
    drillType: 'inside-twenty',
    lsKey: LS_INSIDE_TWENTY_SESSIONS,
    getId: (s) => (s as { id: string }).id,
    getPlayedAt: (s) => (s as { date: string }).date,
  },
];

function migratedKey(lsKey: string): string {
  return `${lsKey}:synced-v1`;
}

async function migrateOne(config: DrillMigrationConfig, playerId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const marker = migratedKey(config.lsKey);
  if (window.localStorage.getItem(marker)) return;

  const raw = window.localStorage.getItem(config.lsKey);
  if (!raw) {
    window.localStorage.setItem(marker, new Date().toISOString());
    return;
  }

  try {
    const store = JSON.parse(raw) as { sessions: unknown[] };
    const sessions = Array.isArray(store.sessions) ? store.sessions : [];
    for (const session of sessions) {
      await upsertDrillSession({
        player_id: playerId,
        drill_type: config.drillType,
        client_id: config.getId(session),
        played_at: config.getPlayedAt(session),
        payload: session,
      });
    }
    window.localStorage.setItem(marker, new Date().toISOString());
  } catch (err) {
    console.error(`[drillHistoryMigration] failed for ${config.drillType}`, err);
    // Leave the marker unset so this retries on the next sign-in.
  }
}

// Uploads any pre-existing local-only drill history to Supabase, once per
// drill per browser. Safe to call on every sign-in — each drill's marker
// short-circuits repeat work, and the drill_sessions unique constraint on
// (player_id, drill_type, client_id) makes the upsert idempotent even if
// the marker write itself is interrupted.
export async function migrateLocalDrillHistory(): Promise<void> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getUser();
  const playerId = data.user?.id;
  if (!playerId) return;
  await Promise.all(MIGRATABLE_DRILLS.map((config) => migrateOne(config, playerId)));
}
