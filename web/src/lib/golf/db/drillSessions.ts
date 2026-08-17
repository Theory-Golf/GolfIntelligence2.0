import { createBrowserClient } from './client';
import type { DrillSessionInsert, DrillSessionRow, DrillType } from './types';

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
