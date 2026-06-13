import { createBrowserClient } from './client';
import type { ClubCategory, Lie, MissDirection, PuttDirection, RoundType } from './types';

// One row of the dashboard_shots view: a shot denormalized with its hole,
// round, course, and player context. RLS on the underlying tables means a
// player receives only their own shots and a coach their whole team.
export interface DashboardShotRow {
  shot_id: string;
  player_id: string;
  player_name: string;
  round_id: string;
  played_on: string;
  round_type: RoundType;
  round_number: number | null;
  course_id: string | null;
  course_name: string;
  hole_id: string;
  hole_number: number;
  hole_par: number;
  shot_number: number;
  starting_lie: Lie;
  starting_distance: number;
  ending_lie: Lie;
  ending_distance: number;
  has_penalty: boolean;
  club_category: ClubCategory | null;
  miss_direction: MissDirection | null;
  putt_long_short: PuttDirection | null;
}

const PAGE_SIZE = 1000;

export async function fetchDashboardShots(): Promise<DashboardShotRow[]> {
  const supabase = createBrowserClient();
  const rows: DashboardShotRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('dashboard_shots')
      .select('*')
      .order('played_on', { ascending: true })
      .order('round_id', { ascending: true })
      .order('hole_number', { ascending: true })
      .order('shot_number', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as DashboardShotRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}
