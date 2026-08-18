'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LS_WINNERS_CIRCLE_RUNS } from '@/lib/constants';
import { useDrillHistory } from '@/lib/golf/useDrillHistory';
import './WinnersCircle.css';

// ── Types ─────────────────────────────────────────────────────────
type Screen = 'home' | 'play' | 'result';

interface Round {
  distanceFt: number;
  teesAttempted: number;
  teesMade: number;
}

export interface WinnersCircleRun {
  id: string;
  date: string;
  timestamp: number;
  totalMakes: number;
  maxDistanceReached: number;
  rounds: Round[];
  standardCleared: boolean;
  endedEarly: boolean;
}

interface ResultState {
  run: WinnersCircleRun;
  saved: boolean;
}

// ── Drill constants ────────────────────────────────────────────────
const START_DISTANCE_FT = 4;
const START_TEES = 5;
const STANDARD_MAKES = 20;

const RULES = [
  `Place ${START_TEES} tees in a circle around the hole at ${START_DISTANCE_FT} feet. Putt once from each tee.`,
  'Make the putt and the tee survives. Miss and the tee is removed for good.',
  'After every tee has been attempted, move back 1 foot and repeat with the survivors.',
  'The drill ends the moment you have no tees left. Total makes is your score.',
];

// ── Drill state machine ────────────────────────────────────────────
// The entire drill is derived from the ordered sequence of putt results,
// which keeps recording and undo trivially consistent with the rules.
interface DrillState {
  rounds: Round[];               // completed rounds, in order
  currentDistanceFt: number;
  teesInPlay: number;            // tees at the start of the current round
  currentResults: boolean[];     // putts logged so far this round
  totalMakes: number;
  finished: boolean;             // all tees lost
}

function deriveState(putts: boolean[]): DrillState {
  const totalMakes = putts.filter(Boolean).length;
  const rounds: Round[] = [];
  let tees = START_TEES;
  let distance = START_DISTANCE_FT;
  let i = 0;

  for (;;) {
    const results = putts.slice(i, i + tees);
    if (results.length < tees) {
      return { rounds, currentDistanceFt: distance, teesInPlay: tees, currentResults: results, totalMakes, finished: false };
    }
    const made = results.filter(Boolean).length;
    rounds.push({ distanceFt: distance, teesAttempted: tees, teesMade: made });
    i += tees;
    if (made === 0) {
      return { rounds, currentDistanceFt: distance, teesInPlay: 0, currentResults: [], totalMakes, finished: true };
    }
    tees = made;
    distance += 1;
  }
}

function buildRun(putts: boolean[], endedEarly: boolean): WinnersCircleRun {
  const state = deriveState(putts);
  const rounds = [...state.rounds];
  if (!state.finished && state.currentResults.length > 0) {
    rounds.push({
      distanceFt: state.currentDistanceFt,
      teesAttempted: state.currentResults.length,
      teesMade: state.currentResults.filter(Boolean).length,
    });
  }
  return {
    id: crypto.randomUUID(),
    date: todayISO(),
    timestamp: Date.now(),
    totalMakes: state.totalMakes,
    maxDistanceReached: rounds.length > 0 ? rounds[rounds.length - 1].distanceFt : START_DISTANCE_FT,
    rounds,
    standardCleared: state.totalMakes >= STANDARD_MAKES,
    endedEarly,
  };
}

// ── Helpers ────────────────────────────────────────────────────────
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const getRunId = (r: WinnersCircleRun) => r.id;
const getRunPlayedAt = (r: WinnersCircleRun) => r.date;

// ── Tee glyph ──────────────────────────────────────────────────────
type TeeStatus = 'lost' | 'missed' | 'made' | 'pending' | 'current';

function TeeGlyph({ status }: { status: TeeStatus }) {
  const dimmed = status === 'lost' || status === 'missed';
  return (
    <div className={`wc-tee is-${status}`}>
      <svg viewBox="0 0 24 32" width="26" height="34" aria-hidden="true">
        <path
          d="M3 2 H21 L16.5 9 H14 L12 30 L10 9 H7.5 Z"
          fill={dimmed ? 'none' : 'currentColor'}
          stroke="currentColor"
          strokeWidth={dimmed ? 1.5 : 0}
          strokeLinejoin="round"
        />
      </svg>
      {status === 'made' && <span className="wc-tee-dot" />}
    </div>
  );
}

