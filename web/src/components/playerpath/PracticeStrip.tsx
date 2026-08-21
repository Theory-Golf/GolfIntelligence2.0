'use client';

import { useEffect, useState } from 'react';
import { activityById } from '@/data/practiceActivities';
import { getRecentDrillActivity } from '@/lib/playerpath/db';
import type { DrillActivitySummary } from '@/lib/playerpath/db';
import { fmtRelativeDay } from '@/lib/playerpath/format';

/**
 * A read on the player's recent practice, from their account.
 *
 * Deliberately carries no score. Each game scores itself on its own scale and
 * there is no honest way to put them side by side — so this shows only what
 * was worked and when, and links out to the game for the numbers.
 *
 * Renders nothing at all when signed out, offline, or with no history: this
 * is a progress read, and an empty or broken one is worse than none.
 */
export default function PracticeStrip() {
  const [rows, setRows] = useState<DrillActivitySummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecentDrillActivity()
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows || rows.length === 0) return null;

  const sessions = rows.find((r) => r.drillType === 'practice-session');
  const games = rows.filter((r) => r.drillType !== 'practice-session');
  const totalRuns = games.reduce((sum, r) => sum + r.count, 0);
  const lastPlayed = rows[0]?.lastPlayed;

  return (
    <div className="mt-12 border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
          Your Practice
        </span>
        {lastPlayed && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Last logged {fmtRelativeDay(lastPlayed)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Plan Sessions" value={String(sessions?.count ?? 0)} />
        <Stat label="Games Logged" value={String(totalRuns)} />
        <Stat label="Segments Worked" value={String(new Set(games.map((g) => segmentOf(g.drillType))).size)} />
      </div>

      {games.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {games.slice(0, 5).map((g) => (
            <li
              key={g.drillType}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
            >
              <span className="text-sm text-foreground">
                {activityById(g.drillType)?.name ?? g.drillType}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {g.count} {g.count === 1 ? 'run' : 'runs'}
                <span className="mx-1.5 text-border">·</span>
                {fmtRelativeDay(g.lastPlayed)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function segmentOf(drillType: string): string {
  return activityById(drillType)?.category ?? 'other';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-background p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-extrabold text-foreground">{value}</div>
    </div>
  );
}
