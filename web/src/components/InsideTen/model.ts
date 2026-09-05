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

export interface InsideTenSession {
  id: string;
  date: string;
  timestamp: number;
  score: number;
  sg: number;
  tier: TierName;
  entryMode?: EntryMode;
  /** Present only for putt-by-putt sessions. Feeds the distance breakdowns. */
  putts?: PuttLog[];
}

export const GROUPS: LadderGroup[] = [
  { group: 1, putts: [3, 4, 5] },
  { group: 2, putts: [4, 5, 6] },
  { group: 3, putts: [5, 6, 7] },
  { group: 4, putts: [6, 7, 8] },
  { group: 5, putts: [7, 8, 9] },
  { group: 6, putts: [8, 9, 10] },
];

export const TOTAL_PUTTS = 18;

/** Score at which the drill is SG-neutral against Tour baseline. */
export const TOUR_BASELINE_SCORE = 12;

const SG_TABLE: Record<number, number> = {
  18: 6.28, 17: 5.25, 16: 4.22, 15: 3.19, 14: 2.16, 13: 1.13,
  12: 0.10, 11: -0.93, 10: -1.96, 9: -2.99, 8: -4.02, 7: -5.05,
  6: -6.08, 5: -7.11, 4: -8.14, 3: -9.17, 2: -10.20, 1: -11.23, 0: -12.26,
};

export const TIER_CONFIG: Record<TierName, {
  label: string;
  copy: string;
  range: string;
  color: string;
  hexColor: string;
}> = {
  elite: {
    label: 'Elite',
    copy: 'Above Tour baseline. Conversion-grade putting.',
    range: '13–18  ·  SG ≥ +1.0',
    color: 'var(--sg-strong)',
    hexColor: 'var(--under)',
  },
  tour: {
    label: 'Tour',
    copy: 'Tour baseline. SG-neutral inside ten.',
    range: '11–12  ·  SG −1.0 to +1.0',
    color: 'var(--sg-gain)',
    hexColor: 'var(--sg-gain)',
  },
  competitive: {
    label: 'Competitive',
    copy: 'Below baseline. Tighten speed control on the 7–10 ft band.',
    range: '9–10   ·  SG −3.0 to −1.0',
    color: 'var(--bogey)',
    hexColor: 'var(--bogey)',
  },
  developing: {
    label: 'Developing',
    copy: 'Repeat the drill — focus on speed first, line second.',
    range: '0–8    ·  SG ≤ −3.0',
    color: 'var(--double)',
    hexColor: 'var(--scarlet)',
  },
};

export function sgForScore(score: number): number {
  return SG_TABLE[score] ?? 0;
}

export function tierForScore(score: number): TierName {
  if (score >= 13) return 'elite';
  if (score >= 11) return 'tour';
  if (score >= 9)  return 'competitive';
  return 'developing';
}

export function formatSG(sg: number): string {
  const abs = Math.abs(sg).toFixed(1);
  return sg >= 0 ? `+${abs}` : `-${abs}`;
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
): InsideTenSession {
  return {
    id: crypto.randomUUID(),
    date,
    timestamp: Date.now(),
    score,
    sg: Number(sgForScore(score).toFixed(2)),
    tier: tierForScore(score),
    entryMode: results ? 'putt-by-putt' : 'total',
    ...(results ? { putts: buildPuttLog(GROUPS, results) } : {}),
  };
}

/** Every logged putt across a set of sessions, for distance-level rollups. */
export function allPutts(sessions: InsideTenSession[]): PuttLog[] {
  return sessions.flatMap((s) => s.putts ?? []);
}
