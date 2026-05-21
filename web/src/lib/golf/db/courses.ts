import { createBrowserClient } from './client';
import type { CourseInsert, CourseRow } from './types';

export async function getCoursesByPlayer(playerId: string): Promise<CourseRow[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('player_id', playerId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function upsertCourse(course: CourseInsert): Promise<CourseRow> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from('courses')
    .upsert(course)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCoursePar(
  courseId: string,
  holeNumber: number,
  par: number,
): Promise<void> {
  const supabase = createBrowserClient();
  const column = `par_hole_${holeNumber}` as keyof CourseRow;
  const { error } = await supabase
    .from('courses')
    .update({ [column]: par })
    .eq('id', courseId);
  if (error) throw error;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatchCourse(
  name: string,
  existing: CourseRow[],
): CourseRow | null {
  const needle = normalise(name);
  let best: CourseRow | null = null;
  let bestDist = Infinity;

  for (const course of existing) {
    const hay = normalise(course.name);
    if (hay.includes(needle) || needle.includes(hay)) return course;
    const dist = editDistance(needle, hay);
    if (dist < bestDist) {
      bestDist = dist;
      best = course;
    }
  }

  return bestDist <= 2 ? best : null;
}
