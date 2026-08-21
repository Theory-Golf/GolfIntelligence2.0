'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import SectionHeader from '@/components/playerpath/SectionHeader';
import { derivedClientId } from '@/lib/playerpath/clientId';
import { drillSessionInput, recordDrillSession } from '@/lib/playerpath/record';
import { seedWeekConfig, todayISO, uid } from './defaults';
import {
  buildSessionBlocks,
  completeWedgeBlock,
  generateWedgeDistances,
  getMesocyclePhase,
  getMesocycleWeek,
  logCheckpoint,
  recordWedgeShot,
  summarizeSession,
} from './logic';
import { EXPORT_VERSION, isPlannerExport, storage } from './storage';
import type {
  Block,
  Direction,
  HistoryEntry,
  PlannerExport,
  Session,
  SessionRecord,
  WeekConfig,
} from './types';
import EmptyState from './parts/EmptyState';
import SetupView from './views/SetupView';
import PlanView from './views/PlanView';
import SessionView, { type SessionHandlers } from './views/SessionView';
import SessionCompleteView from './views/SessionCompleteView';
import ProgressView from './views/ProgressView';

/** The Plan is a linear flow, not a tab set: define focus → build → run → done. */
type Stage = 'setup' | 'build' | 'running' | 'complete';

const STEPS: { key: Stage; label: string }[] = [
  { key: 'setup', label: 'Focus' },
  { key: 'build', label: 'Build' },
  { key: 'running', label: 'Run' },
];

