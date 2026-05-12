import { PRACTICE_INTENTS } from '../defaults';
import type { PracticeGate, PracticeIntent } from '../types';
import StatusPill from './StatusPill';

export default function PracticeIntentGate({
  gate,
  prevCheckpointLogged,
  onSet,
  onClear,
}: {
  gate: PracticeGate;
  prevCheckpointLogged: boolean;
  onSet: (gateId: string, intent: PracticeIntent) => void;
  onClear: (gateId: string) => void;
}) {
  if (!prevCheckpointLogged) {
    return (
      <div className="mt-4 border border-dashed border-border bg-muted/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Between Checkpoints
          </span>
          <StatusPill status="pending">After CP {gate.afterCheckpointIdx + 1}</StatusPill>
        </div>
        <p className="text-xs text-muted-foreground">
          Log the previous checkpoint to set practice intent.
        </p>
      </div>
    );
  }

  if (!gate.intent) {
    return (
      <div className="mt-4 border border-primary/40 bg-accent/40 p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Practice Swings — Set Intent
        </div>
        <p className="mb-3 text-sm text-foreground">
          Before the next checkpoint, do practice reps with one focus. Pick how you’ll approach
          them:
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRACTICE_INTENTS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSet(gate.id, opt.key)}
              className="flex flex-col items-start gap-1 border border-border bg-card p-3 text-left transition-colors duration-150 hover:border-primary hover:bg-accent"
            >
              <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                {opt.label}
              </span>
              <span className="text-xs text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selected = PRACTICE_INTENTS.find((i) => i.key === gate.intent);
  return (
    <div className="mt-4 border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Practice Intent
        </span>
        <button
          type="button"
          onClick={() => onClear(gate.id)}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary hover:underline"
        >
          Change
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
          {selected?.label}
        </span>
        <span className="text-xs text-muted-foreground">{selected?.desc}</span>
      </div>
    </div>
  );
}
