import type { Tier } from './types';

// Frozen lookup — do not recompute at runtime (§3.2)
export const SG_TABLE: Readonly<Record<number, number>> = Object.freeze({
  18:  6.28,
  17:  5.25,
  16:  4.22,
  15:  3.19,
  14:  2.16,
  13:  1.13,
  12:  0.10,
  11: -0.93,
  10: -1.96,
   9: -2.99,
   8: -4.02,
   7: -5.05,
   6: -6.08,
   5: -7.11,
   4: -8.14,
   3: -9.17,
   2: -10.20,
   1: -11.23,
   0: -12.26,
});

export function scoreToSG(score: number): number {
  return SG_TABLE[Math.round(Math.max(0, Math.min(18, score)))];
}

export function scoreToTier(score: number): Tier {
  if (score >= 14) return 'elite';
  if (score >= 12) return 'tour';
  if (score >= 10) return 'competitive';
  return 'developing';
}

// Renders SG with Unicode minus and one decimal, e.g. "+1.1" or "−2.0"
export function formatSG(sg: number): string {
  const abs = Math.abs(sg).toFixed(1);
  return sg >= 0 ? `+${abs}` : `−${abs}`;
}

export interface TierMeta {
  label: string;
  color: string;   // CSS custom property reference
  bgColor: string; // Subtle tint for badge background
  copy: string;
}

export const TIER_META: Readonly<Record<Tier, TierMeta>> = Object.freeze({
  elite: {
    label: 'Elite',
    color: 'var(--sg-strong)',
    bgColor: 'rgba(0, 192, 122, 0.12)',
    copy: 'Above Tour baseline. Strong putting performance.',
  },
  tour: {
    label: 'Tour',
    color: 'var(--sg-gain)',
    bgColor: 'rgba(82, 217, 160, 0.12)',
    copy: 'Tour baseline. SG-neutral inside ten.',
  },
  competitive: {
    label: 'Competitive',
    color: 'var(--bogey)',
    bgColor: 'rgba(245, 149, 32, 0.12)',
    copy: 'Good performance, slight improvement opportunity.',
  },
  developing: {
    label: 'Developing',
    color: 'var(--double)',
    bgColor: 'rgba(232, 32, 42, 0.10)',
    copy: 'Improvement opportunity — identify root cause (speed, read, start line) and ensure Base Station addresses it.',
  },
});