export default function PracticePlanner() {
  const [hydrated, setHydrated] = useState(false);
  const [weekConfig, setWeekConfig] = useState<WeekConfig | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [stage, setStage] = useState<Stage>('setup');
  const [lastCompleted, setLastCompleted] = useState<SessionRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedTimer = useRef<number | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage once on the client
  useEffect(() => {
    const { weekConfig: wc, currentSession: cs, history: h, sessions: s } = storage.loadAll();
    setWeekConfig(wc);
    setSession(cs);
    setHistory(h);
    setSessions(s);
    setStage(cs ? 'running' : wc ? 'build' : 'setup');
    setHydrated(true);
  }, []);

  // Persistence side-effects
  useEffect(() => {
    if (!hydrated) return;
    storage.saveWeekConfig(weekConfig);
  }, [weekConfig, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.saveSession(session);
  }, [session, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.saveHistory(history);
  }, [history, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.saveSessions(sessions);
  }, [sessions, hydrated]);

  // ── Empty-state handlers ────────────────────────────────────
  const handleGetStarted = useCallback(() => {
    setWeekConfig(seedWeekConfig());
    setStage('setup');
  }, []);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result ?? ''));
        if (!isPlannerExport(parsed)) {
          window.alert('Import failed: file is not a valid practice planner export.');
          return;
        }
        if (!window.confirm('Import this backup? Current data will be replaced.')) return;
        const data = parsed as PlannerExport;
        setWeekConfig(data.weekConfig ?? null);
        setSession(data.currentSession ?? null);
        setHistory(data.history ?? []);
        setSessions(data.sessions ?? []);
        setLastCompleted(null);
        setStage(data.currentSession ? 'running' : data.weekConfig ? 'build' : 'setup');
        setHistoryOpen(true);
      } catch {
        window.alert('Import failed: invalid JSON.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleExport = useCallback(() => {
    const data: PlannerExport = {
      exportDate: new Date().toISOString(),
      version: EXPORT_VERSION,
      weekConfig,
      currentSession: session,
      history,
      sessions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tg-practice-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [weekConfig, session, history, sessions]);

  const handleClearAll = useCallback(() => {
    if (
      !window.confirm(
        'Clear ALL data — history, saved sessions, week config, current session? This cannot be undone.',
      )
    ) {
      return;
    }
    setWeekConfig(null);
    setSession(null);
    setHistory([]);
    setSessions([]);
    setLastCompleted(null);
    setStage('setup');
  }, []);

  // ── Setup save ──────────────────────────────────────────────
  const handleSaveWeekConfig = useCallback(() => {
    if (!weekConfig) return;
    const ensured: WeekConfig = {
      ...weekConfig,
      date: weekConfig.date || todayISO(),
      startDate: weekConfig.startDate || weekConfig.date || todayISO(),
    };
    setWeekConfig(ensured);
    setSavedAt(Date.now());
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedAt(null), 2200);
  }, [weekConfig]);

  const openHistory = useCallback(() => {
    setHistoryOpen(true);
    window.requestAnimationFrame(() => {
      historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // ── Session lifecycle ───────────────────────────────────────
  const handleStartSession = useCallback(
    (shotBudget: number, includeDriver: 'auto' | 'yes' | 'no', ironFocusId: string) => {
      if (!weekConfig) return;
      const blocks = buildSessionBlocks(weekConfig, shotBudget, includeDriver, ironFocusId);
      // Pre-seed wedge distances so they’re stable for the session
      blocks.forEach((b) => {
        if (b.type === 'wedge-distance' && b.distanceTest) {
          b.distanceTest.distances = generateWedgeDistances(b.shots, b.id + uid('seed'));
          b.distanceTest.currentShot = { ballSpeed: '', direction: null };
        }
      });
      setSession({
        date: todayISO(),
        shotBudget,
        includeDriver,
        ironFocusId,
        blocks,
      });
      setLastCompleted(null);
      setStage('running');
    },
    [weekConfig],
  );

  /**
   * Finish a session: save it as a record, flush anything logged-but-unrecorded,
   * then show the completion summary. This is the only path that keeps the work.
   */
  const handleCompleteSession = useCallback(() => {
    if (!session) return;
    const { record, flushEntries } = summarizeSession(session, weekConfig);
    if (flushEntries.length > 0) {
      setHistory((h) => [...h, ...flushEntries]);
    }
    setSessions((s) => [...s, record]);
    setLastCompleted(record);
    setSession(null);
    setStage('complete');
    // Local write first (the effects above persist it), then push to the
    // player's account so the session follows them off this device. The
    // record's own id is the idempotency key.
    void recordDrillSession(
      drillSessionInput(
        'practice-session',
        derivedClientId('practice-session', record.id),
        record.completedAt,
        { ...record },
      ),
    );
  }, [session, weekConfig]);

  const handleDiscardSession = useCallback(() => {
    if (!window.confirm('Discard this session? Anything already logged stays in your history.'))
      return;
    setSession(null);
    setStage('build');
  }, []);

  // ── Block mutations ─────────────────────────────────────────
  const updateBlock = useCallback((blockId: string, updater: (b: Block) => Block) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === blockId ? updater(b) : b)),
      };
    });
  }, []);

  /** Commit a session change and the history it earned in one pass. */
  const commit = useCallback((next: { session: Session; entries: HistoryEntry[] }) => {
    setSession(next.session);
    if (next.entries.length > 0) {
      setHistory((h) => [...h, ...next.entries]);
    }
  }, []);

  const handlers: SessionHandlers = useMemo(
    () => ({
      onCycleSwing: (blockId, cpId, idx) => {
        updateBlock(blockId, (b) => {
          if (!b.checkpoints) return b;
          // Lock check (iron-technical only)
          if (b.type === 'iron-technical' && b.practiceGates) {
            const cpIdx = b.checkpoints.findIndex((c) => c.id === cpId);
            if (cpIdx > 0) {
              const prevGate = b.practiceGates.find((g) => g.afterCheckpointIdx === cpIdx - 1);
              const prevCp = b.checkpoints[cpIdx - 1];
              if (prevGate && prevCp.logged && !prevGate.intent) return b;
            }
          }
          return {
            ...b,
            checkpoints: b.checkpoints.map((cp) => {
              if (cp.id !== cpId || cp.logged) return cp;
              const cur = cp.swings[idx];
              const nextVal = cur === null ? true : cur === true ? false : null;
              const swings = cp.swings.slice();
              swings[idx] = nextVal;
              return { ...cp, swings };
            }),
          };
        });
      },

      onLogCheckpoint: (blockId, cpId) => {
        if (!session) return;
        commit(logCheckpoint(session, blockId, cpId));
      },

      onSetGateIntent: (blockId, gateId, intent) => {
        updateBlock(blockId, (b) => {
          if (!b.practiceGates) return b;
          return {
            ...b,
            practiceGates: b.practiceGates.map((g) => (g.id === gateId ? { ...g, intent } : g)),
          };
        });
      },

      onClearGateIntent: (blockId, gateId) => {
        updateBlock(blockId, (b) => {
          if (!b.practiceGates) return b;
          return {
            ...b,
            practiceGates: b.practiceGates.map((g) =>
              g.id === gateId ? { ...g, intent: null } : g,
            ),
          };
        });
      },

      onUpdateCurrentShot: (blockId, ballSpeed) => {
        updateBlock(blockId, (b) => {
          if (!b.distanceTest) return b;
          const cs = b.distanceTest.currentShot ?? { ballSpeed: '', direction: null as Direction };
          return { ...b, distanceTest: { ...b.distanceTest, currentShot: { ...cs, ballSpeed } } };
        });
      },

      onSetDirection: (blockId, dir) => {
        updateBlock(blockId, (b) => {
          if (!b.distanceTest) return b;
          const cs = b.distanceTest.currentShot ?? { ballSpeed: '', direction: null as Direction };
          return {
            ...b,
            distanceTest: { ...b.distanceTest, currentShot: { ...cs, direction: dir } },
          };
        });
      },

      onRecordWedge: (blockId) => {
        if (!session) return;
        commit(recordWedgeShot(session, blockId));
      },

      onEditPreviousWedge: (blockId) => {
        updateBlock(blockId, (b) => {
          if (!b.distanceTest) return b;
          const shots = b.distanceTest.shots.slice();
          if (shots.length === 0) return b;
          const last = shots[shots.length - 1];
          shots.pop();
          return {
            ...b,
            distanceTest: {
              ...b.distanceTest,
              shots,
              currentShot: { ballSpeed: last.ballSpeed || '', direction: last.direction },
            },
          };
        });
      },

      onCompleteWedge: (blockId) => {
        if (!session) return;
        commit(completeWedgeBlock(session, blockId));
      },

      onToggleShowAllShots: (blockId) => {
        updateBlock(blockId, (b) => {
          if (!b.distanceTest) return b;
          return {
            ...b,
            distanceTest: { ...b.distanceTest, showAllShots: !b.distanceTest.showAllShots },
          };
        });
      },

      onToggleSimple: (blockId) => {
        updateBlock(blockId, (b) => ({ ...b, completed: !b.completed }));
      },

      onCompleteSession: handleCompleteSession,
      onDiscardSession: handleDiscardSession,
    }),
    [session, commit, updateBlock, handleCompleteSession, handleDiscardSession],
  );

  // ── Render ──────────────────────────────────────────────────
  const hasFocus = !!weekConfig && weekConfig.ironElements.some((e) => e.name);
  const showEmptyState =
    hydrated && !weekConfig && !session && history.length === 0 && sessions.length === 0;

  return (
    <section className="px-6 pb-20">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          index="02"
          eyebrow="The Plan"
          title={
            <>
              Build the <span className="text-primary">session</span>
            </>
          }
          lead="A guided practice cycle: set your weekly technical focus, scale a session to your shot budget, run structured blocks with checkpoints and practice-intent gates, then track acquisition over time. Data lives on this device for now — future versions will sync to your player profile."
        />

        {!hydrated ? (
          <div className="h-32" aria-hidden />
        ) : showEmptyState ? (
          <EmptyState onGetStarted={handleGetStarted} onImport={handleImport} />
        ) : (
          <>
            <StepRail stage={stage} />

            {stage !== 'setup' && weekConfig && (
              <FocusStrip weekConfig={weekConfig} onEdit={() => setStage('setup')} />
            )}

            {stage === 'setup' && (
              <div className="space-y-8">
                <SetupView
                  weekConfig={weekConfig ?? seedEmptyConfig()}
                  setWeekConfig={(next) => setWeekConfig(next)}
                  onSave={handleSaveWeekConfig}
                  savedAt={savedAt}
                />
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
                  <Button onClick={() => setStage('build')} disabled={!hasFocus}>
                    Next · Build the session →
                  </Button>
                  {!hasFocus && (
                    <span className="text-xs text-muted-foreground">
                      Add at least one iron element to continue.
                    </span>
                  )}
                </div>
              </div>
            )}

            {stage === 'build' &&
              (weekConfig ? (
                <PlanView
                  weekConfig={weekConfig}
                  currentSession={session}
                  onStart={handleStartSession}
                  onJumpToSession={() => setStage('running')}
                  onDiscard={handleDiscardSession}
                />
              ) : (
                <NeedSetupNotice onGo={() => setStage('setup')} />
              ))}

            {stage === 'running' &&
              (weekConfig ? (
                <SessionView
                  session={session}
                  weekConfig={weekConfig}
                  history={history}
                  handlers={handlers}
                  onGoToPlan={() => setStage('build')}
                />
              ) : (
                <NeedSetupNotice onGo={() => setStage('setup')} />
              ))}

            {stage === 'complete' &&
              (lastCompleted ? (
                <SessionCompleteView
                  record={lastCompleted}
                  history={history}
                  onPlanAnother={() => setStage('build')}
                  onViewHistory={openHistory}
                />
              ) : (
                <NeedSetupNotice onGo={() => setStage('build')} />
              ))}

            {/* ── History ─────────────────────────────────────── */}
            <div ref={historyRef} className="mt-12 scroll-mt-[72px] border-t border-border pt-6">
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                aria-expanded={historyOpen}
                className="flex w-full items-center justify-between gap-3 py-2 text-left"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Your history
                  {sessions.length > 0 && (
                    <span className="ml-3 text-foreground">
                      {sessions.length} session{sessions.length === 1 ? '' : 's'} saved
                    </span>
                  )}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
                  {historyOpen ? 'Hide −' : 'Show +'}
                </span>
              </button>
              {historyOpen && (
                <div className="pt-6">
                  <ProgressView
                    history={history}
                    sessions={sessions}
                    weekConfig={weekConfig}
                    onExport={handleExport}
                    onImport={handleImport}
                    onClearAll={handleClearAll}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Progress rail — shows where you are in the flow. Not navigation. */
function StepRail({ stage }: { stage: Stage }) {
  const activeIdx = stage === 'complete' ? STEPS.length : STEPS.findIndex((s) => s.key === stage);
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-4">
      {STEPS.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        return (
          <li key={s.key} className="flex items-center gap-3">
            <span
              className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] ${
                isActive ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span
                className={`flex size-5 items-center justify-center border text-[10px] ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isDone
                      ? 'border-foreground text-foreground'
                      : 'border-border text-muted-foreground'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </span>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="h-px w-6 bg-border sm:w-10" />
            )}
          </li>
        );
      })}
      {stage === 'complete' && (
        <li className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
          · Complete
        </li>
      )}
    </ol>
  );
}

/** Collapsed view of the week's technical focus once it's been set. */
function FocusStrip({ weekConfig, onEdit }: { weekConfig: WeekConfig; onEdit: () => void }) {
  const week = getMesocycleWeek(weekConfig);
  const phase = getMesocyclePhase(week);
  const elements = weekConfig.ironElements.filter((e) => e.name);
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Week {week} · {phase.phase}
        </div>
        <div className="mt-0.5 truncate text-sm text-foreground">
          {elements.length > 0
            ? elements.map((e) => e.name).join(' · ')
            : 'No technical focus set'}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onEdit}>
        Edit Focus
      </Button>
    </div>
  );
}

function seedEmptyConfig(): WeekConfig {
  const date = todayISO();
  return { date, startDate: date, ironElements: [], driverElements: [] };
}

function NeedSetupNotice({ onGo }: { onGo: () => void }) {
  return (
    <div className="border border-dashed border-border bg-muted/40 p-6 text-center">
      <p className="text-sm text-muted-foreground">Define your technical focus first.</p>
      <button
        type="button"
        onClick={onGo}
        className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-primary hover:underline"
      >
        Open Setup →
      </button>
    </div>
  );
}
