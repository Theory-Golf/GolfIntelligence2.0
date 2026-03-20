// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import './WedgeStandard.css';

// ── Storage helpers ──────────────────────────────────────────────
const storage = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  del: (k) => { try { localStorage.removeItem(k); } catch (_) {} },
};

// ── Default wedge set ────────────────────────────────────────────
const DEFAULT_WEDGES = [
  { name: 'PW',  fullCarry: 135, threeQuarter: 120, half: 100 },
  { name: 'GW',  fullCarry: 120, threeQuarter: 105, half: 88  },
  { name: '52°', fullCarry: 108, threeQuarter: 95,  half: 78  },
  { name: '56°', fullCarry: 95,  threeQuarter: 82,  half: 68  },
  { name: '60°', fullCarry: 80,  threeQuarter: 68,  half: 55  },
];

// ── Scoring / level logic ────────────────────────────────────────
function calcProximity(distMiss, dispMiss) {
  return Math.sqrt(distMiss * distMiss + dispMiss * dispMiss);
}

function calcPoints(proximity, level) {
  let base;
  if      (proximity <=  2) base = 250;
  else if (proximity <=  4) base = 235;
  else if (proximity <=  6) base = 220;
  else if (proximity <=  8) base = 205;
  else if (proximity <= 10) base = 190;
  else if (proximity <= 14) base = 170;
  else if (proximity <= 18) base = 150;
  else if (proximity <= 24) base = 125;
  else if (proximity <= 32) base = 100;
  else                       base = 60;
  return Math.round(base / (1 + (level - 1) * 0.012));
}

function getRating(points) {
  if (points >= 235) return { label: 'Elite',        cls: 'ws-rating-elite' };
  if (points >= 210) return { label: 'Excellent',    cls: 'ws-rating-great' };
  if (points >= 185) return { label: 'Tour Average', cls: 'ws-rating-avg'   };
  if (points >= 155) return { label: 'Good',         cls: 'ws-rating-good'  };
  if (points >= 120) return { label: 'Fair',         cls: 'ws-rating-fair'  };
  return                    { label: 'Needs Work',   cls: 'ws-rating-work'  };
}

