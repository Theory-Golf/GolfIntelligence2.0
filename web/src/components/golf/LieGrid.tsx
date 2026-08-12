'use client';

import { memo, useState } from 'react';
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

// Selection is driven from pointerdown, so the styles must land in the same
// frame as the touch — any colour transition here reads as input lag.
function lieButtonClass(active: boolean, pressed: boolean): string {
  const base =
    'rounded-md py-2 px-3 font-display font-bold text-sm tracking-[0.15em] uppercase select-none touch-manipulation';
  if (pressed) return `${base} bg-pitch border border-chalk scale-95`;
  if (active) return `${base} bg-shadow border border-scarlet`;
  return `${base} bg-shadow border border-border text-ash`;
}

function LieGridImpl({
  selected,
  onChange,
  showHoled = true,
  onHoled,
  holedActive = false,
}: LieGridProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  // Input fires on pointerdown (not click) so a touch registers immediately
  // rather than waiting for the browser to synthesise a click on release.
  function pressHandlers(key: string, action: () => void) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        setPressedKey(key);
        if (typeof navigator !== 'undefined') navigator.vibrate?.(10);
        action();
      },
      onPointerUp: () => setPressedKey((k) => (k === key ? null : k)),
      onPointerLeave: () => setPressedKey((k) => (k === key ? null : k)),
      onPointerCancel: () => setPressedKey((k) => (k === key ? null : k)),
    };
  }

  const holedClass = holedActive
    ? 'bg-chalk border-chalk text-pitch'
    : pressedKey === 'holed'
      ? 'bg-pitch border-chalk text-chalk scale-95'
      : 'bg-obsidian border-border text-chalk';

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {LIES.map((lie) => {
          const active = selected === lie;
          const pressed = pressedKey === lie;
          // Active green keeps the green swatch; other active lies go scarlet.
          const color =
            pressed || !active
              ? undefined
              : lie === 'Green'
                ? LIE_COLORS.Green
                : undefined;
          return (
            <button
              key={lie}
              type="button"
              {...pressHandlers(lie, () => onChange(lie))}
              className={
                active && !pressed && lie !== 'Green'
                  ? `${lieButtonClass(true, false)} text-scarlet`
                  : lieButtonClass(active, pressed)
              }
              style={color ? { color } : undefined}
            >
              {lie.toUpperCase()}
            </button>
          );
        })}
      </div>
      {showHoled && (
        <button
          type="button"
          {...pressHandlers('holed', () => onHoled?.())}
          className={`rounded-md py-2 border font-display font-bold text-sm tracking-[0.2em] uppercase select-none touch-manipulation ${holedClass}`}
        >
          {holedActive ? 'Holed ✓' : 'Holed'}
        </button>
      )}
    </div>
  );
}

export const LieGrid = memo(LieGridImpl);
