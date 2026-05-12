'use client';

import { Button } from '@/components/ui/button';
import { getCheckpointRecommendation } from '../logic';
import type { Block, HistoryEntry, PracticeIntent } from '../types';
import SwingCounter from '../parts/SwingCounter';
import PracticeIntentGate from '../parts/PracticeIntentGate';
import StatusPill from '../parts/StatusPill';

function badgeStatus(score: number) {
  if (score === 5) return 'mastered' as const;
  if (score === 4) return 'stable' as const;
  if (score === 3) return 'acquiring' as const;
  return 'building' as const;
}

function recToneClasses(tone: 'caution' | 'info' | 'positive') {
  if (tone === 'caution') return 'border-bogey/40 bg-bogey/10 text-foreground';
  if (tone === 'positive') return 'border-under/40 bg-under/10 text-foreground';
  return 'border-border bg-muted/40 text-foreground';
}

export default function IronTechnicalBlock({
  block,
  history,
  onCycleSwing,
  onLogCheckpoint,
  onSetGateIntent,
  onClearGateIntent,
}: {
  block: Block;
  history: HistoryEntry[];
  onCycleSwing: (blockId: string, cpId: string, idx: number) => void;
  onLogCheckpoint: (blockId: string, cpId: string) => void;
  onSetGateIntent: (blockId: string, gateId: string, intent: PracticeIntent) => void;
  onClearGateIntent: (blockId: string, gateId: string) => void;
}) {
  if (!block.checkpoints) return null;

  return (
    <div className="space-y-4">
      {block.checkpoints.map((cp, cpIdx) => {
        const prevCp = cpIdx > 0 ? block.checkpoints![cpIdx - 1] : null;
        const prevGate = block.practiceGates?.find((g) => g.afterCheckpointIdx === cpIdx - 1);
        const isLocked = !!(prevGate && prevCp && prevCp.logged && !prevGate.intent);

        const score = cp.swings.filter((s) => s === true).length;
        const recorded = cp.swings.every((s) => s !== null);
        const rec = cp.logged ? getCheckpointRecommendation(history, cp.elementId, score) : null;
        const gateAfter =
          block.practiceGates?.find((g) => g.afterCheckpointIdx === cpIdx) ?? null;

        return (
          <div key={cp.id}>
            <div className="border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Checkpoint {cpIdx + 1} · 5 Swings
                </div>
                {isLocked ? (
                  <StatusPill status="locked">Locked</StatusPill>
                ) : recorded ? (
                  <StatusPill status={badgeStatus(score)}>{score}/5</StatusPill>
                ) : (
                  <StatusPill status="pending">Pending</StatusPill>
                )}
              </div>

              {isLocked ? (
                <p className="text-xs text-muted-foreground">
                  Pick your practice swing intent above to unlock.
                </p>
              ) : (
                <>
                  <SwingCounter
                    swings={cp.swings}
                    disabled={cp.logged}
                    onCycle={(i) => onCycleSwing(block.id, cp.id, i)}
                  />

                  {recorded && !cp.logged && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="font-display text-3xl font-extrabold text-foreground">
                        {score}
                        <span className="ml-1 font-mono text-sm font-normal text-muted-foreground">
                          /5
                        </span>
                      </div>
                      <Button size="sm" onClick={() => onLogCheckpoint(block.id, cp.id)}>
                        Log Result
                      </Button>
                    </div>
                  )}

                  {cp.logged && (
                    <div className="mt-4 font-display text-3xl font-extrabold text-primary">
                      {score}
                      <span className="ml-1 font-mono text-sm font-normal text-muted-foreground">
                        /5 · Logged
                      </span>
                    </div>
                  )}

                  {rec && (
                    <div className={`mt-3 border p-3 text-sm ${recToneClasses(rec.tone)}`}>
                      <div className="mb-1 font-display text-xs font-bold uppercase tracking-wide">
                        {rec.title}
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.message}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {gateAfter && (
              <PracticeIntentGate
                gate={gateAfter}
                prevCheckpointLogged={!!cp.logged}
                onSet={(gid, intent) => onSetGateIntent(block.id, gid, intent)}
                onClear={(gid) => onClearGateIntent(block.id, gid)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
