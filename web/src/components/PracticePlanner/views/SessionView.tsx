'use client';

import { Button } from '@/components/ui/button';
import { fmtDate, getMesocyclePhase, getMesocycleWeek } from '../logic';
import type { Block, Direction, HistoryEntry, PracticeIntent, Session, WeekConfig } from '../types';
import IronTechnicalBlock from '../blocks/IronTechnicalBlock';
import WedgeDistanceBlock from '../blocks/WedgeDistanceBlock';
import SimpleBlock from '../blocks/SimpleBlock';
import AssessmentBlock from '../blocks/AssessmentBlock';
import StatusPill from '../parts/StatusPill';

export type SessionHandlers = {
  onCycleSwing: (blockId: string, cpId: string, idx: number) => void;
  onLogCheckpoint: (blockId: string, cpId: string) => void;
  onSetGateIntent: (blockId: string, gateId: string, intent: PracticeIntent) => void;
  onClearGateIntent: (blockId: string, gateId: string) => void;
  onUpdateCurrentShot: (blockId: string, ballSpeed: string) => void;
  onSetDirection: (blockId: string, dir: Direction) => void;
  onRecordWedge: (blockId: string) => void;
  onEditPreviousWedge: (blockId: string) => void;
  onCompleteWedge: (blockId: string) => void;
  onToggleShowAllShots: (blockId: string) => void;
  onToggleSimple: (blockId: string) => void;
  onCompleteSession: () => void;
  onDiscardSession: () => void;
};

export default function SessionView({
  session,
  weekConfig,
  history,
  handlers,
  onGoToPlan,
}: {
  session: Session | null;
  weekConfig: WeekConfig;
  history: HistoryEntry[];
  handlers: SessionHandlers;
  onGoToPlan: () => void;
}) {
  if (!weekConfig.ironElements.some((e) => e.name)) {
    return (
      <EmptyHelper title="Set your technical focus first">
        Go back to step 1 and add the elements your coach has you working on. Then come back here
        to build and run a session.
      </EmptyHelper>
    );
  }

  if (!session) {
    return (
      <EmptyHelper title="No session yet">
        Choose a shot budget and the structure scales to your current mesocycle phase.
        <div className="mt-4">
          <Button onClick={onGoToPlan}>Build a Session</Button>
        </div>
      </EmptyHelper>
    );
  }

  const week = getMesocycleWeek(weekConfig);
  const phase = getMesocyclePhase(week);
  const totalShots = session.blocks.reduce((sum, b) => sum + b.shots, 0);
  const completed = session.blocks.filter((b) => b.completed).length;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="font-mono text-label uppercase tracking-[0.3em] text-muted-foreground">
          Step 03 · Run · {fmtDate(session.date)}
        </p>
        <h3 className="font-display text-3xl font-extrabold uppercase tracking-tight text-foreground sm:text-4xl">
          Run the <span className="text-primary">plan</span>
        </h3>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Meta label="Phase" value={phase.phase} small />
        <Meta label="Total Shots" value={String(totalShots)} />
        <Meta label="Blocks" value={`${completed}/${session.blocks.length}`} />
        <Meta label="Week" value={String(week)} />
      </div>

      <div className="space-y-4">
        {session.blocks.map((b, idx) => (
          <BlockCard key={b.id} block={b} idx={idx} history={history} handlers={handlers} />
        ))}
      </div>

      {/* Finishing is the saving step — it writes the session to your history. */}
      <div className="border border-border bg-card p-5">
        <div className="font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
          {completed === session.blocks.length
            ? 'All blocks complete'
            : `${completed} of ${session.blocks.length} blocks complete`}
        </div>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Completing the session saves it — every checkpoint and recorded shot goes to your
          history, finished or not.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={handlers.onCompleteSession}>Complete Session →</Button>
          <Button variant="ghost" size="sm" onClick={handlers.onDiscardSession}>
            Discard Session
          </Button>
        </div>
      </div>
    </div>
  );
}

function BlockCard({
  block,
  idx,
  history,
  handlers,
}: {
  block: Block;
  idx: number;
  history: HistoryEntry[];
  handlers: SessionHandlers;
}) {
  return (
    <article
      className={`border bg-card p-5 transition-colors duration-150 ${
        block.completed ? 'border-primary/40 opacity-70' : 'border-border'
      }`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
            {idx + 1}. {block.name}
          </div>
          <div className="mt-1 font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
            {block.shots} shots
            {block.type === 'iron-technical' && block.checkpoints
              ? ` · ${block.checkpoints.length} checkpoint set${
                  block.checkpoints.length === 1 ? '' : 's'
                }`
              : ''}
          </div>
        </div>
        {block.completed && <StatusPill status="complete">Complete</StatusPill>}
      </header>

      <p className="text-sm text-muted-foreground">{block.instructions}</p>

      {block.cue && (
        <div className="mt-3 border-l-2 border-primary bg-accent/40 px-3 py-2">
          <div className="font-mono text-label uppercase tracking-[0.2em] text-primary">
            External Focus Cue
          </div>
          <div className="text-sm text-foreground">{block.cue}</div>
        </div>
      )}

      <div className="mt-4">
        {(block.type === 'iron-technical' || block.type === 'driver') && (
          <IronTechnicalBlock
            block={block}
            history={history}
            onCycleSwing={handlers.onCycleSwing}
            onLogCheckpoint={handlers.onLogCheckpoint}
            onSetGateIntent={handlers.onSetGateIntent}
            onClearGateIntent={handlers.onClearGateIntent}
          />
        )}
        {block.type === 'wedge-distance' && (
          <WedgeDistanceBlock
            block={block}
            onUpdateCurrentShot={handlers.onUpdateCurrentShot}
            onSetDirection={handlers.onSetDirection}
            onRecord={handlers.onRecordWedge}
            onEditPrevious={handlers.onEditPreviousWedge}
            onComplete={handlers.onCompleteWedge}
            onToggleShowAll={handlers.onToggleShowAllShots}
          />
        )}
        {block.type === 'assessment' && (
          <AssessmentBlock block={block} onToggle={handlers.onToggleSimple} />
        )}
        {(block.type === 'warmup' || block.type === 'cooldown') && (
          <SimpleBlock block={block} onToggle={handlers.onToggleSimple} />
        )}
      </div>
    </article>
  );
}

function Meta({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="border border-border bg-card p-3">
      <div className="font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-display font-extrabold text-foreground ${
          small ? 'text-base' : 'text-2xl'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyHelper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border bg-muted/40 p-8 text-center">
      <div className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
        {title}
      </div>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
