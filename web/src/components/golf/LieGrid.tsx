'use client';

import { memo, useState } from 'react';
import type { Lie } from '@/lib/golf/db/types';
import { LIE_COLORS } from '@/lib/golf/utils/lieColors';

interface LieGridProps {
  selected: Lie | null;
  onChange: (lie: Lie) => void;
}

const LIES: Lie[] = ['Tee', 'Fairway', 'Rough', 'Sand', 'Recovery', 'Green'];

// Selection is driven from pointerdown, so the styles must land in the same
// frame as the touch — any colour transition here reads as input lag. That is
// safe here precisely because every control in this grid is a reversible
// selection; committing actions (Holed, Save) live outside it and commit on a
// completed tap instead.
function lieButtonClass(active: boolean, pressed: boolean): string {
  // py-3 keeps the target at 46px — above the 44px minimum.
  const base =
    'rounded-md py-3 px-3 font-display font-bold text-sm tracking-[0.15em] uppercase select-none touch-manipulation';
  if (pressed) return `${base} bg-pitch border border-chalk scale-95`;
  if (active) return `${base} bg-shadow border border-scarlet`;
  return `${base} bg-shadow border border-border text-ash`;
}

function LieGridImpl({ selected, onChange }: LieGridProps) {
  const [pressedKey, setPressedKey] = useState<Lie | null>(null);

  // Input fires on pointerdown (not click) so a touch registers immediately
  // rather than waiting for the browser to synthesise a click on release.
  function pressHandlers(lie: Lie) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        setPressedKey(lie);
        if (typeof navigator !== 'undefined') navigator.vibrate?.(10);
        onChange(lie);
      },
      onPointerUp: () => setPressedKey((k) => (k === lie ? null : k)),
      onPointerLeave: () => setPressedKey((k) => (k === lie ? null : k)),
      onPointerCancel: () => setPressedKey((k) => (k === lie ? null : k)),
    };
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {LIES.map((lie) => {
        const active = selected === lie;
        const pressed = pressedKey === lie;
        // Active green keeps the green swatch; other active lies go scarlet.
        const color =
          pressed || !active || lie !== 'Green' ? undefined : LIE_COLORS.Green;
        return (
          <button
            key={lie}
            type="button"
            {...pressHandlers(lie)}
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
  );
}

export const LieGrid = memo(LieGridImpl);
