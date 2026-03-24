'use client';

import { useState, useMemo, useEffect } from 'react';
import { LS_PUTTING_SESSIONS, LS_PUTTING_PUTTERS } from '@/lib/constants';
import './RoundSimulation.css';

// ── Types ────────────────────────────────────────────────────────
interface PuttSetup {
  distance: number;
  slope: string;
  break: string;
}

interface PuttResult extends PuttSetup {
  speedCorrect: boolean;
  lineCorrect: boolean;
  firstPuttResult: string | null;
  secondPuttDistance: string | null;
  secondPuttMade: boolean | null;
}

interface CurrentResult {
  speedCorrect: boolean;
  lineCorrect: boolean;
  firstPuttResult: string | null;
  secondPuttDistance: string | null;
  secondPuttMade: boolean | null;
}

interface SessionStats {
  onePutts: number;
  twoPutts: number;
  threePutts: number;
  totalPutts: number;
  speedCorrect: number;
  lineCorrect: number;
  strokesGained: number;
  bucketStrokesGained: Record<string, { sg: number; count: number }>;
  scoringSG: number;
  speedBalance: number;
  dirBalance: number;
  speedMisses: { fast: number; slow: number };
  dirMisses: { left: number; right: number };
  missCount: number;
  directionBalance?: number;
}

interface SavedSession {
  id: number;
  date: string;
  putter: string;
  ballMarking: string;
  stats: SessionStats;
}

interface SessionSetup {
  putter: string;
  ballMarking: string;
}

interface Trends {
  avgSG: number;
  avgSpeed: number;
  avgDir: number;
  avgScoringSG: number;
  count: number;
}

interface TrendResult {
  symbol: string;
  cls: string;
}

interface DistanceBucket {
  name: string;
  min: number;
  max: number;
  key: string;
}

// ── PGA Tour expected putts (Mark Broadie research) ─────────────
const EXPECTED_PUTTS_TABLE: Record<number, number> = {
  2: 1.01, 3: 1.04, 4: 1.12, 5: 1.23, 6: 1.30, 7: 1.39, 8: 1.46, 9: 1.53,
  10: 1.61, 11: 1.65, 12: 1.69, 13: 1.72, 14: 1.75, 15: 1.78, 16: 1.80, 17: 1.82,
  18: 1.84, 19: 1.86, 20: 1.87, 21: 1.89, 22: 1.90, 23: 1.91, 24: 1.92, 25: 1.93,
  26: 1.94, 27: 1.95, 28: 1.96, 29: 1.97, 30: 1.98, 31: 1.99, 32: 2.00, 33: 2.00,
  34: 2.01, 35: 2.02, 36: 2.03, 37: 2.04, 38: 2.05, 39: 2.06, 40: 2.07,
  41: 2.08, 42: 2.09, 43: 2.10, 44: 2.11, 45: 2.12, 46: 2.13, 47: 2.14, 48: 2.15,
  49: 2.16, 50: 2.17, 51: 2.18, 52: 2.19, 53: 2.20, 54: 2.21, 55: 2.22, 56: 2.23,
  57: 2.24, 58: 2.25, 59: 2.26, 60: 2.27,
};

function getExpectedPutts(feet: number): number {
  if (feet <= 2) return 1.01;
  if (feet >= 60) return 2.27;
  return EXPECTED_PUTTS_TABLE[feet] || (1.01 + (feet - 2) * 0.022);
}

// ── Distribution that mirrors a real 18-hole round ───────────────
const PUTT_DISTRIBUTION = [
  { minFeet: 2,  maxFeet: 3,  count: 1 },
  { minFeet: 3,  maxFeet: 5,  count: 2 },
  { minFeet: 5,  maxFeet: 10, count: 4 },
  { minFeet: 10, maxFeet: 15, count: 4 },
  { minFeet: 15, maxFeet: 25, count: 4 },
  { minFeet: 25, maxFeet: 40, count: 2 },
  { minFeet: 40, maxFeet: 60, count: 1 },
];

const DIST_DISPLAY = [
  { label: '< 3 ft',   count: 1 },
  { label: '3–5 ft',   count: 2 },
  { label: '5–10 ft',  count: 4 },
  { label: '10–15 ft', count: 4 },
  { label: '15–25 ft', count: 4 },
  { label: '25–40 ft', count: 2 },
  { label: '40+ ft',   count: 1 },
];

const DISTANCE_BUCKETS: DistanceBucket[] = [
  { name: 'Short (< 5 ft)',    min: 0,  max: 5,   key: 'short' },
  { name: 'Scoring (5–10 ft)', min: 5,  max: 10,  key: 'scoring' },
  { name: 'Mid (10–20 ft)',    min: 10, max: 20,  key: 'mid' },
  { name: 'Lag (20+ ft)',      min: 20, max: 100, key: 'lag' },
];

const BALL_MARKING_OPTIONS = [
  { id: 'line',     label: 'Line' },
  { id: 'multiple', label: 'Multi Lines' },
  { id: 'standard', label: 'Standard' },
  { id: 'none',     label: 'No Markings' },
];

