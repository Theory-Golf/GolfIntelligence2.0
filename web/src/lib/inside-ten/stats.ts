import type { InsideTenSession } from './types';
import { scoreToTier } from './scoring';
import type { Tier } from './types';

// Sessions must be sorted most-recent first before calling these helpers

export function bestScore(sessions: InsideTenSession[]): number | null {
  if (!sessions.length) return null;
  return Math.max(...sessions.map(s => s.score));
}

export function averageScore(sessions: InsideTenSession[], n?: number): number | null {
  const slice = n != null ? sessions.slice(0, n) : sessions;
  if (!slice.length) return null;
  return slice.reduce((sum, s) => sum + s.score, 0) / slice.length;
}

export function last5Average(sessions: InsideTenSession[]): number | null {
  return averageScore(sessions, 5);
}

export function last10Average(sessions: InsideTenSession[]): number | null {
  return averageScore(sessions, 10);
}

// Current tier derived from last-5-session average score
export function currentTier(sessions: InsideTenSession[]): Tier | null {
  const avg = last5Average(sessions);
  if (avg === null) return null;
  return scoreToTier(Math.round(avg));
}

export function tierCounts(sessions: InsideTenSession[]): Record<Tier, number> {
  const counts: Record<Tier, number> = { elite: 0, tour: 0, competitive: 0, developing: 0 };
  for (const s of sessions) counts[s.tier]++;
  return counts;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
