'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LS_INSIDE_TEN_SESSIONS } from '@/lib/constants';
import { useDrillHistory } from '@/lib/golf/useDrillHistory';
import LadderPlay from '@/components/putting/LadderPlay';
import { LadderGroupBreakdown, DistanceProfile } from '@/components/putting/LadderBreakdown';
import {
  GROUPS,
  TIER_CONFIG,
  TOTAL_PUTTS,
  TOUR_BASELINE_SCORE,
  buildSession,
  formatDelta,
  formatSG,
  todayISO,
  type InsideTenSession,
  type TierName,
} from './model';
import '@/components/putting/LadderPlay.css';
import './InsideTen.css';

// ── Types ─────────────────────────────────────────────────────────
type Screen = 'home' | 'play' | 'quick' | 'result';

interface ResultState {
  session: InsideTenSession;
  prevBest: number | null;
  prevAvg5: number | null;
  prevLast: number | null;
}

// ── Main component ─────────────────────────────────────────────────
const getSessionId = (s: InsideTenSession) => s.id;
const getSessionPlayedAt = (s: InsideTenSession) => s.date;

interface InsideTenProps {
  onScreenChange?: (screen: Screen) => void;
}

export default function InsideTen({ onScreenChange }: InsideTenProps = {}) {
  const [screen, setScreen]                 = useState<Screen>('home');
  const [storageAvailable, setStorageAvail] = useState(true);
  const [results, setResults]               = useState<boolean[]>([]);
  const [score, setScore]                   = useState(12);
  const [sessionDate, setSessionDate]       = useState<string>(todayISO);
  const [result, setResult]                 = useState<ResultState | null>(null);

  useEffect(() => {
    onScreenChange?.(screen);
  }, [screen, onScreenChange]);

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
    setResults([]);
    setSessionDate(todayISO());
    setScreen('play');
  }

  function handleQuickEntry() {
    setScore(12);
    setSessionDate(todayISO());
    setScreen('quick');
  }

  function saveSession(newSession: InsideTenSession) {
    const prevBest = sessions.length > 0 ? Math.max(...sessions.map(s => s.score)) : null;
    const prevAvg5 = sessions.length > 0
      ? sessions.slice(0, 5).reduce((s, r) => s + r.score, 0) / Math.min(sessions.length, 5)
      : null;
    const prevLast = sessions.length > 0 ? sessions[0].score : null;

    record(newSession);
    setResult({ session: newSession, prevBest, prevAvg5, prevLast });
    setScreen('result');
  }

  function handlePutt(made: boolean) {
    const next = [...results, made];
    setResults(next);
    if (next.length === TOTAL_PUTTS) {
      saveSession(buildSession(next.filter(Boolean).length, sessionDate, next));
    }
  }

  if (screen === 'home') {
    return (
      <HomeScreen
 sessions={sessions}
 storageAvailable={storageAvailable}
 onStart={handleStartSession}
 onQuickEntry={handleQuickEntry}
      />
    );
  }
  if (screen === 'play') {
    return (
      <LadderPlay
 navLabel="Inside Ten"
 groups={GROUPS}
 results={results}
 benchmarkScore={TOUR_BASELINE_SCORE}
 benchmarkLabel="Tour baseline"
 onPutt={handlePutt}
 onUndo={() => setResults(r => r.slice(0, -1))}
 onQuit={() => setScreen('home')}
      />
    );
  }
  if (screen === 'quick') {
    return (
      <QuickEntryScreen
 score={score}
 date={sessionDate}
 onScoreChange={setScore}
 onDateChange={setSessionDate}
 onSave={() => saveSession(buildSession(score, sessionDate))}
 onBack={() => setScreen('home')}
      />
    );
  }
  if (screen === 'result' && result) {
    return <ResultScreen result={result} onDone={() => setScreen('home')} onNew={handleStartSession} />;
  }
  return null;
}

// ── Home Screen ────────────────────────────────────────────────────
function HomeScreen({ sessions, storageAvailable, onStart, onQuickEntry }: {
  sessions: InsideTenSession[];
  storageAvailable: boolean;
  onStart: () => void;
  onQuickEntry: () => void;
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
        <button className="lp-text-btn" onClick={onQuickEntry}>
          Already finished? Log a total score →
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
            'Log every putt made or missed as you go — the app tracks the total.',
            'Choose any line from each marked distance — real greens break.',
          ].map((text, i) => (
            <div className="it-rule" key={i}>
              <span className="it-rule-key">0{i + 1}</span>
              <span className="it-rule-text">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── How It's Logged ── */}
      <div className="it-card">
        <p className="it-section-label">How It&apos;s Logged</p>
        <p className="it-body-text" style={{ marginBottom: 20 }}>
          Tap made or missed after every putt. The app holds the running total,
          recaps each ladder as you finish it, and records which distance every
          make and miss came from — so the score is never a memory exercise and
          the misses have an address. If you already played the drill away from
          your phone, log the total score instead.
        </p>
        <div className="lp-mode-row">
          <button className="lp-mode-btn" onClick={onStart}>
            <span className="lp-mode-btn-title">Log Every Putt</span>
            <span className="lp-mode-btn-sub">Distance-level detail · recommended</span>
          </button>
          <button className="lp-mode-btn" onClick={onQuickEntry}>
            <span className="lp-mode-btn-title">Total Only</span>
            <span className="lp-mode-btn-sub">One number · score and SG only</span>
          </button>
        </div>
      </div>

      {/* ── How It's Scored ── */}
      <div className="it-card">
        <p className="it-section-label">How It&apos;s Scored</p>
        <p className="it-body-text" style={{ marginBottom: 20 }}>
          Your score is total putts made out of 18. The app converts that score
          to an estimated Strokes Gained value against PGA Tour baseline. Score
          12 equals SG 0 (tour-neutral putting).
        </p>
        <div className="it-tier-grid">
          {(Object.entries(TIER_CONFIG) as [TierName, typeof TIER_CONFIG[TierName]][]).map(([key, cfg]) => (
            <div className="it-tier-item" key={key} style={{ borderLeftColor: cfg.color }}>
              <div className="it-tier-label" style={{ color: cfg.color }}>{cfg.label}</div>
              <div className="it-tier-range">{cfg.range}</div>
              <div className="it-tier-copy">{cfg.copy}</div>
            </div>
          ))}
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

// ── Quick Entry Screen ─────────────────────────────────────────────
function QuickEntryScreen({ score, date, onScoreChange, onDateChange, onSave, onBack }: {
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
        <span className="it-nav-label">Total Score Entry</span>
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
        <p className="lp-note text-center" >
          A total-only session has no distance detail. Log putt by putt to see
          which distances the misses came from.
        </p>
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

      {/* ── Putt-level breakdowns (putt-by-putt sessions only) ── */}
      <LadderGroupBreakdown putts={session.putts} />
      <DistanceProfile
 putts={session.putts}
 title="This Session By Distance"
 note="Inside Ten repeats the middle distances more often than the ends — 5 through 8 ft carry three putts each."
      />

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
