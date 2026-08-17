export interface EthosChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface EthosChartSpec {
  type: 'line';
  xKey: string;
  xLabel?: string;
  yLabel?: string;
  series: EthosChartSeries[];
  data: Record<string, number>[];
}

function isChartSeries(value: unknown): value is EthosChartSeries {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === 'string' && typeof v.label === 'string';
}

/**
 * Parses a ```chart fenced-block body pasted by a non-engineer into Supabase.
 * Fails soft (returns null) rather than throwing, since malformed JSON here
 * should never take down the page.
 */
export function parseChartSpec(raw: string): EthosChartSpec | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const v = parsed as Record<string, unknown>;
    if (v.type !== 'line') return null;
    if (typeof v.xKey !== 'string') return null;
    if (!Array.isArray(v.series) || !v.series.every(isChartSeries)) return null;
    if (!Array.isArray(v.data)) return null;
    return {
      type: 'line',
      xKey: v.xKey,
      xLabel: typeof v.xLabel === 'string' ? v.xLabel : undefined,
      yLabel: typeof v.yLabel === 'string' ? v.yLabel : undefined,
      series: v.series as EthosChartSeries[],
      data: v.data as Record<string, number>[],
    };
  } catch {
    return null;
  }
}
