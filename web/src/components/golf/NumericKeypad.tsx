'use client';

import { memo, useState } from 'react';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxDigits?: number;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

function NumericKeypadImpl({
  value,
  onChange,
  maxDigits = 4,
}: NumericKeypadProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  function pressDigit(d: string) {
    if (value.length >= maxDigits) return;
    if (value === '0') {
      onChange(d);
      return;
    }
    onChange(value + d);
  }

  function pressZero() {
    if (value === '' || value === '0') {
      onChange('0');
      return;
    }
    if (value.length >= maxDigits) return;
    onChange(value + '0');
  }

  function pressClear() {
    onChange('');
  }

  function pressBackspace() {
    onChange(value.slice(0, -1));
  }

  // Input fires on pointerdown (not click) so touch input registers
  // immediately, with the pressed style applied in the same frame.
  function keyHandlers(key: string, action: () => void) {
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

  function keyClass(key: string, extra = '', muted = false) {
    const pressed = pressedKey === key;
    return (
      'rounded-md py-2.5 select-none touch-manipulation ' +
      (pressed
        ? 'bg-pitch border border-chalk scale-95 '
        : `${muted ? 'bg-obsidian' : 'bg-shadow'} border border-border transition-[background-color,border-color,transform] duration-150 `) +
      extra
    );
  }

  // The entered value is rendered by the caller, on the field's label line
  // (see DistanceEntry) rather than in a box of its own here — same reading,
  // one fewer row. The 3-column key grid below is deliberately untouched.
  return (
    <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            {...keyHandlers(d, () => pressDigit(d))}
            className={keyClass(d, 'font-mono text-xl text-chalk')}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          {...keyHandlers('clear', pressClear)}
          className={keyClass(
            'clear',
            'font-mono text-[11px] tracking-[0.2em] uppercase text-ash',
            true,
          )}
        >
          Clear
        </button>
        <button
          type="button"
          {...keyHandlers('0', pressZero)}
          className={keyClass('0', 'font-mono text-xl text-chalk')}
        >
          0
        </button>
        <button
          type="button"
          {...keyHandlers('backspace', pressBackspace)}
          aria-label="Backspace"
          className={keyClass(
            'backspace',
            'font-mono text-lg text-ash flex items-center justify-center',
            true,
          )}
        >
          ⌫
        </button>
    </div>
  );
}

export const NumericKeypad = memo(NumericKeypadImpl);
