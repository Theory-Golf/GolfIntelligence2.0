'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LS_INSIDE_TEN_SESSIONS } from '@/lib/constants';
import { useDrillHistory } from '@/lib/golf/useDrillHistory';
import './InsideTen.css';

// ── Types ─────────────────────────────────────────────────────────
type TierName = 'elite' | 'tour' | 'competitive' | 'developing';
type Screen = 'home' | 'play' | 'result';

interface InsideTenSession {
  id: string;
  date: string;
  timestamp: number;
  score: number;
  sg: number;
  tier: TierName;
}

interface ResultState {
  session: InsideTenSession;
  prevBest: number | null;
  prevAvg5: number | null;
  prevLast: number | null;
}

// ── Scoring constants ──────────────────────────────────────────────
const SG_TABLE: Record<number, number> = {
  18: 6.28, 17: 5.25, 16: 4.22, 15: 3.19, 14: 2.16, 13: 1.13,
  12: 0.10, 11: -0.93, 10: -1.96, 9: -2.99, 8: -4.02, 7: -5.05,
  6: -6.08, 5: -7.11, 4: -8.14, 3: -9.17, 2: -10.20, 1: -11.23, 0: -12.26,
};

const TIER_CONFIG: Record<TierName, { label: string; copy: string; color: string }> = {
  elite:       { label: 'Elite',       copy: 'Above Tour baseline. Conversion-grade putting.',                   color: 'var(--sg-strong)' },
  tour:        { label: 'Tour',        copy: 'Tour baseline. SG-neutral inside ten.',                            color: 'var(--sg-gain)'   },
  competitive: { label: 'Competitive', copy: 'Below baseline. Tighten speed control on the 7–10 ft band.',       color: 'var(--bogey)'     },
  developing:  { label: 'Developing',  copy: 'Repeat the drill — focus on speed first, line second.',            color: 'var(--double)'    },
};

const GROUPS = [
  { group: 1, putts: [3, 4, 5] },
  { group: 2, putts: [4, 5, 6] },
  { group: 3, putts: [5, 6, 7] },
  { group: 4, putts: [6, 7, 8] },
  { group: 5, putts: [7, 8, 9] },
  { group: 6, putts: [8, 9, 10] },
];

// ── Helpers ────────────────────────────────────────────────────────
function sgForScore(score: number): number {
  return SG_TABLE[score] ?? 0;
}

function tierForScore(score: number): TierName {
  if (score >= 13) return 'elite';
  if (score >= 11) return 'tour';
  if (score >= 9)  return 'competitive';
  return 'developing';
}

function formatSG(sg: number): string {
  const abs = Math.abs(sg).toFixed(1);
  return sg >= 0 ? `+${abs}` : `-${abs}`;
}

