'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LS_INSIDE_TWENTY_SESSIONS } from '@/lib/constants';
import { isAvailable } from '@/lib/playerpath/storage';
import { playedAtMs, playedOnISO, syncDrillHistory } from '@/lib/playerpath/history';
import { drillSessionInput, recordDrillSession } from '@/lib/playerpath/record';
import '../InsideTen/InsideTen.css';
import './InsideTwenty.css';
import { fmtDateShort } from '@/lib/playerpath/format';

// ── Types ─────────────────────────────────────────────────────────
export type TierName = 'elite' | 'tour' | 'competitive' | 'developing';
type Screen = 'home' | 'play' | 'result';

export interface InsideTwentySession {
  id: string;
  date: string;
  timestamp: number;
  score: number;
  tier: TierName;
}

interface ResultState {
  session: InsideTwentySession;
  prevBest: number | null;
  prevAvg5: number | null;
  prevLast: number | null;
}

// ── Drill constants ────────────────────────────────────────────────
const GROUPS = [
  { group: 1, putts: [5,  7,  9]  },
  { group: 2, putts: [7,  9,  11] },
  { group: 3, putts: [9,  11, 13] },
  { group: 4, putts: [11, 13, 15] },
  { group: 5, putts: [13, 15, 17] },
  { group: 6, putts: [15, 17, 19] },
];

const TIER_CONFIG: Record<TierName, { label: string; copy: string; color: string }> = {
  elite:       { label: 'Elite',       copy: 'Beating Tour baseline. Championship-grade mid-range putting.',         color: 'var(--sg-strong)' },
  tour:        { label: 'Tour',        copy: 'PGA Tour benchmark. Converting at the level of the best players.',     color: 'var(--sg-gain)'   },
  competitive: { label: 'Competitive', copy: 'Solid collegiate / scratch amateur. The conversion habit is forming.', color: 'var(--bogey)'     },
  developing:  { label: 'Developing',  copy: 'Repeat the drill — focus on speed first, line second.',               color: 'var(--double)'    },
};

