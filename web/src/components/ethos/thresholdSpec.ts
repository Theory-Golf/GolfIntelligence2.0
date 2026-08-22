export type ThresholdTier = 'elite' | 'flag' | 'severe';

export interface ThresholdLevel {
  label: string;
  value: string;
  tier: ThresholdTier;
}

export interface ThresholdSpec {
  levels: ThresholdLevel[];
}

const TIERS: ThresholdTier[] = ['elite', 'flag', 'severe'];

function isThresholdLevel(value: unknown): value is ThresholdLevel {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.label === 'string' &&
    typeof v.value === 'string' &&
    typeof v.tier === 'string' &&
    TIERS.includes(v.tier as ThresholdTier)
  );
}

/**
 * Parses a ```thresholds fenced-block body pasted by a non-engineer into
 * Supabase. Fails soft (returns null) rather than throwing, since malformed
 * JSON here should never take down the page.
 */
export function parseThresholdSpec(raw: string): ThresholdSpec | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const v = parsed as Record<string, unknown>;
    if (!Array.isArray(v.levels) || !v.levels.every(isThresholdLevel)) return null;
    return { levels: v.levels as ThresholdLevel[] };
  } catch {
    return null;
  }
}
