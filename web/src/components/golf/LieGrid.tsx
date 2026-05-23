'use client';

import type { Lie } from '@/lib/golf/db/types';
import { LIE_COLORS } from '@/lib/golf/utils/lieColors';

interface LieGridProps {
  selected: Lie | null;
  onChange: (lie: Lie) => void;
  showHoled?: boolean;
  onHoled?: () => void;
}

const LIES: Lie[] = ['Tee', 'Fairway', 'Rough', 'Sand', 'Recovery', 'Green'];

function lieButtonClass(active: boolean): string {
  // Active gets scarlet border; text color is set inline (scarlet, or green for Green).
  const base =
    'rounded-md py-3 px-3 font-display font-bold text-sm tracking-[0.15em] uppercase transition-colors';
  if (active) {
    return `${base} bg-shadow border border-scarlet`;
  }
  return `${base} bg-shadow border border-border text-ash hover:text-chalk`;
}

export function LieGrid({
  selected,
  onChange,
  showHoled = true,
  onHoled,
}: LieGridProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {LIES.map((lie) => {
          const active = selected === lie;
          const textColor = active
            ? lie === 'Green'
              ? LIE_COLORS.Green
              : undefined
            : undefined;
          return (
            <button
              key={lie}
              type="button"
              onClick={() => onChange(lie)}
              className={
                active && lie !== 'Green'
                  ? `${lieButtonClass(true)} text-scarlet`
                  : lieButtonClass(active)
              }
              style={textColor ? { color: textColor } : undefined}
            >
              {lie.toUpperCase()}
            </button>
          );
        })}
      </div>
      {showHoled && (
        <button
          type="button"
          onClick={onHoled}
          className="rounded-md py-3 bg-obsidian border border-border font-display font-bold text-sm tracking-[0.2em] uppercase text-chalk hover:border-chalk transition-colors"
        >
          Holed
        </button>
      )}
    </div>
  );
}
