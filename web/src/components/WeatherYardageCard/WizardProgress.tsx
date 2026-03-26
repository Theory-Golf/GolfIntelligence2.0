// @ts-nocheck
'use client';

const STEPS = [
  { n: 1, label: 'Round' },
  { n: 2, label: 'My Bag' },
  { n: 3, label: 'Wedges' },
  { n: 4, label: 'Print' },
];

export default function WizardProgress({ step }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const isDone   = step > s.n;
        const isActive = step === s.n;
        return (
          <div key={s.n} className="flex items-center gap-2 flex-1 last:flex-none">
            {/* Bubble */}
            <div
              className={`
                w-7 h-7 rounded-full flex items-center justify-center shrink-0
                font-mono text-[11px] font-semibold transition-all duration-150
                ${isDone
                  ? 'bg-primary/20 text-primary border border-primary'
                  : isActive
                    ? 'bg-primary text-white border border-primary'
                    : 'bg-surface text-muted-foreground border border-border'
                }
              `}
            >
              {isDone ? '✓' : s.n}
            </div>

            {/* Label */}
            <span
              className={`
                font-mono text-[10px] uppercase tracking-[0.15em] whitespace-nowrap
                transition-colors duration-150
                ${isActive ? 'text-foreground' : 'text-muted-foreground'}
              `}
            >
              {s.label}
            </span>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={`
                  flex-1 h-px mx-2 transition-colors duration-150
                  ${isDone ? 'bg-primary' : 'bg-border'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