const SLOPES = ['Uphill', 'Flat', 'Downhill'];
const BREAKS = ['Left to Right', 'Straight', 'Right to Left'];

const FIRST_PUTT_RESULTS = [
  ['Fast Left', 'Fast', 'Fast Right'],
  ['Left', 'Made', 'Right'],
  ['Slow Left', 'Slow', 'Slow Right'],
];

const SECOND_PUTT_DISTANCES = ['Tap In', '3 ft', '4 ft', '5 ft', '6 ft', '7 ft', '8 ft', '> 9 ft'];

// ── Session generator ────────────────────────────────────────────
function generateSession(): PuttSetup[] {
  const putts: PuttSetup[] = [];
  PUTT_DISTRIBUTION.forEach(({ minFeet, maxFeet, count }) => {
    for (let i = 0; i < count; i++) {
      const distance = Math.floor(Math.random() * (maxFeet - minFeet + 1)) + minFeet;
      putts.push({
        distance,
        slope: SLOPES[Math.floor(Math.random() * SLOPES.length)],
        break: BREAKS[Math.floor(Math.random() * BREAKS.length)],
      });
    }
  });
  // Fisher-Yates shuffle
  for (let i = putts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [putts[i], putts[j]] = [putts[j], putts[i]];
  }
  return putts;
}

// ── Ball marking SVG icons ───────────────────────────────────────
function BallMarkingIcon({ type, size = 32 }: { type: string; size?: number }) {
  const stroke = 'currentColor';
  const sw = '1.5';
  if (type === 'line') return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={stroke} strokeWidth={sw}>
      <circle cx="16" cy="16" r="12"/>
      <line x1="16" y1="4" x2="16" y2="28"/>
    </svg>
  );
  if (type === 'multiple') return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={stroke} strokeWidth={sw}>
      <circle cx="16" cy="16" r="12"/>
      <line x1="16" y1="4" x2="16" y2="28"/>
      <line x1="10" y1="6" x2="10" y2="26"/>
      <line x1="22" y1="6" x2="22" y2="26"/>
    </svg>
  );
  if (type === 'standard') return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={stroke} strokeWidth={sw}>
      <circle cx="16" cy="16" r="12"/>
      <line x1="16" y1="4" x2="16" y2="10"/>
      <line x1="16" y1="22" x2="16" y2="28"/>
      <line x1="4" y1="16" x2="10" y2="16"/>
      <line x1="22" y1="16" x2="28" y2="16"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={stroke} strokeWidth={sw}>
      <circle cx="16" cy="16" r="12"/>
    </svg>
  );
}