function formatDelta(d: number): string {
  if (d > 0) return `+${d}`;
  if (d < 0) return `${d}`;
  return '—';
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Storage ────────────────────────────────────────────────────────
function buildSession(score: number, date: string): InsideTenSession {
  return {
    id: crypto.randomUUID(),
    date,
    timestamp: Date.now(),
    score,
    sg: Number(sgForScore(score).toFixed(2)),
    tier: tierForScore(score),
  };
}

// ── Main component ─────────────────────────────────────────────────
const getSessionId = (s: InsideTenSession) => s.id;
const getSessionPlayedAt = (s: InsideTenSession) => s.date;

export default function InsideTen() {
  const [screen, setScreen]                 = useState<Screen>('home');
  const [storageAvailable, setStorageAvail] = useState(true);
  const [score, setScore]                   = useState(12);
  const [sessionDate, setSessionDate]       = useState<string>(todayISO);
  const [result, setResult]                 = useState<ResultState | null>(null);

  const { sessions, record } = useDrillHistory<InsideTenSession>({
    drillType: 'inside-ten',
    lsKey: LS_INSIDE_TEN_SESSIONS,
    getId: getSessionId,
    getPlayedAt: getSessionPlayedAt,
  });

  useEffect(() => {
    try {
      localStorage.setItem('_it_probe', '1');
      localStorage.removeItem('_it_probe');
    } catch {
      setStorageAvail(false);
    }
  }, []);

  function handleStartSession() {
    setScore(12);
    setSessionDate(todayISO());
    setScreen('play');
  }

  function handleSave() {
    const prevBest = sessions.length > 0 ? Math.max(...sessions.map(s => s.score)) : null;
    const prevAvg5 = sessions.length > 0
      ? sessions.slice(0, 5).reduce((s, r) => s + r.score, 0) / Math.min(sessions.length, 5)
      : null;
    const prevLast = sessions.length > 0 ? sessions[0].score : null;

    const newSession = buildSession(score, sessionDate);
    record(newSession);
    setResult({ session: newSession, prevBest, prevAvg5, prevLast });
    setScreen('result');
  }

  if (screen === 'home')   return <HomeScreen   sessions={sessions} storageAvailable={storageAvailable} onStart={handleStartSession} />;
  if (screen === 'play')   return <PlayScreen   score={score} date={sessionDate} onScoreChange={setScore} onDateChange={setSessionDate} onSave={handleSave} onBack={() => setScreen('home')} />;
  if (screen === 'result' && result) return <ResultScreen result={result} onDone={() => setScreen('home')} onNew={handleStartSession} />;
  return null;
}

// ── Home Screen ────────────────────────────────────────────────────
function HomeScreen({ sessions, storageAvailable, onStart }: {
  sessions: InsideTenSession[];
  storageAvailable: boolean;
  onStart: () => void;
}) {
  const recent = sessions.slice(0, 3);

  return (
    <div className="it-wrapper">
      {!storageAvailable && (
        <div className="it-storage-warn">
          History won&apos;t be saved in this browser session.
        </div>
      )}

      {/* ── Hero ── */}
      <div className="it-hero">
        <p className="it-hero-subtitle">18 putts · 6 ladders · 3 to 10 feet</p>
        <button className="it-primary-btn" onClick={onStart}>
          Start Session
        </button>
      </div>

      {/* ── The Drill ── */}
      <div className="it-card">
        <p className="it-section-label">The Drill</p>
        <p className="it-body-text" style={{ marginBottom: 20 }}>
          Set up at the marked distances and work through each ladder in order.
          The drill is played on a real green — choose your own line from each
          distance. No warm-up putts: the first putt is the first putt.
        </p>
        <table className="it-ladder-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Putt 1</th>
              <th>Putt 2</th>
              <th>Putt 3</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(({ group, putts }) => (
              <tr key={group}>
                <td>{group}</td>
                <td><span>{putts[0]} ft</span></td>
                <td><span>{putts[1]} ft</span></td>
                <td><span>{putts[2]} ft</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="it-rules">
          {[
            'Each putt is hit once — misses are not retried.',
            'Track total putts made in your head across all 18.',
            'Choose any line from each marked distance — real greens break.',
          ].map((text, i) => (
            <div className="it-rule" key={i}>
              <span className="it-rule-key">0{i + 1}</span>
              <span className="it-rule-text">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── How It's Scored ── */}
      <div className="it-card">
        <p className="it-section-label">How It&apos;s Scored</p>
        <p className="it-body-text" style={{ marginBottom: 20 }}>
          Enter one number at the end — total putts made out of 18. The app
          converts that score to an estimated Strokes Gained value against PGA
          Tour baseline. Score 12 equals SG 0 (tour-neutral putting).
        </p>
        <div className="it-tier-grid">
          {(Object.entries(TIER_CONFIG) as [TierName, typeof TIER_CONFIG[TierName]][]).map(([key, cfg]) => {
            const ranges: Record<TierName, string> = {
              elite:       '13–18  ·  SG ≥ +1.0',
              tour:        '11–12  ·  SG −1.0 to +1.0',
              competitive: '9–10   ·  SG −3.0 to −1.0',
              developing:  '0–8    ·  SG ≤ −3.0',
            };
            return (
              <div className="it-tier-item" key={key} style={{ borderLeftColor: cfg.color }}>
                <div className="it-tier-label" style={{ color: cfg.color }}>{cfg.label}</div>
                <div className="it-tier-range">{ranges[key]}</div>
                <div className="it-tier-copy">{cfg.copy}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Why It Matters ── */}
      <div className="it-card">
        <p className="it-section-label">Why It Matters</p>
        <p className="it-body-text">
          The 5–8 ft range is where par saves and short birdie conversions are
          won and lost. Inside Ten weights its ladder to this band — more reps
          from the distances that decide handicap. Speed control is the
          priority: a player who controls pace can two-putt from anywhere.
          Green reading follows speed. Build speed first.
        </p>
      </div>

      {/* ── Recent Performance ── */}
      {recent.length > 0 && (
        <div className="it-card">
          <p className="it-section-label">Recent Performance</p>
          <div className="it-recent-list">
            {recent.map(s => {
              const cfg = TIER_CONFIG[s.tier];
              return (
                <div className="it-recent-row" key={s.id}>
                  <span className="it-recent-date">
                    {new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="it-recent-score">
                    {s.score}<span>/18</span>
                  </span>
                  <span className="it-recent-sg" style={{ color: cfg.color }}>
                    {formatSG(s.sg)} SG
                  </span>
                  <span className="it-recent-tier-badge" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
          <Link href="/player-path/putting/inside-ten/history" className="it-view-history-link">
            View full history →
          </Link>
        </div>
      )}

      {/* ── Bottom CTA ── */}
      <button className="it-primary-btn" onClick={onStart}>
        Start Session
      </button>
    </div>
  );
}

// ── Play Screen ────────────────────────────────────────────────────
function PlayScreen({ score, date, onScoreChange, onDateChange, onSave, onBack }: {
  score: number;
  date: string;
  onScoreChange: (n: number) => void;
  onDateChange: (d: string) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const maxDate = todayISO();

  return (
    <div className="it-wrapper">
      <div className="it-top-nav">
        <button className="it-back-btn" onClick={onBack}>← Exit</button>
        <span className="it-nav-label">Session Entry</span>
        <span style={{ minWidth: 60 }} />
      </div>

      {/* ── Score input ── */}
      <div className="it-card">
        <p className="it-card-eyebrow-center">Putts Made (out of 18)</p>
        <div className="it-score-stepper">
          <button
            className="it-stepper-btn"
            onClick={() => onScoreChange(Math.max(0, score - 1))}
            disabled={score <= 0}
            aria-label="Decrease score"
          >
            −
          </button>
          <div className="it-score-display">
            <span className="it-score-large">{score}</span>
            <span className="it-score-denom">out of 18</span>
          </div>
          <button
            className="it-stepper-btn"
            onClick={() => onScoreChange(Math.min(18, score + 1))}
            disabled={score >= 18}
            aria-label="Increase score"
          >
            +
          </button>
        </div>
      </div>

      {/* ── Date ── */}
      <div className="it-card">
        <div className="it-date-row">
          <span className="it-date-label">Session Date</span>
          <input
            type="date"
            className="it-date-input"
            value={date}
            max={maxDate}
            onChange={e => onDateChange(e.target.value)}
          />
        </div>
      </div>

      <button className="it-primary-btn" onClick={onSave}>
        Save Session
      </button>
    </div>
  );
}

// ── Result Screen ──────────────────────────────────────────────────
function ResultScreen({ result, onDone, onNew }: {
  result: ResultState;
  onDone: () => void;
  onNew: () => void;
}) {
  const { session, prevBest, prevAvg5, prevLast } = result;
  const cfg = TIER_CONFIG[session.tier];
  const isNewPB = prevBest !== null && session.score > prevBest;

  const vsPrev = prevLast !== null ? session.score - prevLast : null;
  const vsAvg5 = prevAvg5 !== null ? session.score - prevAvg5 : null;

  return (
    <div className="it-wrapper">
      <div className="it-top-nav">
        <button className="it-back-btn" onClick={onDone}>← Done</button>
        <span className="it-nav-label">Session Result</span>
        <span style={{ minWidth: 60 }} />
      </div>

      {/* ── Score hero ── */}
      <div className="it-card" style={{ padding: 0 }}>
        <div className="it-result-hero">
          <div>
            <span className="it-result-score">{session.score}</span>
            <span className="it-result-score-denom">/18</span>
          </div>
          <div className="it-result-sg">{formatSG(session.sg)} SG (est.)</div>
          <div className="it-result-sg-note">
            SG is estimated from total score — exact value depends on which distances were made
          </div>
        </div>
        <div className="it-tier-badge-wrap">
          <span className="it-tier-badge" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="it-tier-badge-copy">{cfg.copy}</span>
        </div>
      </div>

      {/* ── Deltas ── */}
      <div className="it-deltas">
        <div className="it-delta-cell">
          <div className="it-delta-label">vs Last</div>
          {vsPrev !== null ? (
            <>
              <div className={`it-delta-value ${vsPrev > 0 ? 'it-delta-pos' : vsPrev < 0 ? 'it-delta-neg' : 'it-delta-neutral'}`}>
                {formatDelta(vsPrev)}
              </div>
              <div className="it-delta-sub">prev {prevLast}/18</div>
            </>
          ) : (
            <>
              <div className="it-delta-value it-delta-neutral">—</div>
              <div className="it-delta-sub">first session</div>
            </>
          )}
        </div>
        <div className="it-delta-cell">
          <div className="it-delta-label">vs Avg 5</div>
          {vsAvg5 !== null ? (
            <>
              <div className={`it-delta-value ${vsAvg5 > 0 ? 'it-delta-pos' : vsAvg5 < 0 ? 'it-delta-neg' : 'it-delta-neutral'}`}>
                {vsAvg5 > 0 ? `+${vsAvg5.toFixed(1)}` : vsAvg5 < 0 ? vsAvg5.toFixed(1) : '—'}
              </div>
              <div className="it-delta-sub">avg {prevAvg5!.toFixed(1)}</div>
            </>
          ) : (
            <>
              <div className="it-delta-value it-delta-neutral">—</div>
              <div className="it-delta-sub">first session</div>
            </>
          )}
        </div>
        <div className="it-delta-cell">
          <div className="it-delta-label">Best</div>
          {isNewPB ? (
            <>
              <div className="it-delta-value it-delta-pb">{session.score}</div>
              <div className="it-delta-sub">new best!</div>
            </>
          ) : prevBest !== null ? (
            <>
              <div className="it-delta-value it-delta-neutral">{prevBest}</div>
              <div className="it-delta-sub">all-time best</div>
            </>
          ) : (
            <>
              <div className="it-delta-value it-delta-pb">{session.score}</div>
              <div className="it-delta-sub">new best!</div>
            </>
          )}
        </div>
      </div>

      {/* ── CTAs ── */}
      <div className="it-cta-row">
        <Link
          href="/player-path/putting/inside-ten/history"
          className="it-primary-btn"
          style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          View History
        </Link>
        <button className="it-secondary-btn" onClick={onNew}>
          New Session
        </button>
      </div>
    </div>
  );
}
