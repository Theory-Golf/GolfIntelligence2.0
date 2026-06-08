import { createBrowserClient } from './client';
import type { ShotInsert, ShotRow, ShotUpdate } from './types';

export async function getShotsForHole(holeId: string): Promise<ShotRow[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('shots')
    .select('*')
    .eq('hole_id', holeId)
    .order('shot_number', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getShotsForRound(roundId: string): Promise<ShotRow[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('shots')
    .select('*, holes!inner(hole_number, round_id)')
    .eq('holes.round_id', roundId)
    .order('holes(hole_number)', { ascending: true })
    .order('shot_number', { ascending: true });
  if (error) throw error;
  return data as ShotRow[];
}

export async function upsertShot(shot: ShotInsert): Promise<ShotRow> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('shots')
    .upsert(shot)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShot(shot: ShotUpdate): Promise<ShotRow> {
  const supabase = createBrowserClient();
  const { id, ...fields } = shot;
  const { data, error } = await supabase
    .from('shots')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShot(shotId: string): Promise<void> {
  const supabase = createBrowserClient();
  const { error } = await supabase.from('shots').delete().eq('id', shotId);
  if (error) throw error;
}
