'use client';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxDigits?: number;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function NumericKeypad({
  value,
  onChange,
  maxDigits = 4,
}: NumericKeypadProps) {
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

  return (
    <div className="flex flex-col gap-3">
      {/* Display */}
      <div className="border border-border rounded-md bg-shadow px-4 py-6 text-center">
        <span className="font-mono text-5xl text-chalk tracking-tight">
          {value || '—'}
        </span>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pressDigit(d)}
            className="bg-shadow border border-border rounded-md py-4 font-mono text-2xl text-chalk active:bg-pitch transition-colors"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={pressClear}
          className="bg-shadow border border-border rounded-md py-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ash active:bg-pitch transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={pressZero}
          className="bg-shadow border border-border rounded-md py-4 font-mono text-2xl text-chalk active:bg-pitch transition-colors"
        >
          0
        </button>
        <button
          type="button"
          onClick={pressBackspace}
          aria-label="Backspace"
          className="bg-shadow border border-border rounded-md py-4 font-mono text-xl text-chalk active:bg-pitch transition-colors flex items-center justify-center"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
