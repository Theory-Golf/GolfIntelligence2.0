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

/**
 * Tournament names already in use by this player, their teammates, and the
 * players their coaches coach -- most-used first.
 *
 * This goes through an RPC rather than a select because a player cannot read a
 * teammate's rounds: `rounds_select` is `can_access_player(player_id)`, which
 * only ever answers coach -> player. The function behind it is `security
 * definer` and returns names and counts, nothing else.
 */
export async function getTournamentSuggestions(): Promise<string[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.rpc('tournament_name_suggestions');
  if (error) throw error;
  return ((data ?? []) as Array<{ name: string }>).map((r) => r.name);
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
