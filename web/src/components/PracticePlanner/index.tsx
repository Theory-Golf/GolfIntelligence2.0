'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { seedWeekConfig, todayISO, uid } from './defaults';
import {
  buildSessionBlocks,
  generateWedgeDistances,
} from './logic';
import { isPlannerExport, storage } from './storage';
import type {
  Block,
  Direction,
  HistoryEntry,
  PlannerExport,
  PracticeIntent,
  Session,
  WeekConfig,
} from './types';
import EmptyState from './parts/EmptyState';
import SetupView from './views/SetupView';
import PlanView from './views/PlanView';
import SessionView, { type SessionHandlers } from './views/SessionView';
import ProgressView from './views/ProgressView';

type TabKey = 'setup' | 'plan' | 'session' | 'progress';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'setup', label: 'Setup' },
  { key: 'plan', label: 'Plan' },
  { key: 'session', label: 'Session' },
  { key: 'progress', label: 'Progress' },
];

export default function PracticePlanner() {
  const [hydrated, setHydrated] = useState(false);
  const [weekConfig, setWeekConfig] = useState<WeekConfig | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<TabKey>('setup');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedTimer = useRef<number | null>(null);

  // Hydrate from localStorage once on the client
  useEffect(() => {
    const { weekConfig: wc, currentSession: cs, history: h } = storage.loadAll();
    setWeekConfig(wc);
    setSession(cs);
    setHistory(h);
    setTab(cs ? 'session' : wc ? 'plan' : 'setup');
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

  // ── Empty-state handlers ────────────────────────────────────
  const handleGetStarted = useCallback(() => {
    setWeekConfig(seedWeekConfig());
    setTab('setup');
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
        setTab('progress');
      } catch {
        window.alert('Import failed: invalid JSON.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleExport = useCallback(() => {
    const data: PlannerExport = {
      exportDate: new Date().toISOString(),
      version: 1,
      weekConfig,
      currentSession: session,
      history,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tg-practice-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [weekConfig, session, history]);

  const handleClearAll = useCallback(() => {
    if (!window.confirm('Clear ALL data — history, week config, current session? This cannot be undone.')) {
      return;
    }
    setWeekConfig(null);
    setSession(null);
    setHistory([]);
    setTab('setup');
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
      const next: Session = {
        date: todayISO(),
        shotBudget,
        includeDriver,
        ironFocusId,
        blocks,
      };
      setSession(next);
      setTab('session');
    },
    [weekConfig],
  );

  const handleEndSession = useCallback(() => {
    if (!window.confirm('End this session? Logged progress is already saved to history.')) return;
    setSession(null);
    setTab('plan');
  }, []);

  const handleResetSession = useCallback(() => {
    if (!window.confirm('Discard this session and rebuild it? Logged checkpoints stay in history.'))
      return;
    setSession(null);
    setTab('plan');
  }, []);

  // ── Block mutations ─────────────────────────────────────────
  const updateBlock = useCallback(
    (blockId: string, updater: (b: Block) => Block) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => (b.id === blockId ? updater(b) : b)),
        };
      });
    },
    [],
  );

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
        setSession((prev) => {
          if (!prev) return prev;
          let entryToAppend: HistoryEntry | null = null;
          const blocks = prev.blocks.map((b) => {
            if (b.id !== blockId || !b.checkpoints) return b;
            const checkpoints = b.checkpoints.map((cp) => {
              if (cp.id !== cpId || cp.logged) return cp;
              const score = cp.swings.filter((s) => s === true).length;
              entryToAppend = {
                date: prev.date,
                timestamp: new Date().toISOString(),
                elementId: cp.elementId,
                elementName: b.elementName || b.name,
                score,
                total: 5,
                kind: 'technical',
                blockType: b.type,
              };
              return { ...cp, logged: true, score };
            });
            const completed = checkpoints.every((c) => c.logged) ? true : b.completed;
            return { ...b, checkpoints, completed };
          });
          if (entryToAppend) {
            setHistory((h) => [...h, entryToAppend as HistoryEntry]);
          }
          return { ...prev, blocks };
        });
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
          return { ...b, distanceTest: { ...b.distanceTest, currentShot: { ...cs, direction: dir } } };
        });
      },

      onRecordWedge: (blockId) => {
        setSession((prev) => {
          if (!prev) return prev;
          let completionEntries: HistoryEntry[] = [];
          const blocks = prev.blocks.map((b) => {
            if (b.id !== blockId || !b.distanceTest) return b;
            const cs = b.distanceTest.currentShot ?? { ballSpeed: '', direction: null as Direction };
            const distances = b.distanceTest.distances ?? [];
            const recordedCount = b.distanceTest.shots.filter((s) => s.recorded).length;
            const target = distances[recordedCount] ?? 0;
            const newShot = {
              target,
              ballSpeed: cs.ballSpeed || '',
              direction: cs.direction ?? null,
              recorded: true,
              timestamp: new Date().toISOString(),
            };
            const shots = [...b.distanceTest.shots, newShot];
            const nextDistanceTest = {
              ...b.distanceTest,
              shots,
              currentShot: { ballSpeed: '', direction: null as Direction },
            };
            // Auto-complete when full
            if (shots.filter((s) => s.recorded).length >= b.shots) {
              completionEntries = buildWedgeHistory(b, shots, prev.date);
              return { ...b, distanceTest: nextDistanceTest, completed: true };
            }
            return { ...b, distanceTest: nextDistanceTest };
          });
          if (completionEntries.length > 0) {
            setHistory((h) => [...h, ...completionEntries]);
          }
          return { ...prev, blocks };
        });
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
        setSession((prev) => {
          if (!prev) return prev;
          let entries: HistoryEntry[] = [];
          const blocks = prev.blocks.map((b) => {
            if (b.id !== blockId || b.completed || !b.distanceTest) return b;
            entries = buildWedgeHistory(b, b.distanceTest.shots, prev.date);
            return { ...b, completed: true };
          });
          if (entries.length > 0) {
            setHistory((h) => [...h, ...entries]);
          }
          return { ...prev, blocks };
        });
      },

      onToggleShowAllShots: (blockId) => {
        updateBlock(blockId, (b) => {
          if (!b.distanceTest) return b;
          return { ...b, distanceTest: { ...b.distanceTest, showAllShots: !b.distanceTest.showAllShots } };
        });
      },

      onToggleSimple: (blockId) => {
        updateBlock(blockId, (b) => ({ ...b, completed: !b.completed }));
      },

      onEndSession: handleEndSession,
      onResetSession: handleResetSession,
    }),
    [updateBlock, handleEndSession, handleResetSession],
  );

  // ── Render ──────────────────────────────────────────────────
  const showEmptyState = hydrated && !weekConfig && history.length === 0 && !session;

  return (
    <section className="px-6 pb-20">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 space-y-4">
          <p className="eyebrow">The Plan</p>
          <h2 className="font-display text-[clamp(32px,5vw,56px)] font-extrabold uppercase leading-[0.95] tracking-tight text-foreground">
            Build the <span className="text-primary">session</span>
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            A guided practice cycle: set your weekly technical focus, scale a session to your shot
            budget, run structured blocks with checkpoints and practice-intent gates, then track
            acquisition over time. Data lives on this device for now — future versions will sync to
            your player profile and The Library.
          </p>
        </header>

        {!hydrated ? (
          <div className="h-32" aria-hidden />
        ) : showEmptyState ? (
          <EmptyState onGetStarted={handleGetStarted} onImport={handleImport} />
        ) : (
          <>
            <nav className="mb-8 flex flex-wrap gap-1 border-b border-border" role="tablist">
              {TABS.map((t) => {
                const active = t.key === tab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.key)}
                    className={`-mb-px border-b-2 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors duration-150 ${
                      active
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>

            {tab === 'setup' && (
              <SetupView
                weekConfig={weekConfig ?? seedEmptyConfig()}
                setWeekConfig={(next) => setWeekConfig(next)}
                onSave={handleSaveWeekConfig}
                savedAt={savedAt}
              />
            )}
            {tab === 'plan' && weekConfig && (
              <PlanView
                weekConfig={weekConfig}
                currentSession={session}
                onStart={handleStartSession}
                onJumpToSession={() => setTab('session')}
                onDiscard={handleResetSession}
              />
            )}
            {tab === 'plan' && !weekConfig && (
              <NeedSetupNotice onGo={() => setTab('setup')} />
            )}
            {tab === 'session' && weekConfig && (
              <SessionView
                session={session}
                weekConfig={weekConfig}
                history={history}
                handlers={handlers}
                onGoToPlan={() => setTab('plan')}
              />
            )}
            {tab === 'session' && !weekConfig && <NeedSetupNotice onGo={() => setTab('setup')} />}
            {tab === 'progress' && (
              <ProgressView
                history={history}
                weekConfig={weekConfig}
                onExport={handleExport}
                onImport={handleImport}
                onClearAll={handleClearAll}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function buildWedgeHistory(block: Block, shots: { recorded: boolean; ballSpeed: string; direction: Direction; target: number; timestamp: string }[], date: string): HistoryEntry[] {
  const valid = shots.filter((s) => s.recorded && s.ballSpeed);
  if (valid.length === 0) return [];
  const ballSpeeds = valid.map((s) => parseFloat(s.ballSpeed)).filter((n) => !isNaN(n));
  const avg = ballSpeeds.length ? ballSpeeds.reduce((a, b) => a + b, 0) / ballSpeeds.length : null;
  const entries: HistoryEntry[] = valid.map((s) => ({
    date,
    timestamp: s.timestamp,
    elementId: 'wedge_distance',
    elementName: 'Distance Wedges',
    kind: 'wedge_shot',
    blockType: block.type,
    blockSubtype: block.subtype,
    target: s.target,
    ballSpeed: parseFloat(s.ballSpeed) || null,
    direction: s.direction,
  }));
  entries.push({
    date,
    timestamp: new Date().toISOString(),
    elementId: 'wedge_distance',
    elementName: 'Distance Wedges',
    kind: 'distance',
    blockType: 'wedge-distance',
    blockSubtype: block.subtype,
    score: valid.length,
    total: block.shots,
    avgBallSpeed: avg,
  });
  return entries;
}

function seedEmptyConfig(): WeekConfig {
  const date = todayISO();
  return { date, startDate: date, ironElements: [], driverElements: [] };
}

function NeedSetupNotice({ onGo }: { onGo: () => void }) {
  return (
    <div className="border border-dashed border-border bg-muted/40 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        Define your technical focus first.
      </p>
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
