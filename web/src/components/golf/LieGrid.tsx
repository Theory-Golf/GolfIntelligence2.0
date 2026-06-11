'use client';

import { useState } from 'react';
import type { Lie } from '@/lib/golf/db/types';
import { LIE_COLORS } from '@/lib/golf/utils/lieColors';

interface LieGridProps {
  selected: Lie | null;
  onChange: (lie: Lie) => void;
  showHoled?: boolean;
  onHoled?: () => void;
  // Keeps the Holed button visibly "on" while the save + navigation runs.
  holedActive?: boolean;
}

const LIES: Lie[] = ['Tee', 'Fairway', 'Rough', 'Sand', 'Recovery', 'Green'];

function lieButtonClass(active: boolean): string {
  // Active gets scarlet border; text color is set inline (scarlet, or green for Green).
  const base =
    'rounded-md py-2 px-3 font-display font-bold text-sm tracking-[0.15em] uppercase transition-colors';
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
  holedActive = false,
}: LieGridProps) {
  const [holedPressed, setHoledPressed] = useState(false);

  const holedClass = holedActive
    ? 'bg-chalk border-chalk text-pitch'
    : holedPressed
      ? 'bg-pitch border-chalk text-chalk scale-95'
      : 'bg-obsidian border-border text-chalk hover:border-chalk transition-[background-color,border-color,transform] duration-150';

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
          onPointerDown={(e) => {
            e.preventDefault();
            setHoledPressed(true);
            if (typeof navigator !== 'undefined') navigator.vibrate?.(10);
            onHoled?.();
          }}
          onPointerUp={() => setHoledPressed(false)}
          onPointerLeave={() => setHoledPressed(false)}
          onPointerCancel={() => setHoledPressed(false)}
          className={`rounded-md py-2 border font-display font-bold text-sm tracking-[0.2em] uppercase select-none touch-manipulation ${holedClass}`}
        >
          {holedActive ? 'Holed ✓' : 'Holed'}
        </button>
      )}
    </div>
  );
}
