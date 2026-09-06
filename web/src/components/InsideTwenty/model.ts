import {
  buildPuttLog,
  type LadderGroup,
  type PuttLog,
} from '@/lib/golf/puttingLadder';

export type TierName = 'elite' | 'tour' | 'competitive' | 'developing';

/**
 * How a session's score was captured. Absent on sessions saved before
 * putt-by-putt logging existed — treat a missing value as 'total'.
 */
export type EntryMode = 'putt-by-putt' | 'total';

export interface InsideTwentySession {
  id: string;
  date: string;
  timestamp: number;
  score: number;
  tier: TierName;
  entryMode?: EntryMode;
  /** Present only for putt-by-putt sessions. Feeds the distance breakdowns. */
  putts?: PuttLog[];
}

export const GROUPS: LadderGroup[] = [
  { group: 1, putts: [5,  7,  9]  },
  { group: 2, putts: [7,  9,  11] },
  { group: 3, putts: [9,  11, 13] },
  { group: 4, putts: [11, 13, 15] },
  { group: 5, putts: [13, 15, 17] },
  { group: 6, putts: [15, 17, 19] },
];

export const TOTAL_PUTTS = 18;

/** Lower bound of the PGA Tour benchmark band (9–10 makes). */
export const TOUR_BASELINE_SCORE = 9;

export const TIER_CONFIG: Record<TierName, {
  label: string;
  copy: string;
  range: string;
  color: string;
  hexColor: string;
}> = {
  elite: {
    label: 'Elite',
    copy: 'Beating Tour baseline. Championship-grade mid-range putting.',
    range: '11–18  ·  Championship grade',
    color: 'var(--sg-strong)',
    hexColor: 'var(--under)',
  },
  tour: {
    label: 'Tour',
    copy: 'PGA Tour benchmark. Converting at the level of the best players.',
    range: '9–10   ·  PGA Tour benchmark',
    color: 'var(--sg-gain)',
    hexColor: 'var(--sg-gain)',
  },
  competitive: {
    label: 'Competitive',
    copy: 'Solid collegiate / scratch amateur. The conversion habit is forming.',
    range: '7–8    ·  Collegiate / scratch',
    color: 'var(--bogey)',
    hexColor: 'var(--bogey)',
  },
  developing: {
    label: 'Developing',
    copy: 'Repeat the drill — focus on speed first, line second.',
    range: '0–6    ·  Below baseline',
    color: 'var(--double)',
    hexColor: 'var(--scarlet)',
  },
};

export function tierForScore(score: number): TierName {
  if (score >= 11) return 'elite';
  if (score >= 9)  return 'tour';
  if (score >= 7)  return 'competitive';
  return 'developing';
}

export function formatDelta(d: number): string {
  if (d > 0) return `+${d}`;
  if (d < 0) return `${d}`;
  return '—';
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build a session from a total score. `results`, when supplied, is the ordered
 * make/miss log from putt-by-putt play; the score is still the make count, so
 * a putt-by-putt session and a quick-entry session with the same total remain
 * directly comparable in every trend view.
 */
export function buildSession(
  score: number,
  date: string,
  results?: boolean[],
): InsideTwentySession {
  return {
    id: crypto.randomUUID(),
    date,
    timestamp: Date.now(),
    score,
    tier: tierForScore(score),
    entryMode: results ? 'putt-by-putt' : 'total',
    ...(results ? { putts: buildPuttLog(GROUPS, results) } : {}),
  };
}

/** Every logged putt across a set of sessions, for distance-level rollups. */
export function allPutts(sessions: InsideTwentySession[]): PuttLog[] {
  return sessions.flatMap((s) => s.putts ?? []);
}
