'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getMesocyclePhase, getMesocycleWeek } from '../logic';
import type { Session, WeekConfig } from '../types';

const SHOT_OPTIONS = [60, 75, 90, 100];

export default function PlanView({
  weekConfig,
  currentSession,
  onStart,
  onJumpToSession,
  onDiscard,
}: {
  weekConfig: WeekConfig;
  currentSession: Session | null;
  onStart: (shotBudget: number, includeDriver: 'auto' | 'yes' | 'no', ironFocusId: string) => void;
  onJumpToSession: () => void;
  onDiscard: () => void;
}) {
  const week = getMesocycleWeek(weekConfig);
  const phase = getMesocyclePhase(week);
  const [shotBudget, setShotBudget] = useState(90);
  const [includeDriver, setIncludeDriver] = useState<'auto' | 'yes' | 'no'>('auto');
  const [ironFocusId, setIronFocusId] = useState('all');

  const ironElements = weekConfig.ironElements.filter((e) => e.name);
  const setupNeeded = ironElements.length === 0;

  if (currentSession) {
    return (
      <div className="space-y-4">
        <header className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Step 02 · Build
          </p>
          <h3 className="font-display text-3xl font-extrabold uppercase tracking-tight text-foreground sm:text-4xl">
            Session already <span className="text-primary">in progress</span>
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pick your session back up, or discard it and build a new one.
            Logged checkpoints stay in history either way.
          </p>
        </header>
        <div className="flex flex-wrap gap-3">
          <Button onClick={onJumpToSession}>Open Session</Button>
          <Button variant="outline" onClick={onDiscard}>
            Discard & Replan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Step 02 · Build
        </p>
        <h3 className="font-display text-3xl font-extrabold uppercase tracking-tight text-foreground sm:text-4xl">
          Plan the
          <br />
          <span className="text-primary">reps</span>
        </h3>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Tell us how many shots you have. The session structure scales to your shot budget and
          current mesocycle phase. Distance wedges are included every session; driver is optional
          and depends on shot count.
        </p>
      </header>

      <div className="border border-primary/30 bg-accent/40 p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Mesocycle · Week {week}
        </div>
        <p className="mt-1 text-sm text-foreground">
          Currently in <strong className="text-foreground">{phase.phase}</strong> phase. {phase.desc}.
        </p>
      </div>

      {setupNeeded ? (
        <div className="border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          Define at least one iron element in step 1 before building a session.
        </div>
      ) : (
        <div className="border border-border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Shot Budget">
              <select
                value={shotBudget}
                onChange={(e) => setShotBudget(parseInt(e.target.value, 10))}
                className="h-10 w-full border border-border bg-background px-3 font-body text-base text-foreground focus:border-primary focus:outline-none"
              >
                {SHOT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} shots{n === 60 ? ' — short' : n === 90 ? ' — typical' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Include Driver">
              <select
                value={includeDriver}
                onChange={(e) => setIncludeDriver(e.target.value as 'auto' | 'yes' | 'no')}
                className="h-10 w-full border border-border bg-background px-3 font-body text-base text-foreground focus:border-primary focus:outline-none"
              >
                <option value="auto">Auto (75+ shots)</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Iron Focus Today">
              <select
                value={ironFocusId}
                onChange={(e) => setIronFocusId(e.target.value)}
                className="h-10 w-full border border-border bg-background px-3 font-body text-base text-foreground focus:border-primary focus:outline-none"
              >
                <option value="all">All elements</option>
                {ironElements.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Button onClick={() => onStart(shotBudget, includeDriver, ironFocusId)}>
              Build Session →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
