import { createBrowserClient } from './client';
import type {
  DrillActivitySummary,
  DrillSessionInsert,
  DrillSessionRow,
  DrillType,
} from './types';

export async function upsertDrillSession(
  session: DrillSessionInsert,
): Promise<DrillSessionRow> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('drill_sessions')
    .upsert(session, { onConflict: 'player_id,drill_type,client_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDrillSessionsByPlayer(
  playerId: string,
  drillType: DrillType,
  limit = 200,
): Promise<DrillSessionRow[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('drill_sessions')
    .select('*')
    .eq('player_id', playerId)
    .eq('drill_type', drillType)
    .order('played_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function deleteDrillSession(target: {
  player_id: string;
  drill_type: DrillType;
  client_id: string;
}): Promise<void> {
  const supabase = createBrowserClient();
  const { error } = await supabase
    .from('drill_sessions')
    .delete()
    .eq('player_id', target.player_id)
    .eq('drill_type', target.drill_type)
    .eq('client_id', target.client_id);
  if (error) throw error;
}

/**
 * Roll up every drill the signed-in player has logged: how many sessions each
 * has, and when it was last played. Powers the practice overview, which needs
 * one row per drill rather than every session of one drill.
 *
 * Deliberately unfiltered by player — RLS on `drill_sessions` restricts the
 * select to the caller's own rows, so passing an id would add nothing but a
 * way to get it wrong.
 */
export async function getRecentDrillActivity(): Promise<DrillActivitySummary[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('drill_sessions')
    .select('drill_type, played_at')
    .order('played_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const byType = new Map<DrillType, DrillActivitySummary>();
  for (const row of (data ?? []) as Pick<DrillSessionRow, 'drill_type' | 'played_at'>[]) {
    const existing = byType.get(row.drill_type);
    if (existing) {
      existing.count += 1;
    } else {
      // Rows arrive newest-first, so the first one seen is the latest.
      byType.set(row.drill_type, { drillType: row.drill_type, count: 1, lastPlayed: row.played_at });
    }
  }
  return [...byType.values()].sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed));
}
