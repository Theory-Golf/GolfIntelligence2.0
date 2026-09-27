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
type LieButtonState = 'idle' | 'pressed' | 'active' | 'activeGreen';

function lieButtonClass(state: LieButtonState): string {
  // py-3 keeps the target at 46px — above the 44px minimum.
  const base =
    'rounded-md py-3 px-3 font-display font-bold text-sm tracking-[0.15em] uppercase select-none touch-manipulation';
  switch (state) {
    case 'pressed':
      return `${base} bg-pitch border border-chalk text-chalk scale-95`;
    case 'active':
      return `${base} bg-scarlet-tint border border-scarlet text-scarlet-text`;
    // Colour and border come from the green lie swatch, set inline.
    case 'activeGreen':
      return `${base} bg-control border`;
    default:
      return `${base} bg-control border border-control-border text-ash`;
  }
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
        const state: LieButtonState = pressed
          ? 'pressed'
          : !active
            ? 'idle'
            : lie === 'Green'
              ? 'activeGreen'
              : 'active';
        return (
          <button
            key={lie}
            type="button"
            {...pressHandlers(lie)}
            className={lieButtonClass(state)}
            style={
              state === 'activeGreen'
                ? { color: LIE_COLORS.Green, borderColor: LIE_COLORS.Green }
                : undefined
            }
          >
            {lie.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

export const LieGrid = memo(LieGridImpl);
