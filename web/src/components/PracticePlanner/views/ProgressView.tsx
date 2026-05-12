'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { STATUS, fmtDateShort, getElementStatus, stddev } from '../logic';
import type { HistoryEntry, WeekConfig } from '../types';
import StatusPill from '../parts/StatusPill';

export default function ProgressView({
  history,
  weekConfig,
  onExport,
  onImport,
  onClearAll,
}: {
  history: HistoryEntry[];
  weekConfig: WeekConfig | null;
  onExport: () => void;
  onImport: (file: File) => void;
  onClearAll: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (history.length === 0) {
    return (
      <div className="border border-dashed border-border bg-muted/40 p-8 text-center">
        <div className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
          No data yet
        </div>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Once you log checkpoint sets in a session, every element you’ve worked on will show up
          here with its current acquisition status.
        </p>
      </div>
    );
  }

  type ElData = { name: string; kind: HistoryEntry['kind']; entries: HistoryEntry[] };
  const byElement: Record<string, ElData> = {};
  history.forEach((h) => {
    if (!byElement[h.elementId]) {
      byElement[h.elementId] = { name: h.elementName, kind: h.kind, entries: [] };
    }
    byElement[h.elementId].entries.push(h);
    byElement[h.elementId].name = h.elementName;
  });

  const elementIds = Object.keys(byElement).sort((a, b) => {
    const ka = byElement[a].kind === 'technical' ? 0 : 1;
    const kb = byElement[b].kind === 'technical' ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const da = byElement[a].entries[byElement[a].entries.length - 1].timestamp;
    const db = byElement[b].entries[byElement[b].entries.length - 1].timestamp;
    return db.localeCompare(da);
  });

  const techElements = elementIds.filter((id) => byElement[id].kind === 'technical');
  const totalCheckpoints = history.filter((h) => h.kind === 'technical').length;
  const totalSessions = new Set(history.map((h) => h.date)).size;
  const masteredCount = techElements.filter((id) => getElementStatus(history, id) === 'mastered').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sessions Logged" value={String(totalSessions)} />
        <Stat label="Checkpoints" value={String(totalCheckpoints)} />
        <Stat label="Elements" value={String(techElements.length)} />
        <Stat label="Mastered" value={String(masteredCount)} highlight />
      </div>

      <div className="border border-border bg-card p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Status Definitions
        </div>
        <div className="space-y-2">
          {(['building', 'acquiring', 'stable', 'mastered'] as const).map((k) => (
            <div key={k} className="flex items-start gap-3">
              <StatusPill status={k}>{STATUS[k].label}</StatusPill>
              <span className="text-xs text-muted-foreground">{STATUS[k].desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {elementIds.map((eid) => {
          const elData = byElement[eid];
          if (eid === 'wedge_distance') {
            return <WedgeTrendCard key={eid} data={elData} />;
          }
          const status = getElementStatus(history, eid);
          const entries = elData.entries.slice().reverse();
          let cue = '';
          if (weekConfig) {
            const all = [...weekConfig.ironElements, ...weekConfig.driverElements];
            const found = all.find((e) => e.id === eid);
            if (found) cue = found.cue || '';
          }
          return (
            <article key={eid} className="border border-border bg-card p-5">
              <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
                    {elData.name || 'Unnamed'}
                  </div>
                  {cue && (
                    <div className="mt-1 text-xs text-muted-foreground">Cue: “{cue}”</div>
                  )}
                </div>
                <StatusPill status={status}>{STATUS[status].label}</StatusPill>
              </header>
              <div className="space-y-2">
                {entries.slice(0, 8).map((e, i) => {
                  if (e.kind !== 'technical') return null;
                  const score = e.score ?? 0;
                  const total = e.total ?? 5;
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-16 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {fmtDateShort(e.date)}
                      </span>
                      <div className="h-1.5 flex-1 bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(score / total) * 100}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-display text-sm font-bold text-foreground">
                        {score}/{total}
                      </span>
                    </div>
                  );
                })}
              </div>
              {entries.length > 8 && (
                <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  + {entries.length - 8} earlier entries
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="border border-border bg-card p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Data Management
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          All data is stored locally on this device. Export creates a JSON backup. Import restores
          from a backup file.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={onExport}>
            Export Data
          </Button>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Import Data
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.currentTarget.value = '';
            }}
          />
          <Button variant="destructive" size="sm" onClick={onClearAll}>
            Clear All Data
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border border-border bg-card p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-extrabold ${highlight ? 'text-under' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}

function WedgeTrendCard({ data }: { data: { name: string; kind: HistoryEntry['kind']; entries: HistoryEntry[] } }) {
  const shotEntries = data.entries.filter((e) => e.kind === 'wedge_shot');
  const totalSessions = new Set(data.entries.map((e) => e.date)).size;
  const totalShots = shotEntries.length;
  const hasMeaningfulData = totalSessions >= 5 || totalShots >= 30;

  if (shotEntries.length === 0) {
    return (
      <article className="border border-border bg-card p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
              Distance Wedges
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Trend analysis appears as data accumulates.
            </div>
          </div>
          <StatusPill status="pending">No Data</StatusPill>
        </header>
      </article>
    );
  }

  const bands: Record<string, { band: number; shots: HistoryEntry[] }> = {};
  shotEntries.forEach((s) => {
    const dist = s.target ?? NaN;
    if (isNaN(dist)) return;
    const band = Math.floor(dist / 10) * 10;
    const key = `${band}-${band + 9}`;
    if (!bands[key]) bands[key] = { band, shots: [] };
    bands[key].shots.push(s);
  });
  const bandKeys = Object.keys(bands).sort((a, b) => bands[a].band - bands[b].band);

  let worstBand: string | null = null;
  let worstSigma = -1;
  bandKeys.forEach((key) => {
    const speeds = bands[key].shots.map((s) => s.ballSpeed ?? NaN).filter((n) => !isNaN(n));
    if (speeds.length >= 3) {
      const sigma = stddev(speeds);
      if (sigma !== null && sigma > worstSigma) {
        worstSigma = sigma;
        worstBand = key;
      }
    }
  });

  const dirTotals: Record<'L' | 'O' | 'R', number> = { L: 0, O: 0, R: 0 };
  shotEntries.forEach((s) => {
    if (s.direction && s.direction in dirTotals) dirTotals[s.direction as 'L' | 'O' | 'R']++;
  });
  const dirTotal = dirTotals.L + dirTotals.O + dirTotals.R;
  const dirPct = dirTotal > 0
    ? {
        L: Math.round((dirTotals.L / dirTotal) * 100),
        O: Math.round((dirTotals.O / dirTotal) * 100),
        R: Math.round((dirTotals.R / dirTotal) * 100),
      }
    : { L: 0, O: 0, R: 0 };

  return (
    <article className="border border-border bg-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
            Distance Wedges · Trend Analysis
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {totalShots} shot{totalShots !== 1 ? 's' : ''} across {totalSessions} session
            {totalSessions !== 1 ? 's' : ''}
          </div>
        </div>
        <StatusPill status={hasMeaningfulData ? 'stable' : 'acquiring'}>
          {hasMeaningfulData ? 'Trends Available' : 'Building Data'}
        </StatusPill>
      </header>

      {!hasMeaningfulData && (
        <p className="mb-3 text-xs text-muted-foreground">
          Need 5+ sessions or 30+ shots before trend analysis is meaningful. Currently at{' '}
          {totalSessions} session{totalSessions !== 1 ? 's' : ''}, {totalShots} shot
          {totalShots !== 1 ? 's' : ''}.
        </p>
      )}

      {dirTotal > 0 && (
        <div className="mb-4">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Direction Tendency · All Time
          </div>
          <div className="flex h-6 w-full overflow-hidden border border-border">
            {dirPct.L > 0 && (
              <div className="flex items-center justify-center bg-bogey/30 font-mono text-[10px] text-foreground" style={{ flex: dirPct.L }}>
                {dirPct.L}% L
              </div>
            )}
            {dirPct.O > 0 && (
              <div className="flex items-center justify-center bg-under/30 font-mono text-[10px] text-foreground" style={{ flex: dirPct.O }}>
                {dirPct.O}% On
              </div>
            )}
            {dirPct.R > 0 && (
              <div className="flex items-center justify-center bg-bogey/30 font-mono text-[10px] text-foreground" style={{ flex: dirPct.R }}>
                {dirPct.R}% R
              </div>
            )}
          </div>
        </div>
      )}

      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Ball Speed Consistency · By Distance Band
      </div>
      <div className="mt-2 space-y-3">
        {bandKeys.map((key) => {
          const b = bands[key];
          const speeds = b.shots.map((s) => s.ballSpeed ?? NaN).filter((n) => !isNaN(n));
          const sigma = stddev(speeds);
          const range = speeds.length >= 2 ? Math.max(...speeds) - Math.min(...speeds) : null;
          const avg = speeds.length ? speeds.reduce((a, n) => a + n, 0) / speeds.length : null;
          const dirCounts: Record<'L' | 'O' | 'R', number> = { L: 0, O: 0, R: 0 };
          b.shots.forEach((s) => {
            if (s.direction && s.direction in dirCounts) dirCounts[s.direction as 'L' | 'O' | 'R']++;
          });
          const isWorst = key === worstBand && hasMeaningfulData;
          return (
            <div
              key={key}
              className={`grid grid-cols-2 gap-2 border p-3 sm:grid-cols-5 ${
                isWorst ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
              }`}
            >
              <div>
                <div className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                  {key}
                  <span className="ml-1 font-mono text-[10px] font-normal text-muted-foreground">y</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {b.shots.length} shot{b.shots.length !== 1 ? 's' : ''}
                </div>
                {isWorst && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                    Highest Inconsistency
                  </div>
                )}
              </div>
              <Cell label="Avg Spd" value={avg !== null ? avg.toFixed(1) : '—'} />
              <Cell label="Sigma" value={sigma !== null ? sigma.toFixed(1) : '—'} />
              <Cell label="Range" value={range !== null ? range.toFixed(1) : '—'} />
              <Cell label="Direction" value={`${dirCounts.L}L · ${dirCounts.O}O · ${dirCounts.R}R`} />
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}
