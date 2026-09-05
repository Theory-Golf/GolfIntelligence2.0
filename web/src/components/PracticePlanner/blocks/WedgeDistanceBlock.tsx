'use client';

import { Button } from '@/components/ui/button';
import { stddev } from '../logic';
import type { Block, Direction } from '../types';

export default function WedgeDistanceBlock({
  block,
  onUpdateCurrentShot,
  onSetDirection,
  onRecord,
  onEditPrevious,
  onComplete,
  onToggleShowAll,
}: {
  block: Block;
  onUpdateCurrentShot: (blockId: string, ballSpeed: string) => void;
  onSetDirection: (blockId: string, dir: Direction) => void;
  onRecord: (blockId: string) => void;
  onEditPrevious: (blockId: string) => void;
  onComplete: (blockId: string) => void;
  onToggleShowAll: (blockId: string) => void;
}) {
  const test = block.distanceTest;
  if (!test) return null;

  const numShots = block.shots;
  const distances = test.distances ?? [];
  const recordedCount = test.shots.filter((s) => s.recorded).length;
  const remaining = Math.max(0, numShots - recordedCount);
  const currentTarget = recordedCount < numShots ? distances[recordedCount] : null;
  const cs = test.currentShot ?? { ballSpeed: '', direction: null as Direction };

  const sortedShots = test.shots.filter((s) => s.recorded);
  const showAll = !!test.showAllShots;
  const visible = showAll ? sortedShots.slice().reverse() : sortedShots.slice(-3).reverse();

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="border border-border bg-muted/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
            Shots Recorded
          </span>
          <span className="font-display text-lg font-bold text-foreground">
            {recordedCount}
            <span className="font-mono text-sm font-normal text-muted-foreground"> / {numShots}</span>
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${(recordedCount / numShots) * 100}%` }}
          />
        </div>
      </div>

      {/* Active shot card */}
      {!block.completed && remaining > 0 && currentTarget !== null && (
        <div className="border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
              Shot {recordedCount + 1}
            </div>
            <div className="font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
              of {numShots}
            </div>
          </div>

          <div className="mb-4 border border-primary/30 bg-accent/40 p-4 text-center">
            <div className="mb-1 font-mono text-label uppercase tracking-[0.2em] text-primary">
              Target Distance
            </div>
            <div className="font-display text-5xl font-extrabold text-foreground">
              {currentTarget}
              <span className="ml-1 font-mono text-base font-normal text-muted-foreground">yds</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
                Ball Speed (mph)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="e.g. 78.4"
                value={cs.ballSpeed}
                onChange={(e) => onUpdateCurrentShot(block.id, e.target.value)}
                className="mt-1 h-10 w-full border border-border bg-background px-3 font-body text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
                Direction
              </label>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {(['L', 'O', 'R'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onSetDirection(block.id, d)}
                    className={`h-10 border font-mono text-label uppercase tracking-[0.18em] transition-colors duration-150 ${
                      cs.direction === d
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
                    }`}
                  >
                    {d === 'L' ? 'Left' : d === 'O' ? 'On' : 'Right'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => onRecord(block.id)}>
              {remaining === 1 ? 'Record Final Shot' : 'Record · Next Shot'} →
            </Button>
            {recordedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onEditPrevious(block.id)}>
                ↶ Edit Previous
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Recorded shots */}
      {recordedCount > 0 && (
        <div className="border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
              Recorded Shots
            </span>
            {sortedShots.length > 3 && (
              <button
                type="button"
                onClick={() => onToggleShowAll(block.id)}
                className="font-mono text-label uppercase tracking-[0.18em] text-primary hover:underline"
              >
                {showAll ? 'Show last 3' : `Show all ${sortedShots.length}`}
              </button>
            )}
          </div>
          <ul className="divide-y divide-border">
            {visible.map((shot) => {
              const realIdx = sortedShots.indexOf(shot);
              const dirLabel =
                shot.direction === 'L'
                  ? 'Left'
                  : shot.direction === 'R'
                  ? 'Right'
                  : shot.direction === 'O'
                  ? 'On'
                  : '—';
              return (
                <li
                  key={`${shot.timestamp}-${realIdx}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="font-mono text-label text-muted-foreground">#{realIdx + 1}</span>
                  <span className="font-mono text-label text-muted-foreground">
                    TGT <span className="text-foreground">{shot.target}y</span>
                  </span>
                  <span className="font-mono text-label text-muted-foreground">
                    BALL <span className="text-foreground">{shot.ballSpeed || '—'}</span>
                  </span>
                  <span className="font-mono text-label uppercase tracking-[0.18em] text-foreground">
                    {dirLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Complete / summary */}
      {!block.completed ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={recordedCount === 0}
          onClick={() => onComplete(block.id)}
        >
          Complete Block {recordedCount < numShots ? `(${recordedCount}/${numShots})` : ''}
        </Button>
      ) : (
        <BlockSummary shots={sortedShots} />
      )}
    </div>
  );
}

function BlockSummary({ shots }: { shots: { target: number; ballSpeed: string; direction: Direction }[] }) {
  const usable = shots.filter((s) => s.ballSpeed);
  if (usable.length === 0) {
    return (
      <div className="border border-border bg-muted/40 p-4">
        <div className="mb-1 font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
          Block Summary
        </div>
        <p className="text-caption text-muted-foreground">No ball speed data recorded.</p>
      </div>
    );
  }

  const bands: Record<string, { band: number; shots: typeof usable }> = {};
  usable.forEach((s) => {
    const band = Math.floor(s.target / 10) * 10;
    const key = `${band}-${band + 9}`;
    if (!bands[key]) bands[key] = { band, shots: [] };
    bands[key].shots.push(s);
  });
  const bandKeys = Object.keys(bands).sort((a, b) => bands[a].band - bands[b].band);

  return (
    <div className="border border-border bg-muted/40 p-4">
      <div className="mb-3 font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
        Block Summary · By 10-Yard Band
      </div>
      <div className="space-y-3">
        {bandKeys.map((key) => {
          const b = bands[key];
          const speeds = b.shots.map((s) => parseFloat(s.ballSpeed)).filter((n) => !isNaN(n));
          const sigma = stddev(speeds);
          const range = speeds.length >= 2 ? Math.max(...speeds) - Math.min(...speeds) : null;
          const dirCounts: Record<'L' | 'O' | 'R', number> = { L: 0, O: 0, R: 0 };
          b.shots.forEach((s) => {
            if (s.direction && s.direction in dirCounts) dirCounts[s.direction]++;
          });
          return (
            <div key={key} className="grid grid-cols-2 gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:grid-cols-4">
              <div className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                {key}
                <span className="ml-1 font-mono text-label font-normal text-muted-foreground">y</span>
                <div className="font-mono text-label font-normal text-muted-foreground">
                  {b.shots.length} shot{b.shots.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="font-mono text-label uppercase tracking-[0.18em] text-muted-foreground">
                Sigma
                <div className="font-display text-sm font-bold text-foreground">
                  {sigma !== null ? sigma.toFixed(1) : '—'}
                </div>
              </div>
              <div className="font-mono text-label uppercase tracking-[0.18em] text-muted-foreground">
                Range
                <div className="font-display text-sm font-bold text-foreground">
                  {range !== null ? range.toFixed(1) : '—'}
                </div>
              </div>
              <div className="font-mono text-label uppercase tracking-[0.18em] text-muted-foreground">
                Direction
                <div className="font-display text-sm font-bold text-foreground">
                  {dirCounts.L}L · {dirCounts.O}O · {dirCounts.R}R
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
