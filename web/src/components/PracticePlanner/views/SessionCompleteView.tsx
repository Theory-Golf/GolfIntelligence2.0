'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STATUS, fmtDate, getElementStatus } from '../logic';
import type { HistoryEntry, SessionRecord } from '../types';
import StatusPill from '../parts/StatusPill';

/**
 * Shown once a session is completed and saved. It has to do three things:
 * make it unmistakable that the session is over, recap what was worked on and
 * where the player sits in the mesocycle, and get them back to PlayerPath.
 */
export default function SessionCompleteView({
  record,
  history,
  onPlanAnother,
  onViewHistory,
}: {
  record: SessionRecord;
  history: HistoryEntry[];
  onPlanAnother: () => void;
  onViewHistory: () => void;
}) {
  const elements = groupCheckpoints(record);
  const allBlocksDone = record.blocksCompleted === record.blocksTotal;

  return (
    <div className="space-y-6">
      {/* ── Confirmation ─────────────────────────────────────── */}
      <div className="border border-primary/40 bg-accent/30 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-7 items-center justify-center bg-primary font-display text-sm font-bold text-primary-foreground">
            ✓
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            Session Complete · {fmtDate(record.date)}
          </p>
        </div>
        <h3 className="mt-4 font-display text-3xl font-extrabold uppercase leading-[0.95] tracking-tight text-foreground sm:text-4xl">
          Work is <span className="text-primary">logged</span>
        </h3>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {allBlocksDone
            ? 'Every block in this session was completed.'
            : `${record.blocksCompleted} of ${record.blocksTotal} blocks completed — everything you recorded was saved, finished or not.`}{' '}
          This session and all its checkpoints are now in your history on this device.
        </p>
      </div>

      {/* ── Stage ────────────────────────────────────────────── */}
      <div className="border border-border bg-card p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Mesocycle Stage
        </div>
        <div className="mt-1 font-display text-2xl font-extrabold uppercase tracking-tight text-foreground">
          Week {record.week} · {record.phase}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{record.phaseDesc}.</p>
      </div>

      {/* ── Session overview ─────────────────────────────────── */}
      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Session Overview
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Shots Planned" value={String(record.plannedShots)} />
          <Stat label="Blocks Done" value={`${record.blocksCompleted}/${record.blocksTotal}`} />
          <Stat label="Checkpoints" value={String(record.checkpoints.length)} />
          <Stat
            label="Wedge Shots"
            value={
              record.wedgeShots > 0 && record.avgBallSpeed !== null
                ? `${record.wedgeShots} · ${record.avgBallSpeed.toFixed(1)}`
                : String(record.wedgeShots)
            }
            hint={record.avgBallSpeed !== null ? 'count · avg ball speed' : undefined}
          />
        </div>
      </div>

      {/* ── What you worked on ───────────────────────────────── */}
      {elements.length > 0 && (
        <div className="border border-border bg-card p-5">
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            What You Worked On
          </div>
          <div className="space-y-4">
            {elements.map((el) => {
              const status = getElementStatus(history, el.elementId);
              return (
                <div key={el.elementId} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-base font-bold uppercase tracking-wide text-foreground">
                      {el.elementName || 'Unnamed'}
                    </span>
                    <StatusPill status={status}>{STATUS[status].label}</StatusPill>
                  </div>
                  {el.sets.map((set, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-20 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Set {i + 1}
                      </span>
                      <div className="h-1.5 flex-1 bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(set.score / set.total) * 100}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-display text-sm font-bold text-foreground">
                        {set.score}/{set.total}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Blocks run ───────────────────────────────────────── */}
      <div className="border border-border bg-card p-5">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Blocks Run
        </div>
        <ul className="space-y-2">
          {record.blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
              <span className={b.completed ? 'text-foreground' : 'text-muted-foreground'}>
                {b.name}
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {b.shots} shots
                </span>
              </span>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                  b.completed ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {b.completed ? 'Complete' : 'Partial'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Exits ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Link href="#playerpath" className={cn(buttonVariants(), 'no-underline')}>
          ← Back to PlayerPath
        </Link>
        <Button variant="outline" onClick={onPlanAnother}>
          Plan Another Session
        </Button>
        <Button variant="ghost" onClick={onViewHistory}>
          View History
        </Button>
      </div>
    </div>
  );
}

function groupCheckpoints(record: SessionRecord) {
  const byElement: {
    elementId: string;
    elementName: string;
    sets: { score: number; total: number }[];
  }[] = [];
  record.checkpoints.forEach((cp) => {
    let entry = byElement.find((e) => e.elementId === cp.elementId);
    if (!entry) {
      entry = { elementId: cp.elementId, elementName: cp.elementName, sets: [] };
      byElement.push(entry);
    }
    entry.sets.push({ score: cp.score, total: cp.total });
  });
  return byElement;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-border bg-card p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-extrabold text-foreground">{value}</div>
      {hint && (
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}