function getLevelConfig(level) {
  return {
    targets:          10 + Math.floor(level / 10) * 2,
    pointsToAdvance:  175 + Math.floor(level / 5) * 5,
    tier: level <= 10  ? 'Beginner'
        : level <= 25  ? 'Intermediate'
        : level <= 50  ? 'Advanced'
        : level <= 75  ? 'Expert'
        : 'Elite',
  };
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Inline SVG icons ─────────────────────────────────────────────
const ICONS = {
  x:          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  arrowLeft:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 19-7-7 7-7M19 12H5"/></svg>,
  arrowRight: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 5 7 7-7 7M5 12h14"/></svg>,
  chevDown:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6"/></svg>,
  chevUp:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m18 15-6-6-6 6"/></svg>,
  chevRight:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 18 6-6-6-6"/></svg>,
  plus:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14m-7-7h14"/></svg>,
  minus:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12h14"/></svg>,
  settings:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  chart:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20V10m6 10V4M6 20v-4"/></svg>,
  trophy:     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18M6 9v6a6 6 0 0 0 12 0V9M6 9h12m-6 13v-4"/></svg>,
  target:     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  check:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="20 6 9 17 4 12"/></svg>,
  volume:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
  refresh:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  trash:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
};

// ── Main component ───────────────────────────────────────────────
export default function WedgeStandard() {
  const [screen, setScreen] = useState('home');
  const [wedges, setWedges] = useState(DEFAULT_WEDGES);
  const [challengeLevel, setChallengeLevel] = useState(1);
  const [practiceMode, setPracticeMode] = useState('premier');

  // Practice state
  const [currentTarget, setCurrentTarget] = useState(null);
  const [shotNumber, setShotNumber] = useState(0);
  const [sessionShots, setSessionShots] = useState([]);
  const [actualDistance, setActualDistance] = useState('');
  const [dispersionAmount, setDispersionAmount] = useState('');
  const [dispersionDir, setDispersionDir] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [lastShot, setLastShot] = useState(null);

  // Creative mode
  const [creativeTargets, setCreativeTargets] = useState([80, 95, 110]);
  const [creativeRounds, setCreativeRounds] = useState(3);

  // History
  const [history, setHistory] = useState([]);
  const [lifetimeStats, setLifetimeStats] = useState({ totalSessions: 0, totalShots: 0, avgPoints: 0, bestSession: 0, totalPoints: 0 });
  const [expandedId, setExpandedId] = useState(null);

  // Load persisted data
  useEffect(() => {
    const w = storage.get('wm-wedges');   if (w) setWedges(w);
    const l = storage.get('wm-level');    if (l) setChallengeLevel(l);
    const h = storage.get('wm-history'); if (h) setHistory(h);
    const s = storage.get('wm-stats');   if (s) setLifetimeStats(s);
    const c = storage.get('wm-creative');
    if (c) { setCreativeTargets(c.targets || [80, 95, 110]); setCreativeRounds(c.rounds || 3); }
  }, []);

  function saveWedges(w) { setWedges(w); storage.set('wm-wedges', w); }
  function saveLevel(l)  { setChallengeLevel(l); storage.set('wm-level', l); }

  function saveSession(data) {
    const updated = [data, ...history].slice(0, 50);
    setHistory(updated);
    const newStats = {
      totalSessions: lifetimeStats.totalSessions + 1,
      totalShots:    lifetimeStats.totalShots + data.shots.length,
      totalPoints:   lifetimeStats.totalPoints + data.totalPoints,
      avgPoints:     Math.round((lifetimeStats.totalPoints + data.totalPoints) / (lifetimeStats.totalSessions + 1)),
      bestSession:   Math.max(lifetimeStats.bestSession, data.avgPoints),
    };
    setLifetimeStats(newStats);
    storage.set('wm-history', updated);
    storage.set('wm-stats', newStats);
  }

  function clearHistory() {
    if (!confirm('Clear all session history?')) return;
    setHistory([]);
    const reset = { totalSessions: 0, totalShots: 0, avgPoints: 0, bestSession: 0, totalPoints: 0 };
    setLifetimeStats(reset);
    storage.del('wm-history');
    storage.set('wm-stats', reset);
  }

  function speakTarget(d) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(`${d} yards`);
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  }

  const generateTarget = useCallback(() => {
    const all = wedges.flatMap((w) => [w.fullCarry, w.threeQuarter, w.half]);
    const min = Math.min(...all) - 10;
    const max = Math.max(...all) + 5;
    let t;
    if (Math.random() > 0.4) {
      t = all[Math.floor(Math.random() * all.length)] + Math.floor(Math.random() * 7) - 3;
    } else {
      t = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return Math.max(40, Math.min(150, t));
  }, [wedges]);

  function startSession() {
    setShotNumber(0);
    setSessionShots([]);
    setShowResult(false);
    setLastShot(null);
    setActualDistance('');
    setDispersionAmount('');
    setDispersionDir(null);
    setScreen('practice');
    setTimeout(() => {
      const t = practiceMode === 'premier' ? generateTarget() : creativeTargets[0];
      setCurrentTarget(t);
      speakTarget(t);
      setShotNumber(1);
    }, 300);
  }

  function recordShot() {
    const actual = parseFloat(actualDistance);
    const disp   = parseFloat(dispersionAmount) || 0;
    if (isNaN(actual) || actual < 0) return;
    if (disp > 0 && !dispersionDir) return;

    const distMiss  = actual - currentTarget;
    const proximity = Math.round(calcProximity(Math.abs(distMiss), disp) * 10) / 10;
    const points    = calcPoints(proximity, challengeLevel);
    const rating    = getRating(points);

    const shotData = {
      target: currentTarget,
      actual,
      distanceMiss: Math.round(distMiss * 10) / 10,
      dispersion: disp,
      dispersionDir: disp > 0 ? dispersionDir : null,
      proximity,
      points,
      rating,
      shotNumber,
    };

    setLastShot(shotData);
    setSessionShots((prev) => [...prev, shotData]);
    setShowResult(true);
    setActualDistance('');
    setDispersionAmount('');
    setDispersionDir(null);
  }

  function nextShot() {
    const config = getLevelConfig(challengeLevel);
    const total  = practiceMode === 'premier'
      ? config.targets
      : creativeTargets.length * creativeRounds;

    const updatedShots = [...sessionShots]; // already updated by recordShot

    if (shotNumber >= total) {
      const totalPts = updatedShots.reduce((s, x) => s + x.points, 0);
      const avgPts   = Math.round(totalPts / updatedShots.length);
      const data = {
        id: Date.now(),
        date: new Date().toISOString(),
        mode: practiceMode,
        level: challengeLevel,
        shots: updatedShots,
        totalPoints: totalPts,
        avgPoints: avgPts,
        avgProximity:   Math.round(updatedShots.reduce((s, x) => s + x.proximity,               0) / updatedShots.length * 10) / 10,
        avgDistanceMiss: Math.round(updatedShots.reduce((s, x) => s + Math.abs(x.distanceMiss), 0) / updatedShots.length * 10) / 10,
        avgDispersion:  Math.round(updatedShots.reduce((s, x) => s + x.dispersion,              0) / updatedShots.length * 10) / 10,
        bestShot:       Math.max(...updatedShots.map((x) => x.points)),
        excellentShots: updatedShots.filter((x) => x.points >= 210).length,
      };
      saveSession(data);
      if (practiceMode === 'premier' && avgPts >= config.pointsToAdvance) {
        saveLevel(challengeLevel + 1);
      }
      setScreen('results');
      return;
    }

    setShowResult(false);
    setLastShot(null);
    const t = practiceMode === 'premier'
      ? generateTarget()
      : creativeTargets[shotNumber % creativeTargets.length];
    setCurrentTarget(t);
    speakTarget(t);
    setShotNumber((n) => n + 1);
  }

  function getSessionStats() {
    if (!sessionShots.length) return null;
    const totalPts = sessionShots.reduce((s, x) => s + x.points, 0);
    return {
      totalPoints:      totalPts,
      avgPoints:        Math.round(totalPts / sessionShots.length),
      avgProximity:     (sessionShots.reduce((s, x) => s + x.proximity, 0) / sessionShots.length).toFixed(1),
      avgDistanceMiss:  (sessionShots.reduce((s, x) => s + Math.abs(x.distanceMiss), 0) / sessionShots.length).toFixed(1),
      avgDispersion:    (sessionShots.reduce((s, x) => s + x.dispersion, 0) / sessionShots.length).toFixed(1),
      bestShot:         sessionShots.reduce((b, x) => x.points > b.points ? x : b, sessionShots[0]),
      excellentShots:   sessionShots.filter((x) => x.points >= 210).length,
    };
  }

  const config        = getLevelConfig(challengeLevel);
  const dispNum       = parseFloat(dispersionAmount) || 0;
  const canRecord     = actualDistance !== '' && (dispNum === 0 || dispersionDir);
  const sessionTotal  = practiceMode === 'premier'
    ? config.targets
    : creativeTargets.length * creativeRounds;

  // ─────────────────────────────────────────────────────────────────
  // HOME SCREEN
  // ─────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="ws-wrapper">
        <div className="ws-home-header">
          <div className="ws-home-eyebrow">Wedge Standard</div>
        </div>

        {/* Level card */}
        <div className="ws-card" style={{ marginBottom: 16 }}>
          <div className="ws-card-title">Challenge Level</div>
          <div className="ws-level-display">
            <span className="ws-level-number">{challengeLevel}</span>
            <div className="ws-level-meta">
              <div className="ws-level-tier">{config.tier}</div>
              <div className="ws-level-bar">
                <div className="ws-level-fill" style={{ width: `${(challengeLevel % 10) * 10}%` }} />
              </div>
              <div className="ws-level-threshold">{config.pointsToAdvance}+ avg to advance</div>
            </div>
          </div>
        </div>

        {/* Lifetime stats */}
        <div className="ws-stat-grid">
          {[
            { label: 'Sessions',      value: lifetimeStats.totalSessions },
            { label: 'Lifetime Avg',  value: lifetimeStats.avgPoints || '—' },
            { label: 'Total Shots',   value: lifetimeStats.totalShots },
            { label: 'Best Session',  value: lifetimeStats.bestSession || '—', highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="ws-stat-cell">
              <span className="ws-stat-label">{label}</span>
              <span className="ws-stat-value" style={highlight ? { color: 'var(--bogey)' } : {}}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Mode buttons */}
        <button className="ws-primary-btn" onClick={() => { setPracticeMode('premier'); startSession(); }}>
          {ICONS.target}
          Premier Mode — {config.targets} Targets
          <span className="ws-btn-arrow">{ICONS.chevRight}</span>
        </button>

        <button className="ws-secondary-btn" onClick={() => setScreen('creative')}>
          {ICONS.settings}
          Creative Mode
          <span className="ws-btn-arrow">{ICONS.chevRight}</span>
        </button>

        <button className="ws-secondary-btn" onClick={() => setScreen('history')}>
          {ICONS.chart}
          Session History
          <span className="ws-btn-arrow" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.10em' }}>
            {history.length}
          </span>
        </button>

        <button className="ws-ghost-btn" onClick={() => setScreen('setup')}>
          {ICONS.settings}
          Edit Wedge Distances
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // SETUP SCREEN
  // ─────────────────────────────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <div className="ws-wrapper">
        <div className="ws-top-nav">
          <button className="ws-back-btn" onClick={() => setScreen('home')}>
            {ICONS.x} Close
          </button>
          <span className="ws-nav-shot">Wedge Setup</span>
          <div style={{ width: 72 }} />
        </div>

        <p className="ws-setup-desc">Enter your carry distances for each wedge.</p>

        {wedges.map((w, i) => (
          <div key={i} className="ws-wedge-card">
            <div className="ws-wedge-header">
              <div className="ws-wedge-badge">{w.name}</div>
              <input
                type="text"
                className="ws-wedge-name-input"
                value={w.name}
                onChange={(e) => {
                  const u = [...wedges]; u[i] = { ...u[i], name: e.target.value }; setWedges(u);
                }}
              />
            </div>
            <div className="ws-dist-grid">
              {[['fullCarry', 'Full'], ['threeQuarter', '3/4'], ['half', '1/2']].map(([k, lbl]) => (
                <div key={k} className="ws-dist-field">
                  <label>{lbl}</label>
                  <input
                    type="number"
                    className="ws-dist-input"
                    value={w[k]}
                    onChange={(e) => {
                      const u = [...wedges]; u[i] = { ...u[i], [k]: parseInt(e.target.value) || 0 }; setWedges(u);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <button className="ws-primary-btn" style={{ marginTop: 8 }} onClick={() => { saveWedges(wedges); setScreen('home'); }}>
          Save & Continue
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATIVE SCREEN
  // ─────────────────────────────────────────────────────────────────
  if (screen === 'creative') {
    return (
      <div className="ws-wrapper">
        <div className="ws-top-nav">
          <button className="ws-back-btn" onClick={() => setScreen('home')}>
            {ICONS.x} Close
          </button>
          <span className="ws-nav-shot">Creative Mode</span>
          <div style={{ width: 72 }} />
        </div>

        <div className="ws-card">
          <div className="ws-card-title">Target Distances (yards)</div>
          <div className="ws-target-chips">
            {creativeTargets.map((t, i) => (
              <div key={i} className="ws-target-chip">
                <input
                  type="number"
                  className="ws-target-chip-input"
                  value={t}
                  onChange={(e) => {
                    const u = [...creativeTargets]; u[i] = parseInt(e.target.value) || 0; setCreativeTargets(u);
                  }}
                />
                {creativeTargets.length > 1 && (
                  <button
                    className="ws-target-chip-remove"
                    onClick={() => setCreativeTargets(creativeTargets.filter((_, j) => j !== i))}
                  >
                    {ICONS.x}
                  </button>
                )}
              </div>
            ))}
            <button className="ws-add-chip" onClick={() => setCreativeTargets([...creativeTargets, 100])}>
              {ICONS.plus} Add
            </button>
          </div>
        </div>

        <div className="ws-card">
          <div className="ws-card-title">Rounds</div>
          <div className="ws-rounds-control">
            <button className="ws-rounds-btn" onClick={() => setCreativeRounds(Math.max(1, creativeRounds - 1))}>
              {ICONS.minus}
            </button>
            <span className="ws-rounds-value">{creativeRounds}</span>
            <button className="ws-rounds-btn" onClick={() => setCreativeRounds(creativeRounds + 1)}>
              {ICONS.plus}
            </button>
          </div>
          <p className="ws-rounds-total">{creativeTargets.length * creativeRounds} total shots</p>
        </div>

        <button
          className="ws-primary-btn"
          onClick={() => {
            storage.set('wm-creative', { targets: creativeTargets, rounds: creativeRounds });
            setPracticeMode('creative');
            startSession();
          }}
        >
          Start Practice
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // HISTORY SCREEN
  // ─────────────────────────────────────────────────────────────────
  if (screen === 'history') {
    return (
      <div className="ws-wrapper">
        <div className="ws-top-nav">
          <button className="ws-back-btn" onClick={() => setScreen('home')}>
            {ICONS.x} Close
          </button>
          <span className="ws-nav-shot">Session History</span>
          {history.length > 0
            ? <button className="ws-clear-btn" onClick={clearHistory}>{ICONS.trash}</button>
            : <div style={{ width: 40 }} />
          }
        </div>

        {/* Lifetime summary */}
        <div className="ws-card" style={{ marginBottom: 16 }}>
          <div className="ws-card-title">Lifetime Summary</div>
          <div className="ws-stat-grid" style={{ border: 'none', background: 'transparent', gap: 12 }}>
            {[
              { label: 'Sessions',   value: lifetimeStats.totalSessions },
              { label: 'Avg Points', value: lifetimeStats.avgPoints || '—' },
              { label: 'Total Shots',value: lifetimeStats.totalShots },
              { label: 'Best Avg',   value: lifetimeStats.bestSession || '—', highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label}>
                <div className="ws-stat-value" style={{ fontSize: 24, color: highlight ? 'var(--bogey)' : 'var(--color-text)' }}>{value}</div>
                <div className="ws-stat-label">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="ws-empty"><p className="ws-empty-text">No sessions recorded yet</p></div>
        ) : (
          <div className="ws-history-list">
            {history.map((s) => {
              const rating = getRating(s.avgPoints);
              const expanded = expandedId === s.id;
              return (
                <div key={s.id} className="ws-history-entry">
                  <button className="ws-history-row-btn" onClick={() => setExpandedId(expanded ? null : s.id)}>
                    <div className="ws-history-entry-left">
                      <div className="ws-history-score-box">
                        <span className={`ws-history-score ${rating.cls}`}>{s.avgPoints}</span>
                      </div>
                      <div>
                        <div className="ws-history-mode">
                          {s.mode === 'premier' ? `Level ${s.level}` : 'Creative'}
                        </div>
                        <div className="ws-history-date">{fmtDate(s.date)}</div>
                      </div>
                    </div>
                    <div className="ws-history-entry-right">
                      <span className="ws-history-shots">{s.shots.length} shots</span>
                      {expanded ? ICONS.chevUp : ICONS.chevDown}
                    </div>
                  </button>
                  {expanded && (
                    <div className="ws-history-detail">
                      <div className="ws-history-detail-stats">
                        {[
                          { label: 'Proximity', value: `${s.avgProximity}y`, cls: 'ws-rating-elite' },
                          { label: 'Dist Miss',  value: `${s.avgDistanceMiss}y` },
                          { label: 'Dispersion', value: `${s.avgDispersion}y` },
                        ].map(({ label, value, cls }) => (
                          <div key={label} className="ws-history-detail-cell">
                            <div className={`ws-history-detail-val${cls ? ` ${cls}` : ''}`}>{value}</div>
                            <div className="ws-stat-label" style={{ textAlign: 'center' }}>{label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="ws-history-shot-list">
                        {s.shots.map((sh, idx) => (
                          <div key={idx} className="ws-history-shot-row">
                            <span style={{ color: 'var(--color-muted)', width: 24 }}>#{idx + 1}</span>
                            <span style={{ color: 'var(--color-text)' }}>{sh.target}y → {sh.actual}y</span>
                            <span style={{ color: 'var(--color-muted)' }}>{sh.proximity}y</span>
                            <span className={sh.rating.cls} style={{ fontWeight: 500 }}>{sh.points}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // PRACTICE SCREEN
  // ─────────────────────────────────────────────────────────────────
  if (screen === 'practice') {
    const sessionAvg = sessionShots.length > 0
      ? Math.round(sessionShots.reduce((s, x) => s + x.points, 0) / sessionShots.length)
      : null;

    return (
      <div className="ws-wrapper">
        <div className="ws-top-nav">
          <button className="ws-back-btn" onClick={() => setScreen('home')}>
            {ICONS.x} Exit
          </button>
          <div className="ws-nav-center">
            <div className="ws-nav-mode">{practiceMode === 'premier' ? `Level ${challengeLevel}` : 'Creative'}</div>
            <div className="ws-nav-shot">Shot {shotNumber} of {sessionTotal}</div>
          </div>
          <button className="ws-speak-btn" onClick={() => currentTarget && speakTarget(currentTarget)}>
            {ICONS.volume}
          </button>
        </div>

        <div className="ws-progress-track">
          <div className="ws-progress-fill" style={{ width: `${(shotNumber / sessionTotal) * 100}%` }} />
        </div>

        {!showResult ? (
          <>
            {/* Target */}
            <div className="ws-target-card">
              <div className="ws-target-label">Target Distance</div>
              <span className="ws-target-value">{currentTarget ?? '—'}</span>
              <span className="ws-target-unit">yards</span>
            </div>

            {/* Actual carry */}
            <div className="ws-card">
              <label className="ws-input-label">Actual Carry</label>
              <input
                type="number"
                inputMode="decimal"
                className="ws-number-input"
                placeholder="yards"
                value={actualDistance}
                onChange={(e) => setActualDistance(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Offline distance */}
            <div className="ws-card">
              <label className="ws-input-label">Offline Distance</label>
              <input
                type="number"
                inputMode="decimal"
                className="ws-number-input"
                placeholder="0 = center"
                value={dispersionAmount}
                onChange={(e) => { setDispersionAmount(e.target.value); if (!parseFloat(e.target.value)) setDispersionDir(null); }}
                autoComplete="off"
              />

              <div className="ws-direction-grid">
                {[
                  { dir: 'left',  label: 'Left',  icon: ICONS.arrowLeft  },
                  { dir: 'right', label: 'Right', icon: ICONS.arrowRight },
                ].map(({ dir, label, icon }) => (
                  <button
                    key={dir}
                    className={`ws-dir-btn${dispersionDir === dir ? ' is-selected' : ''}`}
                    disabled={dispNum === 0}
                    onClick={() => setDispersionDir(dir)}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
              <p className="ws-dir-hint">
                {dispNum === 0 ? 'Enter offline distance above to enable' : 'Select miss direction'}
              </p>
            </div>

            <button className="ws-primary-btn" onClick={recordShot} disabled={!canRecord}>
              Record Shot
            </button>
          </>
        ) : (
          <>
            {/* Shot result */}
            <div className="ws-result-card">
              <div className={`ws-result-rating ${lastShot?.rating.cls}`}>{lastShot?.rating.label}</div>
              <span className="ws-result-points">{lastShot?.points}</span>
              <span className="ws-result-pts-label">points</span>

              {/* Detail row */}
              <div className="ws-shot-detail-row">
                {/* Distance miss */}
                <div className="ws-shot-detail-cell">
                  <div className="ws-shot-detail-label">Distance</div>
                  <div className={`ws-shot-detail-value ${lastShot?.distanceMiss > 0 ? 'ws-long' : lastShot?.distanceMiss < 0 ? 'ws-short' : 'ws-center'}`}>
                    {lastShot?.distanceMiss > 0 ? '+' : ''}{lastShot?.distanceMiss}y
                  </div>
                  <div className="ws-shot-detail-sub">
                    {lastShot?.distanceMiss > 0 ? 'long' : lastShot?.distanceMiss < 0 ? 'short' : 'perfect'}
                  </div>
                </div>
                {/* Dispersion */}
                <div className="ws-shot-detail-cell">
                  <div className="ws-shot-detail-label">Offline</div>
                  <div className="ws-shot-detail-value" style={{ color: lastShot?.dispersion > 0 ? 'var(--c2)' : 'var(--under)' }}>
                    {lastShot?.dispersion}y
                  </div>
                  <div className="ws-shot-detail-sub">
                    {lastShot?.dispersion > 0 ? lastShot?.dispersionDir : 'center'}
                  </div>
                </div>
                {/* Proximity */}
                <div className="ws-shot-detail-cell">
                  <div className="ws-shot-detail-label">Proximity</div>
                  <div className="ws-shot-detail-value ws-rating-elite">{lastShot?.proximity}y</div>
                  <div className="ws-shot-detail-sub">to pin</div>
                </div>
              </div>

              {/* Scatter plot */}
              <div className="ws-scatter-wrap">
                <div className="ws-scatter">
                  <div className="ws-scatter-grid-h" />
                  <div className="ws-scatter-grid-v" />
                  <div className="ws-scatter-pin" />
                  <div
                    className="ws-scatter-ball"
                    style={{
                      left: `calc(50% + ${(lastShot?.dispersionDir === 'left' ? -1 : 1) * Math.min(lastShot?.dispersion || 0, 20) * 2.5}px)`,
                      top:  `calc(50% - ${Math.min(Math.abs(lastShot?.distanceMiss || 0), 20) * (lastShot?.distanceMiss > 0 ? -1 : 1) * 2.5}px)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Running avg */}
            {sessionAvg !== null && (
              <div className="ws-session-avg-bar">
                <span className="ws-session-avg-label">Session Average</span>
                <span className="ws-session-avg-value">{sessionAvg} pts</span>
              </div>
            )}

            <button className="ws-primary-btn" onClick={nextShot}>
              {shotNumber >= sessionTotal ? 'View Results' : 'Next Target'}
              {ICONS.chevRight}
            </button>
          </>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RESULTS SCREEN
  // ─────────────────────────────────────────────────────────────────
  if (screen === 'results') {
    const stats    = getSessionStats();
    const leveledUp = practiceMode === 'premier' && stats && stats.avgPoints >= getLevelConfig(challengeLevel - 1).pointsToAdvance;
    if (!stats) return null;
    const rating   = getRating(stats.avgPoints);

    return (
      <div className="ws-wrapper">
        <div className="ws-results-header">
          <div style={{ color: leveledUp ? 'var(--bogey)' : 'var(--color-accent)', marginBottom: 12 }}>
            {leveledUp ? ICONS.trophy : ICONS.target}
          </div>
          {leveledUp && <div className="ws-levelup-badge">Level Up!</div>}
          <div className="ws-results-title">
            {leveledUp ? `Level ${challengeLevel}` : 'Session Complete'}
          </div>
          {leveledUp && (
            <div className="ws-results-sub">Advanced to Level {challengeLevel}</div>
          )}
        </div>

        {/* Average hero */}
        <div className="ws-avg-hero">
          <div className="ws-avg-hero-label">Average Points</div>
          <span className="ws-avg-hero-value">{stats.avgPoints}</span>
          <span className={`ws-avg-hero-rating ${rating.cls}`}>{rating.label}</span>
        </div>

        {/* Proximity / dist miss / dispersion */}
        <div className="ws-results-detail">
          {[
            { label: 'Proximity',  value: `${stats.avgProximity}y`, cls: 'ws-rating-elite' },
            { label: 'Dist Miss',  value: `${stats.avgDistanceMiss}y` },
            { label: 'Dispersion', value: `${stats.avgDispersion}y` },
          ].map(({ label, value, cls }) => (
            <div key={label} className="ws-results-cell">
              <div className="ws-stat-label">{label}</div>
              <div className={`ws-results-val${cls ? ` ${cls}` : ''}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Excellent / best */}
        <div className="ws-results-detail-2">
          <div className="ws-results-cell">
            <div className="ws-stat-label">Excellent Shots</div>
            <div className="ws-results-val ws-rating-great">{stats.excellentShots}</div>
          </div>
          <div className="ws-results-cell">
            <div className="ws-stat-label">Best Shot</div>
            <div className="ws-results-val ws-rating-elite">{stats.bestShot.points}</div>
          </div>
        </div>

        {/* Shot breakdown */}
        <div className="ws-card">
          <div className="ws-card-title">Shot Breakdown</div>
          <div className="ws-breakdown-list">
            {sessionShots.map((s, i) => (
              <div key={i} className="ws-breakdown-row">
                <span style={{ color: 'var(--color-muted)', width: 28 }}>#{i + 1}</span>
                <span style={{ color: 'var(--color-text)' }}>{s.target}y → {s.actual}y</span>
                <span style={{ color: 'var(--color-muted)', width: 48, textAlign: 'right' }}>{s.proximity}y</span>
                <span className={s.rating.cls} style={{ fontWeight: 500, width: 36, textAlign: 'right' }}>{s.points}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ws-saved-note">
          {ICONS.check} Saved to history
        </div>

        <button className="ws-primary-btn" onClick={() => { setPracticeMode('premier'); startSession(); }}>
          {ICONS.refresh} Practice Again
        </button>
        <button className="ws-secondary-btn" onClick={() => setScreen('home')}>
          Back to Home
        </button>
      </div>
    );
  }

  return null;
}