// ── Scoring ────────────────────────────────────────────────────────
function tierForScore(score: number): TierName {
  if (score >= 11) return 'elite';
  if (score >= 9)  return 'tour';
  if (score >= 7)  return 'competitive';
  return 'developing';
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
export function loadSessions(): InsideTwentySession[] {
  try {
    const raw = localStorage.getItem(LS_INSIDE_TWENTY_SESSIONS);
    if (!raw) return [];
    const store = JSON.parse(raw) as { version: number; sessions: InsideTwentySession[] };
    if (store.version !== 1 || !Array.isArray(store.sessions)) {
      console.warn('[Inside Twenty] schema mismatch, resetting store');
      return [];
    }
    return store.sessions;
  } catch {
    return [];
  }
}

export function persistSessions(sessions: InsideTwentySession[]): void {
  try {
    localStorage.setItem(LS_INSIDE_TWENTY_SESSIONS, JSON.stringify({ version: 1, sessions }));
  } catch { /* noop */ }
}

/**
 * Fold the account's sessions into this device's list, so a session played on
 * another device shows up here. Returns null when the account copy is
 * unreachable (signed out or offline), in which case `local` still stands.
 */
export function syncSessions(local: InsideTwentySession[]) {
  return syncDrillHistory<InsideTwentySession>({
    drillType: 'inside-twenty',
    local,
    hydrate: (r) => ({
      id: r.client_id,
      date: playedOnISO(r),
      timestamp: playedAtMs(r),
      score: Number(r.payload.score ?? 0),
      tier: (r.payload.tier as TierName) ?? 'developing',
    }),
    keyOf: (x) => x.id,
    sortKey: (x) => x.timestamp,
  });
}

function buildSession(score: number, date: string): InsideTwentySession {
  return {
    id: crypto.randomUUID(),
    date,
    timestamp: Date.now(),
    score,
    tier: tierForScore(score),
  };
}

// ── Main component ─────────────────────────────────────────────────
export default function InsideTwenty() {
  const [screen, setScreen]                 = useState<Screen>('home');
  const [sessions, setSessions]             = useState<InsideTwentySession[]>([]);
  const [storageAvailable, setStorageAvail] = useState(true);
  const [score, setScore]                   = useState(9);
  const [sessionDate, setSessionDate]       = useState<string>(todayISO);
  const [result, setResult]                 = useState<ResultState | null>(null);

  useEffect(() => {
    if (!isAvailable()) {
      setStorageAvail(false);
      return;
    }
    const local = loadSessions();
    setSessions(local);
    void syncSessions(local).then((merged) => {
      if (!merged) return;
      setSessions(merged);
      persistSessions(merged);
    });
  }, []);

  function handleStartSession() {
    setScore(9);
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
    const updated = [newSession, ...sessions];
    // Local write first so the result is never lost, then push to the player's
    // account. The session's own id is the idempotency key, so a queued retry
    // updates the same row.
    persistSessions(updated);
    setSessions(updated);
    void recordDrillSession(
      drillSessionInput('inside-twenty', newSession.id, new Date(newSession.timestamp), {
        date: newSession.date,
        score: newSession.score,
        tier: newSession.tier,
      }),
    );
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
  sessions: InsideTwentySession[];
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
        <p className="it-hero-subtitle">Eighteen putts · The conversion zone · One number that tells the truth</p>
        <button className="it-primary-btn" onClick={onStart}>
          Start Session
        </button>
      </div>

      {/* ── The Drill ── */}
      <div className="it-card">
        <p className="it-section-label">The Drill</p>
        <p className="it-body-text" style={{ marginBottom: 20 }}>
          Inside Twenty trains the make-or-break mid-range zone — the distances where rounds are won or lost.
          Six groups, three putts each. Walk off each distance — no markers needed. Putt the prescribed
          three putts per group with one ball, no retries. Track makes in your head across all 18 putts.
          When the drill is done, enter the total. One number. That is the test.
        </p>
        <div className="it-ladder-scroll">
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
        </div>
        <div className="it-rules">
          {[
            'One ball per putt — misses are not retried.',
            'Walk off each distance. No formal markers needed.',
            'Choose any line from each position — break is part of the test.',
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
        <p className="it-section-label">Performance Tiers</p>
        <p className="it-body-text" style={{ marginBottom: 20 }}>
          Enter one number at the end — total putts made out of 18. Tour benchmark
          is 9–10 makes, anchored to PGA Tour conversion rates in the 5–19 ft range.
        </p>
        <div className="it-tier-grid">
          {(Object.entries(TIER_CONFIG) as [TierName, typeof TIER_CONFIG[TierName]][]).map(([key, cfg]) => {
            const ranges: Record<TierName, string> = {
              elite:       '11–18  ·  Championship grade',
              tour:        '9–10   ·  PGA Tour benchmark',
              competitive: '7–8    ·  Collegiate / scratch',
              developing:  '0–6    ·  Below baseline',
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
          Putts inside ten feet are the conversion zone. Putts outside twenty are the lag zone.
          Inside Twenty trains the band in between — where make percentage drops sharply with every
          foot added, but where confident speed and line still produce conversions. This is the
          range that separates good putters from great ones.
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
                    {fmtDateShort(s.date)}
                  </span>
                  <span className="it-recent-score">
                    {s.score}<span>/18</span>
                  </span>
                  <span className="it-recent-sg" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="it-recent-tier-badge" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
          <Link href="/player-path/putting/inside-twenty/history" className="it-view-history-link">
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
        <span className="it-nav-label">Active Session</span>
        <span style={{ minWidth: 60 }} />
      </div>

      {/* ── Distance reference ── */}
      <div className="it-card">
        <div className="i20-distance-ref">
          <p className="i20-distance-ref-label">Distance Reference — All 6 Groups</p>
          {GROUPS.map(({ group, putts }) => (
            <div className="i20-group-row" key={group}>
              <span className="i20-group-num">Group {group}</span>
              {putts.map(d => (
                <span className="i20-group-dist" key={d}>
                  {d}<span>ft</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Score entry ── */}
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
              <div className="it-delta-sub">new baseline!</div>
            </>
          )}
        </div>
      </div>

      {/* ── CTAs ── */}
      <div className="it-cta-row">
        <Link
          href="/player-path/putting/inside-twenty/history"
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
