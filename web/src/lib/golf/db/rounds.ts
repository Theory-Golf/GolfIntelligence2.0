import { createBrowserClient } from './client';
import type { RoundInsert, RoundRow, RoundUpdate } from './types';

export async function getRound(roundId: string): Promise<RoundRow | null> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRoundsByPlayer(
  playerId: string,
  limit = 20,
): Promise<RoundRow[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('player_id', playerId)
    .order('played_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function upsertRound(round: RoundInsert): Promise<RoundRow> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('rounds')
    .upsert(round)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRound(round: RoundUpdate): Promise<RoundRow> {
  const supabase = createBrowserClient();
  const { id, ...fields } = round;
  const { data, error } = await supabase
    .from('rounds')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