// ── SG Trend Chart (SVG sparkline) ───────────────────────────────
function SGTrendChart({ sessions, height = 100 }: { sessions: SavedSession[]; height?: number }) {
  const data = [...sessions].reverse().slice(-10); // oldest first, max 10
  if (data.length < 2) return null;

  const sgValues = data.map((s) => s.stats?.strokesGained ?? 0);
  const minSG = Math.min(...sgValues, -1);
  const maxSG = Math.max(...sgValues, 1);
  const range = maxSG - minSG || 1;

  const W = 300;
  const H = height;
  const PAD = { top: 14, right: 14, bottom: 20, left: 30 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xScale = (i: number): number => PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number): number => PAD.top + ((maxSG - v) / range) * innerH;
  const zeroY = yScale(0);

  const points = sgValues.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');

  // Y-axis labels
  const yTicks = [maxSG, 0, minSG].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height, display: 'block' }}
      aria-hidden="true"
    >
      {/* Y-axis labels */}
      {yTicks.map((v) => (
        <text
          key={v}
          x={PAD.left - 4}
          y={yScale(v) + 4}
          textAnchor="end"
          fontSize="8"
          fill="var(--color-muted)"
          fontFamily="var(--font-mono)"
        >
          {v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}
        </text>
      ))}

      {/* Zero reference line */}
      <line
        x1={PAD.left} y1={zeroY}
        x2={W - PAD.right} y2={zeroY}
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4 3"
      />

      {/* Connecting line */}
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {sgValues.map((v, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(v)}
          r="3.5"
          fill={v >= 0 ? 'var(--under)' : 'var(--bogey)'}
        />
      ))}

      {/* X-axis session labels */}
      {data.map((s, i) => (
        <text
          key={i}
          x={xScale(i)}
          y={H - 2}
          textAnchor="middle"
          fontSize="8"
          fill="var(--color-muted)"
          fontFamily="var(--font-mono)"
        >
          {i + 1}
        </text>
      ))}
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────
export default function RoundSimulation() {
  const [screen, setScreen] = useState<string>('welcome');
  const [session, setSession] = useState<PuttSetup[]>([]);
  const [currentHole, setCurrentHole] = useState<number>(0);
  const [results, setResults] = useState<PuttResult[]>([]);
  const [currentResult, setCurrentResult] = useState<CurrentResult>({
    speedCorrect: true,
    lineCorrect: true,
    firstPuttResult: null,
    secondPuttDistance: null,
    secondPuttMade: null,
  });
  const [pastSessions, setPastSessions] = useState<SavedSession[]>([]);
  const [summaryTab, setSummaryTab] = useState<string>('overview');
  const [sessionSetup, setSessionSetup] = useState<SessionSetup>({ putter: '', ballMarking: 'none' });
  const [savedPutters, setSavedPutters] = useState<string[]>([]);

  // Load persisted data
  useEffect(() => {
    try {
      const sessions = localStorage.getItem(LS_PUTTING_SESSIONS);
      if (sessions) setPastSessions(JSON.parse(sessions));
      const putters = localStorage.getItem(LS_PUTTING_PUTTERS);
      if (putters) setSavedPutters(JSON.parse(putters));
    } catch (_) {}
  }, []);

  function savePutter(name: string): void {
    if (name && !savedPutters.includes(name)) {
      const updated = [...savedPutters, name].slice(0, 10);
      setSavedPutters(updated);
      try { localStorage.setItem(LS_PUTTING_PUTTERS, JSON.stringify(updated)); } catch (_) {}
    }
  }

  function saveSession(sessionStats: SessionStats): void {
    const newSession = {
      id: Date.now(),
      date: new Date().toISOString(),
      putter: sessionSetup.putter,
      ballMarking: sessionSetup.ballMarking,
      stats: sessionStats,
    };
    const updated = [newSession, ...pastSessions].slice(0, 50);
    setPastSessions(updated);
    try { localStorage.setItem(LS_PUTTING_SESSIONS, JSON.stringify(updated)); } catch (_) {}
  }

  function startSession() {
    savePutter(sessionSetup.putter);
    setSession(generateSession());
    setCurrentHole(0);
    setResults([]);
    setCurrentResult({ speedCorrect: true, lineCorrect: true, firstPuttResult: null, secondPuttDistance: null, secondPuttMade: null });
    setSummaryTab('overview');
    setScreen('putt-setup');
  }

  function goBack() {
    if (screen === 'setup') {
      setScreen('welcome');
    } else if (screen === 'second-putt') {
      setCurrentResult((prev) => ({ ...prev, firstPuttResult: null, secondPuttDistance: null }));
      setScreen('putt-setup');
    } else if (screen === 'putt-setup' && currentHole > 0) {
      const prev = results[results.length - 1];
      setResults((r) => r.slice(0, -1));
      setCurrentHole((h) => h - 1);
      setCurrentResult({
        speedCorrect: prev?.speedCorrect ?? true,
        lineCorrect: prev?.lineCorrect ?? true,
        firstPuttResult: prev?.firstPuttResult ?? null,
        secondPuttDistance: prev?.secondPuttDistance ?? null,
        secondPuttMade: prev?.secondPuttMade ?? null,
      });
      if (prev?.firstPuttResult && prev.firstPuttResult !== 'Made') {
        setScreen('second-putt');
      }
    } else if (screen === 'putt-setup' && currentHole === 0) {
      setScreen('setup');
    }
  }

  function handleFirstPutt(result: string): void {
    setCurrentResult((prev) => ({ ...prev, firstPuttResult: result }));
    if (result === 'Made') {
      const finalResult = { ...currentResult, firstPuttResult: result, secondPuttDistance: null, secondPuttMade: true };
      setResults((prev) => [...prev, { ...session[currentHole], ...finalResult }]);
      if (currentHole < 17) {
        setCurrentHole((h) => h + 1);
        setCurrentResult({ speedCorrect: true, lineCorrect: true, firstPuttResult: null, secondPuttDistance: null, secondPuttMade: null });
      } else {
        setScreen('summary');
      }
    } else {
      setScreen('second-putt');
    }
  }

  function handleSecondPutt(made: boolean): void {
    const finalResult = { ...currentResult, secondPuttMade: made };
    const newResults = [...results, { ...session[currentHole], ...finalResult }];
    setResults(newResults);
    if (currentHole < 17) {
      setCurrentHole((h) => h + 1);
      setCurrentResult({ speedCorrect: true, lineCorrect: true, firstPuttResult: null, secondPuttDistance: null, secondPuttMade: null });
      setScreen('putt-setup');
    } else {
      setScreen('summary');
    }
  }

  // ── Stats calculation ──────────────────────────────────────────
  const stats = useMemo(() => {
    if (results.length === 0) return null;

    const onePutts = results.filter((r) => r.firstPuttResult === 'Made').length;
    const twoPutts = results.filter((r) => r.firstPuttResult !== 'Made' && r.secondPuttMade).length;
    const threePutts = results.filter((r) => r.firstPuttResult !== 'Made' && !r.secondPuttMade).length;
    const totalPutts = onePutts + twoPutts * 2 + threePutts * 3;

    const speedCorrect = results.filter((r) => r.speedCorrect).length;
    const lineCorrect = results.filter((r) => r.lineCorrect).length;

    let totalExpected = 0;
    let totalActual = 0;
    const bucketSG: Record<string, { e: number; a: number }> = { short: { e: 0, a: 0 }, scoring: { e: 0, a: 0 }, mid: { e: 0, a: 0 }, lag: { e: 0, a: 0 } };

    results.forEach((r) => {
      const expected = getExpectedPutts(r.distance);
      const actual = r.firstPuttResult === 'Made' ? 1 : r.secondPuttMade ? 2 : 3;
      totalExpected += expected;
      totalActual += actual;
      const bucket = DISTANCE_BUCKETS.find((b) => r.distance >= b.min && r.distance < b.max);
      if (bucket) {
        bucketSG[bucket.key].e += expected;
        bucketSG[bucket.key].a += actual;
      }
    });

    const strokesGained = totalExpected - totalActual;

    const bucketStrokesGained: Record<string, { sg: number; count: number }> = {};
    DISTANCE_BUCKETS.forEach(({ key, min, max }: DistanceBucket) => {
      const count = results.filter((r: PuttResult) => r.distance >= min && r.distance < max).length;
      bucketStrokesGained[key] = { sg: bucketSG[key].e - bucketSG[key].a, count };
    });

    const misses = results.filter((r) => r.firstPuttResult !== 'Made');
    const speedMisses = { fast: 0, slow: 0 };
    const dirMisses = { left: 0, right: 0 };

    misses.forEach((m: PuttResult) => {
      const r = (m.firstPuttResult ?? '').toLowerCase();
      if (r.includes('fast')) speedMisses.fast++;
      if (r.includes('slow')) speedMisses.slow++;
      if (r.includes('left')) dirMisses.left++;
      if (r.includes('right')) dirMisses.right++;
    });

    const totalSpeedMisses = speedMisses.fast + speedMisses.slow;
    const totalDirMisses = dirMisses.left + dirMisses.right;
    const speedBalance = totalSpeedMisses > 0 ? (speedMisses.fast / totalSpeedMisses) * 100 : 50;
    const dirBalance = totalDirMisses > 0 ? (dirMisses.left / totalDirMisses) * 100 : 50;
    const scoringSG = bucketStrokesGained.scoring?.sg ?? 0;

    return {
      onePutts, twoPutts, threePutts, totalPutts,
      speedCorrect, lineCorrect,
      strokesGained, bucketStrokesGained, scoringSG,
      speedBalance, dirBalance, speedMisses, dirMisses, missCount: misses.length,
    };
  }, [results]);

  // Auto-save when summary screen loads with a complete session
  useEffect(() => {
    if (screen === 'summary' && stats && results.length === 18) {
      saveSession(stats);
    }
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trend calculations ─────────────────────────────────────────
  const trends = useMemo(() => {
    if (pastSessions.length < 2) return null;
    const recent = pastSessions.slice(0, 5);
    const avg = (fn: (sess: SavedSession) => number): number => recent.reduce((s: number, sess: SavedSession) => s + (fn(sess) || 0), 0) / recent.length;
    return {
      avgSG: avg((s) => s.stats?.strokesGained),
      avgSpeed: avg((s) => s.stats?.speedBalance ?? 50),
      avgDir: avg((s) => s.stats?.dirBalance ?? s.stats?.directionBalance ?? 50),
      avgScoringSG: avg((s) => s.stats?.scoringSG ?? s.stats?.bucketStrokesGained?.scoring?.sg ?? 0),
      count: pastSessions.length,
    };
  }, [pastSessions]);

  function getTrend(current: number, average: number, type: string): TrendResult {
    if (type === 'balance') {
      const diff = Math.abs(average - 50) - Math.abs(current - 50);
      if (Math.abs(diff) < 3) return { symbol: '—', cls: '' };
      return diff > 0 ? { symbol: '↑', cls: 'rs-sg-positive' } : { symbol: '↓', cls: 'rs-sg-negative' };
    }
    const diff = current - average;
    if (Math.abs(diff) < 0.1) return { symbol: '—', cls: '' };
    return diff > 0 ? { symbol: '↑', cls: 'rs-sg-positive' } : { symbol: '↓', cls: 'rs-sg-negative' };
  }

  function getBallMarkingLabel(id: string): string {
    return BALL_MARKING_OPTIONS.find((o) => o.id === id)?.label ?? 'None';
  }

  const currentPutt = session[currentHole];

  // ── Shared sub-components ──────────────────────────────────────
  function BackButton() {
    return (
      <button className="rs-back-btn" onClick={goBack}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </button>
    );
  }

  function BalanceIndicator({ value, leftLabel, rightLabel }: { value: number; leftLabel: string; rightLabel: string }) {
    const deviation = Math.abs(value - 50);
    const isGood = deviation <= 15;
    const isFair = deviation <= 30;
    const markerColor = isGood ? 'var(--under)' : isFair ? 'var(--bogey)' : 'var(--sg-weak)';
    const statusCls = isGood ? 'rs-sg-positive' : 'rs-sg-negative';
    const statusText = isGood
      ? 'Balanced'
      : value < 50
      ? `${leftLabel} tendency`
      : `${rightLabel} tendency`;

    return (
      <div>
        <div className="rs-balance-track">
          <div className="rs-balance-ideal" />
          <div
            className="rs-balance-marker"
            style={{ left: `${value}%`, background: markerColor }}
          />
        </div>
        <div className="rs-balance-labels">
          <span>{leftLabel}</span>
          <span>50%</span>
          <span>{rightLabel}</span>
        </div>
        <div className={`rs-balance-status ${statusCls}`}>{statusText}</div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // SCREENS
  // ─────────────────────────────────────────────────────────────────

  if (screen === 'welcome') {
    return (
      <div className="rs-wrapper">
        <div className="rs-welcome">

          {/* Trend chart — shown after 2+ sessions */}
          {pastSessions.length >= 2 && (
            <div className="rs-trend-card">
              <div className="rs-trend-card-title">
                SG Trend — Last {Math.min(pastSessions.length, 10)} Sessions
              </div>
              <div className="rs-chart-wrapper">
                <SGTrendChart sessions={pastSessions} height={110} />
              </div>
              <div className="rs-trend-row">
                <span className="rs-trend-label">Avg Strokes Gained</span>
                <span className={(trends?.avgSG ?? 0) >= 0 ? 'rs-sg-positive' : 'rs-sg-negative'}>
                  {(trends?.avgSG ?? 0) >= 0 ? '+' : ''}{(trends?.avgSG ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="rs-trend-row">
                <span className="rs-trend-label">Avg SG (5–10 ft)</span>
                <span className={(trends?.avgScoringSG ?? 0) >= 0 ? 'rs-sg-positive' : 'rs-sg-negative'}>
                  {(trends?.avgScoringSG ?? 0) >= 0 ? '+' : ''}{(trends?.avgScoringSG ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="rs-trend-row">
                <span className="rs-trend-label">Speed Balance</span>
                <span style={{ color: Math.abs((trends?.avgSpeed ?? 50) - 50) <= 15 ? 'var(--under)' : 'var(--bogey)' }}>
                  {(trends?.avgSpeed ?? 50).toFixed(0)}% fast
                </span>
              </div>
              <div className="rs-trend-row">
                <span className="rs-trend-label">Direction Balance</span>
                <span style={{ color: Math.abs((trends?.avgDir ?? 50) - 50) <= 15 ? 'var(--under)' : 'var(--bogey)' }}>
                  {(trends?.avgDir ?? 50).toFixed(0)}% left
                </span>
              </div>
            </div>
          )}

          {/* Distribution info */}
          <div className="rs-card" style={{ textAlign: 'left' }}>
            <div className="rs-card-title">Round Distribution</div>
            <div className="rs-dist-table">
              {DIST_DISPLAY.map(({ label, count }) => (
                <span key={label} className="rs-dist-chip">
                  <strong>{count}×</strong> {label}
                </span>
              ))}
            </div>
          </div>

          <button className="rs-primary-btn" onClick={() => setScreen('setup')}>
            Begin Session
          </button>

          {pastSessions.length > 0 && (
            <button className="rs-secondary-btn" onClick={() => setScreen('history')}>
              Session History ({pastSessions.length})
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'setup') {
    return (
      <div className="rs-wrapper">
        <div className="rs-top-nav">
          <BackButton />
          <span className="rs-hole-label">Session Setup</span>
        </div>

        <div className="rs-card">
          <div className="rs-card-title">Putter</div>
          <input
            type="text"
            className="rs-text-input"
            placeholder="Enter putter name…"
            value={sessionSetup.putter}
            onChange={(e) => setSessionSetup((p) => ({ ...p, putter: e.target.value }))}
          />
          {savedPutters.length > 0 && (
            <div className="rs-putter-chips">
              {savedPutters.map((p) => (
                <button
                  key={p}
                  className={`rs-putter-chip${sessionSetup.putter === p ? ' is-selected' : ''}`}
                  onClick={() => setSessionSetup((prev) => ({ ...prev, putter: p }))}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rs-card">
          <div className="rs-card-title">Ball Alignment</div>
          <p className="rs-setup-desc">What alignment markings are you using?</p>
          <div className="rs-marking-grid">
            {BALL_MARKING_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className={`rs-marking-btn${sessionSetup.ballMarking === opt.id ? ' is-selected' : ''}`}
                onClick={() => setSessionSetup((p) => ({ ...p, ballMarking: opt.id }))}
              >
                <BallMarkingIcon type={opt.id} size={32} />
                <span className="rs-marking-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          className="rs-primary-btn"
          onClick={startSession}
          disabled={!sessionSetup.putter.trim()}
        >
          Start Putting
        </button>
        {!sessionSetup.putter.trim() && (
          <p className="rs-hint">Enter a putter name to continue</p>
        )}
      </div>
    );
  }

  if (screen === 'history') {
    return (
      <div className="rs-wrapper">
        <div className="rs-top-nav">
          <button className="rs-back-btn" onClick={() => setScreen('welcome')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <span className="rs-hole-label">Session History</span>
        </div>

        {pastSessions.length >= 2 && (
          <div className="rs-card">
            <div className="rs-card-title">SG Trend</div>
            <div className="rs-chart-wrapper">
              <SGTrendChart sessions={pastSessions} height={130} />
            </div>
          </div>
        )}

        <div className="rs-history-list">
          {pastSessions.map((s) => (
            <div key={s.id} className="rs-history-card">
              <div className="rs-history-header">
                <span className="rs-history-date">
                  {new Date(s.date).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
                <span className={`rs-history-sg ${(s.stats?.strokesGained ?? 0) >= 0 ? 'rs-sg-positive' : 'rs-sg-negative'}`}>
                  {(s.stats?.strokesGained ?? 0) >= 0 ? '+' : ''}{(s.stats?.strokesGained ?? 0).toFixed(2)} SG
                </span>
              </div>
              <div className="rs-history-meta">
                <span className="rs-history-putter">{s.putter}</span>
                <span className="rs-history-badge">{getBallMarkingLabel(s.ballMarking)}</span>
              </div>
              <div className="rs-history-stats">
                {[
                  { v: s.stats?.totalPutts,    l: 'Putts' },
                  { v: s.stats?.onePutts,      l: '1-Putts' },
                  { v: s.stats?.threePutts,    l: '3-Putts' },
                  { v: `${Math.round(s.stats?.speedBalance ?? 50)}%`, l: 'Speed' },
                  { v: `${Math.round(s.stats?.dirBalance ?? s.stats?.directionBalance ?? 50)}%`, l: 'Dir' },
                ].map(({ v, l }) => (
                  <div key={l} className="rs-history-stat">
                    <span className="rs-history-stat-value">{v ?? '—'}</span>
                    <span className="rs-history-stat-label">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (screen === 'putt-setup') {
    const slopeIcon = currentPutt?.slope === 'Uphill' ? '↑' : currentPutt?.slope === 'Downhill' ? '↓' : '—';
    const breakIcon = currentPutt?.break === 'Left to Right' ? '↷' : currentPutt?.break === 'Right to Left' ? '↶' : '↑';

    return (
      <div className="rs-wrapper">
        <div className="rs-top-nav">
          <BackButton />
          <span className="rs-hole-label">Hole {currentHole + 1} / 18</span>
        </div>
        <div className="rs-progress-track">
          <div className="rs-progress-fill" style={{ width: `${(currentHole / 18) * 100}%` }} />
        </div>

        {/* Distance card */}
        <div className="rs-card">
          <div className="rs-distance-block">
            <span className="rs-distance-value">{currentPutt?.distance}</span>
            <span className="rs-distance-unit">feet</span>
          </div>
          <div className="rs-expected-putts">
            Expected: {getExpectedPutts(currentPutt?.distance).toFixed(2)} putts
          </div>
          <div className="rs-conditions">
            <div className="rs-condition">
              <span className="rs-condition-icon">{slopeIcon}</span>
              <span className="rs-condition-text">{currentPutt?.slope}</span>
            </div>
            <div className="rs-condition-divider" />
            <div className="rs-condition">
              <span className="rs-condition-icon">{breakIcon}</span>
              <span className="rs-condition-text">{currentPutt?.break}</span>
            </div>
          </div>
        </div>

        {/* Read assessment */}
        <div className="rs-card">
          <div className="rs-card-title">Read Assessment</div>
          <div className="rs-toggle-section">
            {([
              { key: 'speedCorrect' as const, label: 'Speed Read' },
              { key: 'lineCorrect' as const,  label: 'Line Read' },
            ] as const).map(({ key, label }) => (
              <div key={key} className="rs-toggle-row">
                <span className="rs-toggle-label">{label}</span>
                <div className="rs-toggle-group">
                  <button
                    className={`rs-toggle-btn${currentResult[key] === true ? ' is-correct' : ''}`}
                    onClick={() => setCurrentResult((p: CurrentResult) => ({ ...p, [key]: true }))}
                  >
                    Correct
                  </button>
                  <button
                    className={`rs-toggle-btn${currentResult[key] === false ? ' is-incorrect' : ''}`}
                    onClick={() => setCurrentResult((p: CurrentResult) => ({ ...p, [key]: false }))}
                  >
                    Incorrect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* First putt result grid */}
        <div className="rs-card">
          <div className="rs-card-title">First Putt Result</div>
          <div className="rs-result-grid">
            {FIRST_PUTT_RESULTS.map((row, ri) => (
              <div key={ri} className="rs-result-row">
                {row.map((result) => (
                  <button
                    key={result}
                    className={`rs-result-btn${result === 'Made' ? ' is-made' : ''}`}
                    onClick={() => handleFirstPutt(result)}
                  >
                    {result}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'second-putt') {
    return (
      <div className="rs-wrapper">
        <div className="rs-top-nav">
          <BackButton />
          <span className="rs-hole-label">Hole {currentHole + 1} / 18</span>
        </div>

        <div className="rs-miss-notice">
          <span className="rs-miss-notice-label">First putt:</span>
          <span className="rs-miss-notice-value">{currentResult.firstPuttResult}</span>
        </div>

        <div className="rs-card">
          <div className="rs-card-title">Second Putt Distance</div>
          <div className="rs-distance-grid">
            {SECOND_PUTT_DISTANCES.map((dist) => (
              <button
                key={dist}
                className={`rs-dist-btn${currentResult.secondPuttDistance === dist ? ' is-selected' : ''}`}
                onClick={() => setCurrentResult((p) => ({ ...p, secondPuttDistance: dist }))}
              >
                {dist}
              </button>
            ))}
          </div>
        </div>

        <div className="rs-card">
          <div className="rs-card-title">Second Putt Result</div>
          <div className="rs-make-row">
            <button
              className="rs-make-btn is-made"
              onClick={() => handleSecondPutt(true)}
              disabled={!currentResult.secondPuttDistance}
            >
              Made
            </button>
            <button
              className="rs-make-btn is-missed"
              onClick={() => handleSecondPutt(false)}
              disabled={!currentResult.secondPuttDistance}
            >
              Missed
            </button>
          </div>
          {!currentResult.secondPuttDistance && (
            <p className="rs-hint">Select distance above</p>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'summary') {
    const scoringSG = stats?.bucketStrokesGained?.scoring?.sg ?? 0;
    const sgPos = (stats?.strokesGained ?? 0) >= 0;

    return (
      <div className="rs-wrapper">
        <div className="rs-summary-header">
          <div className="rs-summary-date">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </div>
          <div className="rs-summary-meta">
            <span className="rs-summary-putter">{sessionSetup.putter}</span>
            <span className="rs-summary-badge">{getBallMarkingLabel(sessionSetup.ballMarking)}</span>
          </div>
        </div>

        <div className="rs-tab-nav">
          {['overview', 'tendencies'].map((tab) => (
            <button
              key={tab}
              className={`rs-tab-btn${summaryTab === tab ? ' is-active' : ''}`}
              onClick={() => setSummaryTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {summaryTab === 'overview' && (
          <>
            {/* SG hero */}
            <div className={`rs-sg-hero ${sgPos ? 'is-positive' : 'is-negative'}`}>
              <span className="rs-sg-hero-label">Strokes Gained vs PGA Tour</span>
              <span className={`rs-sg-hero-value ${sgPos ? 'rs-sg-positive' : 'rs-sg-negative'}`}>
                {sgPos ? '+' : ''}{stats?.strokesGained.toFixed(2)}
              </span>
              <span className="rs-sg-hero-sub">
                {sgPos ? 'Better than tour average' : 'Below tour average'}
              </span>
            </div>

            {/* Putt counts */}
            <div className="rs-stat-row">
              {[
                { v: stats?.totalPutts, l: 'Total', cls: '' },
                { v: stats?.onePutts,   l: '1-Putts', cls: 'rs-sg-positive' },
                { v: stats?.twoPutts,   l: '2-Putts', cls: '' },
                { v: stats?.threePutts, l: '3-Putts', cls: (stats?.threePutts ?? 0) > 0 ? 'rs-sg-negative' : '' },
              ].map(({ v, l, cls }) => (
                <div key={l} className="rs-stat-cell">
                  <span className={`rs-stat-value ${cls}`}>{v}</span>
                  <span className="rs-stat-label">{l}</span>
                </div>
              ))}
            </div>

            {/* SG by distance */}
            <div className="rs-card">
              <div className="rs-card-title">Strokes Gained by Distance</div>
              <div className="rs-bucket-list">
                {DISTANCE_BUCKETS.map((bucket) => {
                  const data = stats?.bucketStrokesGained[bucket.key];
                  if (!data || data.count === 0) return null;
                  return (
                    <div key={bucket.key} className="rs-bucket-row">
                      <div>
                        <div className="rs-bucket-name">{bucket.name}</div>
                        <div className="rs-bucket-count">{data.count} putts</div>
                      </div>
                      <span className={`rs-bucket-sg ${data.sg >= 0 ? 'rs-sg-positive' : 'rs-sg-negative'}`}>
                        {data.sg >= 0 ? '+' : ''}{data.sg.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Read accuracy */}
            <div className="rs-card">
              <div className="rs-card-title">Read Accuracy</div>
              <div className="rs-accuracy-grid">
                {[
                  { pct: ((stats?.speedCorrect ?? 0) / 18) * 100, label: 'Speed' },
                  { pct: ((stats?.lineCorrect ?? 0)  / 18) * 100, label: 'Line' },
                ].map(({ pct, label }) => (
                  <div key={label} className="rs-accuracy-item">
                    <div className="rs-accuracy-label">{label}</div>
                    <div className="rs-accuracy-pct">{Math.round(pct)}%</div>
                    <div className="rs-accuracy-bar">
                      <div className="rs-accuracy-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {summaryTab === 'tendencies' && (
          <>
            {stats != null && stats.missCount > 0 ? (
              <>
                <div className="rs-card">
                  <div className="rs-card-title">Speed Control</div>
                  <BalanceIndicator value={stats.speedBalance} leftLabel="Short" rightLabel="Long" />
                  <div className="rs-tendency-stats">
                    <div className="rs-tendency-stat">
                      <span className="rs-tendency-count">{stats.speedMisses.slow}</span>
                      <span className="rs-tendency-label">Short</span>
                    </div>
                    <div className="rs-tendency-stat">
                      <span className="rs-tendency-count">{stats.speedMisses.fast}</span>
                      <span className="rs-tendency-label">Long</span>
                    </div>
                  </div>
                  <p className="rs-tendency-tip">
                    Ideal: 50% short, 50% long — indicates consistent pace.
                  </p>
                </div>

                <div className="rs-card">
                  <div className="rs-card-title">Direction Control</div>
                  <BalanceIndicator value={stats.dirBalance} leftLabel="Left" rightLabel="Right" />
                  <div className="rs-tendency-stats">
                    <div className="rs-tendency-stat">
                      <span className="rs-tendency-count">{stats.dirMisses.left}</span>
                      <span className="rs-tendency-label">Left</span>
                    </div>
                    <div className="rs-tendency-stat">
                      <span className="rs-tendency-count">{stats.dirMisses.right}</span>
                      <span className="rs-tendency-label">Right</span>
                    </div>
                  </div>
                  <p className="rs-tendency-tip">
                    Ideal: 50% left, 50% right — accurate reads and consistent aim.
                  </p>
                </div>

                {trends && (
                  <div className="rs-card">
                    <div className="rs-card-title">vs. Your Average</div>
                    <div className="rs-compare-table">
                      <div className="rs-compare-header">
                        <span>Metric</span><span>Today</span><span>Avg</span><span>Trend</span>
                      </div>

                      {[
                        {
                          label: 'Speed Balance',
                          today: `${stats.speedBalance.toFixed(0)}%`,
                          avg: `${trends.avgSpeed.toFixed(0)}%`,
                          trend: getTrend(stats.speedBalance, trends.avgSpeed, 'balance'),
                        },
                        {
                          label: 'Dir Balance',
                          today: `${stats.dirBalance.toFixed(0)}%`,
                          avg: `${trends.avgDir.toFixed(0)}%`,
                          trend: getTrend(stats.dirBalance, trends.avgDir, 'balance'),
                        },
                        {
                          label: 'Total SG',
                          today: `${sgPos ? '+' : ''}${stats.strokesGained.toFixed(2)}`,
                          avg: `${trends.avgSG >= 0 ? '+' : ''}${trends.avgSG.toFixed(2)}`,
                          trend: getTrend(stats.strokesGained, trends.avgSG, 'sg'),
                          todayCls: sgPos ? 'rs-sg-positive' : 'rs-sg-negative',
                          avgCls: trends.avgSG >= 0 ? 'rs-sg-positive' : 'rs-sg-negative',
                        },
                        {
                          label: 'SG 5–10 ft',
                          today: `${scoringSG >= 0 ? '+' : ''}${scoringSG.toFixed(2)}`,
                          avg: `${trends.avgScoringSG >= 0 ? '+' : ''}${trends.avgScoringSG.toFixed(2)}`,
                          trend: getTrend(scoringSG, trends.avgScoringSG, 'sg'),
                          todayCls: scoringSG >= 0 ? 'rs-sg-positive' : 'rs-sg-negative',
                          avgCls: trends.avgScoringSG >= 0 ? 'rs-sg-positive' : 'rs-sg-negative',
                        },
                      ].map(({ label, today, avg, trend, todayCls = '', avgCls = '' }) => (
                        <div key={label} className="rs-compare-row">
                          <span className="rs-metric-name">{label}</span>
                          <span className={todayCls}>{today}</span>
                          <span className={avgCls} style={{ color: avgCls ? undefined : 'var(--color-muted)' }}>{avg}</span>
                          <span className={`rs-trend-indicator ${trend.cls}`}>
                            {trend.symbol} {trend.symbol !== '—' ? (trend.cls === 'rs-sg-positive' ? 'Up' : 'Down') : 'Stable'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="rs-trend-note">
                      The 5–10 ft scoring range is where great putters separate themselves.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="rs-card" style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-body)', fontSize: '14px' }}>
                  No misses to analyze — perfect putting session.
                </p>
              </div>
            )}
          </>
        )}

        <button className="rs-primary-btn" onClick={() => setScreen('setup')}>
          New Session
        </button>
      </div>
    );
  }

  return null;
}
