import type { ThresholdSpec, ThresholdTier } from './thresholdSpec';

const TIER_COLOR: Record<ThresholdTier, string> = {
  elite: 'var(--under)',
  flag: 'var(--bogey)',
  severe: 'var(--double)',
};

export default function ThresholdChips({ spec }: { spec: ThresholdSpec }) {
  return (
    <div className="flex flex-wrap gap-2.5 my-6">
      {spec.levels.map((level) => {
        const color = TIER_COLOR[level.tier];
        return (
          <span
            key={level.label}
            className="inline-flex items-center gap-2 font-mono text-label tracking-[0.05em] px-4 py-1.5 rounded-sm border"
            style={{
              color,
              borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          >
            <span className="size-1.5 rounded-full shrink-0" style={{ background: color }} />
            {level.label} {level.value}
          </span>
        );
      })}
    </div>
  );
}
