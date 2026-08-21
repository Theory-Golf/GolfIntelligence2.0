import { createBrowserClient } from '@/lib/golf/db/client';
import type {
  DrillActivitySummary,
  DrillSessionInput,
  DrillSessionInsert,
  DrillSessionRow,
} from './types';

/**
 * Resolve the signed-in player. Practice rows are keyed to `auth.uid()`:
 * `drill_sessions.player_id` references `auth.users`, and while
 * `rounds.player_id` references `players`, every `players.id` is its auth
 * user's id — so the same UUID identifies a player on both sides.
 */
export async function getCurrentPlayerId(): Promise<string | null> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

/** Attach the current player to an input row. Throws if signed out. */
export async function withPlayerId(input: DrillSessionInput): Promise<DrillSessionInsert> {
  const playerId = await getCurrentPlayerId();
  if (!playerId) throw new Error('Not signed in — cannot save practice result.');
  return { ...input, player_id: playerId };
}

/**
 * Write a practice result.
 *
 * Upserts on the (player_id, drill_type, client_id) unique constraint, so
 * this is safe to call more than once for the same session — a retry after a
 * failed request, an offline-queue flush, or a re-run of the local-history
 * upload all update the existing row rather than adding another.
 */
export async function saveDrillSession(row: DrillSessionInsert): Promise<DrillSessionRow> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('drill_sessions')
    .upsert(row, { onConflict: 'player_id,drill_type,client_id' })
    .select()
    .single();
  if (error) throw error;
  return data as DrillSessionRow;
}

/** Same as saveDrillSession but resolves the player first. */
export async function saveDrillSessionForCurrentPlayer(
  input: DrillSessionInput,
): Promise<DrillSessionRow> {
  return saveDrillSession(await withPlayerId(input));
}

/**
 * A player's results, newest first. Omit `drillType` for every drill.
 *
 * RLS scopes this to the caller — self, or a player on a team the caller
 * coaches — so no player filter is applied here.
 */
export async function getDrillSessions(
  drillType?: string,
  limit = 100,
): Promise<DrillSessionRow[]> {
  const supabase = createBrowserClient();
  let query = supabase
    .from('drill_sessions')
    .select('*')
    .order('played_at', { ascending: false })
    .limit(limit);
  if (drillType) query = query.eq('drill_type', drillType);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DrillSessionRow[];
}

/**
 * Recency and volume per drill, for the practice progress strip.
 *
 * Deliberately returns no score: each game scores itself, and there is no
 * cross-game scale to put them on.
 */
export async function getRecentDrillActivity(): Promise<DrillActivitySummary[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('drill_sessions')
    .select('drill_type, played_at')
    .order('played_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const byType = new Map<string, DrillActivitySummary>();
  for (const row of (data ?? []) as Pick<DrillSessionRow, 'drill_type' | 'played_at'>[]) {
    const existing = byType.get(row.drill_type);
    if (existing) {
      existing.count += 1;
    } else {
      // Rows arrive newest-first, so the first one seen is the latest.
      byType.set(row.drill_type, {
        drillType: row.drill_type,
        count: 1,
        lastPlayed: row.played_at,
      });
    }
  }
  return [...byType.values()].sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed));
}
