'use client';

import { persistOrQueue, type PersistResult } from '@/lib/golf/offlineQueue';
import { withPlayerId } from './db';
import type { DrillSessionInput, DrillType } from './db';

/**
 * Record a practice result. This is the one call a game makes.
 *
 * Writes straight through when online, and queues to the offline queue when
 * the request fails or the device is offline — which happens constantly at a
 * range. Either way the write is idempotent: the row upserts on
 * (player_id, drill_type, client_id), so a queued retry updates rather than
 * duplicates.
 *
 * Signed-out callers get `queued-error` rather than a throw, so a game never
 * loses a result it just finished collecting — it stays in localStorage and
 * uploads once the player signs in.
 */
export async function recordDrillSession(input: DrillSessionInput): Promise<PersistResult> {
  try {
    const row = await withPlayerId(input);
    return persistOrQueue({ type: 'upsertDrillSession', payload: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'queued-error', message };
  }
}

/**
 * Build the input for a result. `clientId` must be stable for the session —
 * generate it when the session starts, keep it with the local copy, and pass
 * the same value on every retry.
 */
export function drillSessionInput(
  drillType: DrillType,
  clientId: string,
  playedAt: string | Date,
  payload: Record<string, unknown>,
): DrillSessionInput {
  return {
    drill_type: drillType,
    client_id: clientId,
    played_at: typeof playedAt === 'string' ? playedAt : playedAt.toISOString(),
    payload,
  };
}