function TeeRow({ state }: { state: DrillState }) {
  const lostBefore = START_TEES - state.teesInPlay;
  const slots: TeeStatus[] = [];
  for (let i = 0; i < START_TEES; i++) {
    if (i < lostBefore) {
      slots.push('lost');
    } else {
      const k = i - lostBefore;
      if (k < state.currentResults.length) {
        slots.push(state.currentResults[k] ? 'made' : 'missed');
      } else {
        slots.push(k === state.currentResults.length ? 'current' : 'pending');
      }
    }
  }
  return (
    <div className="wc-tee-row">
      {slots.map((status, i) => <TeeGlyph key={i} status={status} />)}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function WinnersCircle() {
  const [screen, setScreen]                 = useState<Screen>('home');
  const [storageAvailable, setStorageAvail] = useState(true);
  const [putts, setPutts]                   = useState<boolean[]>([]);
  const [result, setResult]                 = useState<ResultState | null>(null);

  const { sessions: runs, record } = useDrillHistory<WinnersCircleRun>({
    drillType: 'winners-circle',
    lsKey: LS_WINNERS_CIRCLE_RUNS,
    getId: getRunId,
    getPlayedAt: getRunPlayedAt,
  });

  useEffect(() => {
    try {
      localStorage.setItem('_wc_probe', '1');
      localStorage.removeItem('_wc_probe');
    } catch {
      setStorageAvail(false);
    }
  }, []);

  function handleStart() {
    setPutts([]);
    setScreen('play');
  }

  function finishRun(puttList: boolean[], endedEarly: boolean) {
    setResult({ run: buildRun(puttList, endedEarly), saved: false });
    setScreen('result');
  }

  function handlePutt(made: boolean) {
    const next = [...putts, made];
    setPutts(next);
    if (deriveState(next).finished) finishRun(next, false);
  }

  function handleSave() {
    if (!result || result.saved) return;
    record(result.run);
    setResult({ ...result, saved: true });
  }

  if (screen === 'home') {
    return <HomeScreen runs={runs} storageAvailable={storageAvailable} onStart={handleStart} />;
  }
  if (screen === 'play') {
    return (
      <PlayScreen
        state={deriveState(putts)}
        canUndo={putts.length > 0}
        onPutt={handlePutt}
        onUndo={() => setPutts(putts.slice(0, -1))}
        onEndDrill={() => finishRun(putts, true)}
        onQuit={() => setScreen('home')}
      />
    );
  }
  if (screen === 'result' && result) {
    return (
      <ResultScreen
        result={result}
        onSave={handleSave}
        onRunAgain={handleStart}
        onDone={() => setScreen('home')}
      />
    );
  }
  return null;
}

// ── Home Screen ────────────────────────────────────────────────────
function HomeScreen({ runs, storageAvailable, onStart }: {
  runs: WinnersCircleRun[];
  storageAvailable: boolean;
  onStart: () => void;
}) {
  const recent = runs.slice(0, 3);

  return (
    <div className="wc-wrapper">
      {!storageAvailable && (
        <div className="wc-storage-warn">
          History won&apos;t be saved in this browser session.
        </div>
      )}

      {/* ── Hero ── */}
      <div className="wc-hero">
        <p className="wc-hero-subtitle">5 tees · start at 4 ft · survive as long as you can</p>
        <button className="wc-primary-btn" onClick={onStart}>
          Start Drill
        </button>
      </div>

      {/* ── The Drill ── */}
      <div className="wc-card">
        <p className="wc-section-label">The Drill</p>
        <p className="wc-body-text">
          Five tees circle the hole at 4 feet. Every made putt keeps a tee in
          play; every miss removes it permanently. When all the tees at a
          distance have been attempted, move back 1 foot and go again with the
          survivors. There is no distance cap — the drill only ends when the
          last tee is gone, so every putt matters more than the one before it.
        </p>
      </div>

      {/* ── The Rules ── */}
      <div className="wc-card">
        <p className="wc-section-label">The Rules</p>
        <div className="wc-rules">
          {RULES.map((text, i) => (
            <div className="wc-rule" key={i}>
              <span className="wc-rule-key">0{i + 1}</span>
              <span className="wc-rule-text">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── The Standard ── */}
      <div className="wc-card">
        <p className="wc-section-label">The Standard</p>
        <div className="wc-standard-line">
          <span className="wc-standard-number">{STANDARD_MAKES}</span>
          <span className="wc-standard-copy">
            total makes clears the Winners Circle. From 4 feet a tour player
            makes ~94%; by 8 feet that drops to ~50%. Clearing the Standard
            means surviving deep into the 7–9 ft range with most of your tees
            intact. It is supposed to be hard.
          </span>
        </div>
      </div>

      {/* ── Recent Runs ── */}
      {recent.length > 0 && (
        <div className="wc-card">
          <p className="wc-section-label">Recent Runs</p>
          <div className="wc-recent-list">
            {recent.map(r => (
              <div className="wc-recent-row" key={r.id}>
                <span className="wc-recent-date">{formatDate(r.date)}</span>
                <span className="wc-recent-score">
                  {r.totalMakes}<span> makes</span>
                </span>
                <span className="wc-recent-dist">{r.maxDistanceReached} ft max</span>
                <span className={`wc-recent-badge ${r.standardCleared ? 'is-cleared' : ''}`}>
                  {r.standardCleared ? 'Cleared' : `${STANDARD_MAKES - r.totalMakes} short`}
                </span>
              </div>
            ))}
          </div>
          <Link href="/player-path/putting/winners-circle/history" className="wc-view-history-link">
            View full history →
          </Link>
        </div>
      )}

      {/* ── Bottom CTA ── */}
      <button className="wc-primary-btn" onClick={onStart}>
        Start Drill
      </button>

      <p className="wc-credit">
        Credit: John Graham, as described on the Spin Axis podcast.
      </p>
    </div>
  );
}

// ── Play Screen ────────────────────────────────────────────────────
function PlayScreen({ state, canUndo, onPutt, onUndo, onEndDrill, onQuit }: {
  state: DrillState;
  canUndo: boolean;
  onPutt: (made: boolean) => void;
  onUndo: () => void;
  onEndDrill: () => void;
  onQuit: () => void;
}) {
  const [confirmQuit, setConfirmQuit] = useState(false);
  const roundNumber = state.rounds.length + 1;
  const toClear = STANDARD_MAKES - state.totalMakes;

  function handleQuit() {
    if (!confirmQuit) {
      setConfirmQuit(true);
      return;
    }
    onQuit();
  }

  return (
    <div className="wc-wrapper">
      <div className="wc-top-nav">
        <button className="wc-back-btn" onClick={handleQuit} onBlur={() => setConfirmQuit(false)}>
          {confirmQuit ? 'Tap to confirm' : '✕ Quit'}
        </button>
        <span className="wc-nav-label">Winners Circle</span>
        <button className="wc-ghost-btn" onClick={onEndDrill}>
          End Drill
        </button>
      </div>

      {/* ── Distance ── */}
      <div className="wc-card wc-play-card">
        <p className="wc-distance-eyebrow">
          Round {roundNumber} · {state.teesInPlay} {state.teesInPlay === 1 ? 'tee' : 'tees'} in play
        </p>
        <div className="wc-distance" key={state.currentDistanceFt}>
          {state.currentDistanceFt}<span>FT</span>
        </div>

        {/* ── Tees ── */}
        <TeeRow state={state} />

        {/* ── Running total ── */}
        <div className="wc-makes-row">
          <span className="wc-makes-value">{state.totalMakes}</span>
          <span className="wc-makes-label">
            {toClear > 0
              ? `makes · ${toClear} to clear the standard`
              : 'makes · standard cleared'}
          </span>
        </div>
      </div>

      {/* ── Inputs ── */}
      <div className="wc-btn-row">
        <button className="wc-made-btn" onClick={() => onPutt(true)}>
          Tee Made
        </button>
        <button className="wc-missed-btn" onClick={() => onPutt(false)}>
          Tee Missed
        </button>
      </div>

      <button className="wc-undo-btn" onClick={onUndo} disabled={!canUndo}>
        Undo last putt
      </button>
    </div>
  );
}

// ── Result Screen ──────────────────────────────────────────────────
function ResultScreen({ result, onSave, onRunAgain, onDone }: {
  result: ResultState;
  onSave: () => void;
  onRunAgain: () => void;
  onDone: () => void;
}) {
  const { run, saved } = result;
  const toClear = STANDARD_MAKES - run.totalMakes;

  return (
    <div className="wc-wrapper">
      <div className="wc-top-nav">
        <button className="wc-back-btn" onClick={onDone}>← Done</button>
        <span className="wc-nav-label">Drill Result</span>
        <span style={{ minWidth: 60 }} />
      </div>

      {/* ── Score hero ── */}
      <div className="wc-card" style={{ padding: 0 }}>
        <div className="wc-result-hero">
          <span className="wc-result-score">{run.totalMakes}</span>
          <div className="wc-result-score-label">Total Makes</div>
          {run.endedEarly && <div className="wc-result-note">Drill ended early</div>}
        </div>
        <div className="wc-result-badge-wrap">
          {run.standardCleared ? (
            <span className="wc-badge-cleared">Standard Cleared</span>
          ) : (
            <span className="wc-badge-pending">
              {toClear} more to clear the Standard
            </span>
          )}
          <span className="wc-result-dist">
            Max distance · {run.maxDistanceReached} ft
          </span>
        </div>
      </div>

      {/* ── Round breakdown ── */}
      {run.rounds.length > 0 && (
        <div className="wc-card">
          <p className="wc-section-label">Round Breakdown</p>
          <div className="wc-round-head">
            <span>Distance</span>
            <span>Tees</span>
            <span>Made</span>
            <span>Lost</span>
          </div>
          {run.rounds.map(r => (
            <div className="wc-round-row" key={r.distanceFt}>
              <span className="wc-round-dist">{r.distanceFt} ft</span>
              <span>{r.teesAttempted}</span>
              <span className="wc-round-made">{r.teesMade}</span>
              <span className={r.teesAttempted - r.teesMade > 0 ? 'wc-round-lost' : ''}>
                {r.teesAttempted - r.teesMade}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── CTAs ── */}
      <div className="wc-cta-row">
        {saved ? (
          <Link
            href="/player-path/putting/winners-circle/history"
            className="wc-primary-btn"
            style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 0 }}
          >
            View History
          </Link>
        ) : (
          <button className="wc-primary-btn" style={{ marginTop: 0 }} onClick={onSave}>
            Save Run
          </button>
        )}
        <button className="wc-secondary-btn" style={{ marginTop: 0 }} onClick={onRunAgain}>
          Run Again
        </button>
      </div>
      {!saved && (
        <button className="wc-undo-btn" onClick={onDone}>
          Discard run
        </button>
      )}
    </div>
  );
}
