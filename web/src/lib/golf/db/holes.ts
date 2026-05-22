import { createBrowserClient } from './client';
import type { HoleInsert, HoleRow, HoleUpdate } from './types';

export async function getHolesForRound(roundId: string): Promise<HoleRow[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('holes')
    .select('*')
    .eq('round_id', roundId)
    .order('hole_number', { ascending: true });
  if (error) throw error;
  return data;
}

export async function upsertHole(hole: HoleInsert): Promise<HoleRow> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('holes')
    .upsert(hole)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHole(hole: HoleUpdate): Promise<HoleRow> {
  const supabase = createBrowserClient();
  const { id, ...fields } = hole;
  const { data, error } = await supabase
    .from('holes')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
