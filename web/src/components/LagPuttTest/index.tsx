'use client';

import { useState, useEffect, useMemo } from 'react';
import { LS_LAG_PUTT_SESSIONS } from '@/lib/constants';
import './LagPuttTest.css';

type Direction = 'short' | 'long';

interface PuttResult {
  putt: number;
  distanceFt: number;
  bucket: number | 'holed';
  direction: Direction | null;
  score: number;
}

interface SavedSession {
  id: number;
  date: string;
  total: number;
  putts: PuttResult[];
}

// ── Distance set ─────────────────────────────────────────────────
// Capped at 60 ft — most practice greens don't have room for longer lag putts.
// 27..60 ft in 3-ft steps.
const DISTANCE_OPTIONS = [27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60];
const NUM_PUTTS = 18;

// ── Score table — buckets in whole feet ──────────────────────────
// A "good" lag putt finishes within ~10% of its starting distance; since most
// putts here start beyond 30 ft, that puts the birdie line at ~3 ft.
const BUCKET_SCORES: Record<string, number> = {
  holed: -2,
  '1': -1,
  '2': -1,
  '3': -1,
  '4': 0,
  '5': 0,
  '6': 1,
  '7': 1,
  '8': 2,
  '9': 2,
  '10': 3,
};

const BUCKET_LABELS: Array<{ key: number | 'holed'; label: string }> = [
  { key: 'holed', label: 'Holed' },
  { key: 1, label: '1 ft' },
  { key: 2, label: '2 ft' },
  { key: 3, label: '3 ft' },
  { key: 4, label: '4 ft' },
  { key: 5, label: '5 ft' },
  { key: 6, label: '6 ft' },
  { key: 7, label: '7 ft' },
  { key: 8, label: '8 ft' },
  { key: 9, label: '9 ft' },
  { key: 10, label: '10+ ft' },
];

// ── Benchmarks (totals across 18 putts) ──────────────────────────
const BENCHMARKS = [
  { label: 'Tour Player',    score: -5.5 },
  { label: 'European Tour',  score: -2.9 },
  { label: 'Challenge Tour', score: -1.5 },
  { label: 'HCP +2',         score:  0.2 },
  { label: 'HCP Scratch',    score:  2.0 },
  { label: 'HCP 5',          score:  6.3 },
  { label: 'HCP 10',         score: 10.7 },
];

// Scale range for the visual bar — extends slightly past extreme benchmarks.
const SCALE_MIN = -8;
const SCALE_MAX = 14;

function pctOnScale(value: number): number {
  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, value));
  return ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
}

function tierForScore(total: number): string {
  // Closest benchmark by absolute distance.
  let best = BENCHMARKS[0];
  let bestDelta = Math.abs(total - best.score);
  for (const b of BENCHMARKS) {
    const d = Math.abs(total - b.score);
    if (d < bestDelta) { best = b; bestDelta = d; }
  }
  return best.label;
}

function generateDistances(): number[] {
  // Shuffle the 16 unique options and take 18 putts (with two repeats at the end).
  const pool = [...DISTANCE_OPTIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const extras: number[] = [];
  while (pool.length + extras.length < NUM_PUTTS) {
    extras.push(DISTANCE_OPTIONS[Math.floor(Math.random() * DISTANCE_OPTIONS.length)]);
  }
  return [...pool, ...extras];
}

const storage = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ } },
};

