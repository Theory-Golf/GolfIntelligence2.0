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
  textClass: string;    // Tailwind text color, e.g. 'text-sg-strong'
  bgClass: string;      // Tailwind bg with opacity, e.g. 'bg-sg-strong/10'
  borderClass: string;  // Tailwind border color with opacity, e.g. 'border-sg-strong/20'
  chartColor: string;   // CSS var for SVG/Recharts props (not a class)
  copy: string;
}

// Class name strings must appear literally here so Tailwind's scanner includes them.
export const TIER_META: Readonly<Record<Tier, TierMeta>> = Object.freeze({
  elite: {
    label: 'Elite',
    textClass: 'text-sg-strong',
    bgClass: 'bg-sg-strong/10',
    borderClass: 'border-sg-strong/20',
    chartColor: 'var(--color-sg-strong)',
    copy: 'Above Tour baseline. Strong putting performance.',
  },
  tour: {
    label: 'Tour',
    textClass: 'text-sg-gain',
    bgClass: 'bg-sg-gain/10',
    borderClass: 'border-sg-gain/20',
    chartColor: 'var(--color-sg-gain)',
    copy: 'Tour baseline. SG-neutral inside ten.',
  },
  competitive: {
    label: 'Competitive',
    textClass: 'text-bogey',
    bgClass: 'bg-bogey/10',
    borderClass: 'border-bogey/20',
    chartColor: 'var(--color-bogey)',
    copy: 'Good performance, slight improvement opportunity.',
  },
  developing: {
    label: 'Developing',
    textClass: 'text-double',
    bgClass: 'bg-double/10',
    borderClass: 'border-double/20',
    chartColor: 'var(--color-double)',
    copy: 'Improvement opportunity — identify root cause (speed, read, start line) and ensure Base Station addresses it.',
  },
});
