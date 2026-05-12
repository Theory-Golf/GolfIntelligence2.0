import type { Swing } from '../types';

const BASE =
  'flex aspect-square items-center justify-center border font-display text-base font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50';

function classFor(s: Swing): string {
  if (s === true) return 'bg-primary text-primary-foreground border-primary';
  if (s === false) return 'bg-muted text-muted-foreground border-border line-through';
  return 'bg-card text-muted-foreground border-border hover:border-primary hover:text-primary';
}

function symbolFor(s: Swing, idx: number): string {
  if (s === true) return '✓';
  if (s === false) return '✗';
  return String(idx + 1);
}

export default function SwingCounter({
  swings,
  disabled,
  onCycle,
}: {
  swings: Swing[];
  disabled?: boolean;
  onCycle: (idx: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {swings.map((s, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onCycle(i)}
          className={`${BASE} ${classFor(s)}`}
        >
          {symbolFor(s, i)}
        </button>
      ))}
    </div>
  );
}