// ── Component ────────────────────────────────────────────────────
export default function LagPuttTest() {
  const [screen, setScreen] = useState<'home' | 'play' | 'results'>('home');
  const [distances, setDistances] = useState<number[]>([]);
  const [results, setResults] = useState<PuttResult[]>([]);
  const [puttIdx, setPuttIdx] = useState(0);
  const [selectedBucket, setSelectedBucket] = useState<number | 'holed' | null>(null);
  const [selectedDir, setSelectedDir] = useState<Direction | null>(null);
  const [history, setHistory] = useState<SavedSession[]>([]);

  useEffect(() => {
    const saved = storage.get<SavedSession[]>(LS_LAG_PUTT_SESSIONS);
    if (saved) setHistory(saved);
  }, []);

  function startSession() {
    setDistances(generateDistances());
    setResults([]);
    setPuttIdx(0);
    setSelectedBucket(null);
    setSelectedDir(null);
    setScreen('play');
  }

  function recordPutt() {
    if (selectedBucket === null) return;
    if (selectedBucket !== 'holed' && selectedDir === null) return;

    const key = String(selectedBucket);
    const score = BUCKET_SCORES[key];

    const result: PuttResult = {
      putt: puttIdx + 1,
      distanceFt: distances[puttIdx],
      bucket: selectedBucket,
      direction: selectedBucket === 'holed' ? null : selectedDir,
      score,
    };
    const next = [...results, result];
    setResults(next);
    setSelectedBucket(null);
    setSelectedDir(null);

    if (puttIdx + 1 >= NUM_PUTTS) {
      const total = next.reduce((s, r) => s + r.score, 0);
      const session: SavedSession = {
        id: Date.now(),
        date: new Date().toISOString(),
        total,
        putts: next,
      };
      const updatedHistory = [session, ...history].slice(0, 50);
      setHistory(updatedHistory);
      storage.set(LS_LAG_PUTT_SESSIONS, updatedHistory);
      setScreen('results');
    } else {
      setPuttIdx(puttIdx + 1);
    }
  }

  const total = useMemo(() => results.reduce((s, r) => s + r.score, 0), [results]);

  // ── HOME ───────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="lpt-wrapper">
        <div className="lpt-card">
          <p className="lpt-card-eyebrow">Skill Assessment</p>
          <h2 className="lpt-card-title">Lag Putt Test</h2>
          <p className="lpt-card-copy">
            Adapted from the Swedish Golf Team protocol. Hit 18 putts from random
            distances between 27 and 60 feet. After each putt, log how far the ball
            finished from the hole — short or long.
          </p>
          <div className="lpt-rules">
            <div className="lpt-rule">
              <span className="lpt-rule-key">01</span>
              <span className="lpt-rule-text">App generates 18 distances between 27 and 60 ft</span>
            </div>
            <div className="lpt-rule">
              <span className="lpt-rule-key">02</span>
              <span className="lpt-rule-text">One putt per position — measure center of hole to center of ball</span>
            </div>
            <div className="lpt-rule">
              <span className="lpt-rule-key">03</span>
              <span className="lpt-rule-text">Score is the total across 18 putts — lower is better</span>
            </div>
          </div>

          <table className="lpt-table">
            <thead>
              <tr><th>Result</th><th>Score</th></tr>
            </thead>
            <tbody>
              <tr><td>Holed</td><td>−2 (Eagle)</td></tr>
              <tr><td>1–3 ft</td><td>−1 (Birdie)</td></tr>
              <tr><td>4–5 ft</td><td>0 (Par)</td></tr>
              <tr><td>6–7 ft</td><td>+1 (Bogey)</td></tr>
              <tr><td>8–9 ft</td><td>+2 (Double)</td></tr>
              <tr><td>10+ ft</td><td>+3 (Triple)</td></tr>
            </tbody>
          </table>

          <button className="lpt-primary-btn" onClick={startSession}>
            Start Session
          </button>
        </div>

        {history.length > 0 && (
          <div className="lpt-card">
            <p className="lpt-card-eyebrow">History</p>
            <ul className="lpt-history">
              {history.slice(0, 5).map((s) => (
                <li key={s.id} className="lpt-history-row">
                  <span className="lpt-history-date">
                    {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="lpt-history-total">
                    {s.total > 0 ? `+${s.total}` : s.total}
                  </span>
                  <span className="lpt-history-tier">{tierForScore(s.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── PLAY ───────────────────────────────────────────────────────
  if (screen === 'play') {
    const currentDist = distances[puttIdx];
    const progress = (puttIdx / NUM_PUTTS) * 100;

    return (
      <div className="lpt-wrapper">
        <div className="lpt-top-nav">
          <button className="lpt-back-btn" onClick={() => setScreen('home')}>← Exit</button>
          <span className="lpt-nav-shot">Putt {puttIdx + 1} / {NUM_PUTTS}</span>
          <span className="lpt-running">
            {total > 0 ? `+${total}` : total}
          </span>
        </div>

        <div className="lpt-progress-track">
          <div className="lpt-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="lpt-card lpt-card-distance">
          <p className="lpt-card-eyebrow">Putt from</p>
          <div className="lpt-distance-display">
            <span className="lpt-distance-number">{currentDist}</span>
            <span className="lpt-distance-unit">ft</span>
          </div>
          <p className="lpt-distance-paces">≈ {Math.round(currentDist / 3)} paces</p>
        </div>

        <div className="lpt-card">
          <p className="lpt-card-eyebrow">Distance from hole</p>
          <div className="lpt-bucket-grid">
            {BUCKET_LABELS.map(({ key, label }) => {
              const k = String(key);
              const isSelected = selectedBucket === key;
              return (
                <button
                  key={k}
                  className={`lpt-bucket-btn${isSelected ? ' is-selected' : ''}`}
                  onClick={() => {
                    setSelectedBucket(key);
                    if (key === 'holed') setSelectedDir(null);
                  }}
                >
                  <span className="lpt-bucket-label">{label}</span>
                  <span className="lpt-bucket-score">
                    {BUCKET_SCORES[k] > 0 ? `+${BUCKET_SCORES[k]}` : BUCKET_SCORES[k]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedBucket !== null && selectedBucket !== 'holed' && (
          <div className="lpt-card">
            <p className="lpt-card-eyebrow">Direction</p>
            <div className="lpt-dir-row">
              <button
                className={`lpt-dir-btn${selectedDir === 'short' ? ' is-selected' : ''}`}
                onClick={() => setSelectedDir('short')}
              >
                Short
              </button>
              <button
                className={`lpt-dir-btn${selectedDir === 'long' ? ' is-selected' : ''}`}
                onClick={() => setSelectedDir('long')}
              >
                Long
              </button>
            </div>
          </div>
        )}

        <button
          className="lpt-primary-btn"
          disabled={
            selectedBucket === null ||
            (selectedBucket !== 'holed' && selectedDir === null)
          }
          onClick={recordPutt}
        >
          {puttIdx + 1 >= NUM_PUTTS ? 'Finish Session' : 'Next Putt →'}
        </button>
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────
  const shortMisses = results.filter((r) => r.direction === 'short').length;
  const longMisses = results.filter((r) => r.direction === 'long').length;
  const holed = results.filter((r) => r.bucket === 'holed').length;
  const inside3 = results.filter(
    (r) => r.bucket === 'holed' || (typeof r.bucket === 'number' && r.bucket <= 3)
  ).length;
  const playerPct = pctOnScale(total);
  const tier = tierForScore(total);

  return (
    <div className="lpt-wrapper">
      <div className="lpt-top-nav">
        <button className="lpt-back-btn" onClick={() => setScreen('home')}>← Done</button>
        <span className="lpt-nav-shot">Results</span>
        <span />
      </div>

      <div className="lpt-card lpt-card-result">
        <p className="lpt-card-eyebrow">Total Score</p>
        <div className="lpt-result-score">
          {total > 0 ? `+${total}` : total}
        </div>
        <div className="lpt-result-tier">{tier} level</div>
      </div>

      <div className="lpt-card">
        <p className="lpt-card-eyebrow">vs Benchmarks</p>
        <div className="lpt-scale">
          <div className="lpt-scale-track">
            {BENCHMARKS.map((b) => (
              <div
                key={b.label}
                className="lpt-scale-mark"
                style={{ left: `${pctOnScale(b.score)}%` }}
              >
                <span className="lpt-scale-tick" />
                <span className="lpt-scale-mark-label">{b.label}</span>
                <span className="lpt-scale-mark-score">
                  {b.score > 0 ? `+${b.score}` : b.score}
                </span>
              </div>
            ))}
            <div
              className="lpt-scale-pin"
              style={{ left: `${playerPct}%` }}
              aria-label="Your score"
            >
              <span className="lpt-scale-pin-dot" />
              <span className="lpt-scale-pin-label">You</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lpt-card">
        <p className="lpt-card-eyebrow">Summary</p>
        <div className="lpt-summary-grid">
          <div className="lpt-summary-cell">
            <span className="lpt-summary-num">{holed}</span>
            <span className="lpt-summary-lab">Holed</span>
          </div>
          <div className="lpt-summary-cell">
            <span className="lpt-summary-num">{inside3}</span>
            <span className="lpt-summary-lab">Inside 3 ft</span>
          </div>
          <div className="lpt-summary-cell">
            <span className="lpt-summary-num">{shortMisses}</span>
            <span className="lpt-summary-lab">Short</span>
          </div>
          <div className="lpt-summary-cell">
            <span className="lpt-summary-num">{longMisses}</span>
            <span className="lpt-summary-lab">Long</span>
          </div>
        </div>
      </div>

      <div className="lpt-card">
        <p className="lpt-card-eyebrow">Per Putt</p>
        <div className="lpt-puttlist">
          <div className="lpt-puttlist-head">
            <span>#</span>
            <span>From</span>
            <span>Left</span>
            <span>Score</span>
          </div>
          {results.map((r) => (
            <div key={r.putt} className="lpt-puttlist-row">
              <span>{r.putt}</span>
              <span>{r.distanceFt} ft</span>
              <span>
                {r.bucket === 'holed'
                  ? 'Holed'
                  : `${r.bucket} ft${r.direction ? ` ${r.direction}` : ''}`}
              </span>
              <span className={r.score < 0 ? 'lpt-score-good' : r.score > 1 ? 'lpt-score-bad' : ''}>
                {r.score > 0 ? `+${r.score}` : r.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button className="lpt-primary-btn" onClick={startSession}>
        New Session
      </button>
    </div>
  );
}
