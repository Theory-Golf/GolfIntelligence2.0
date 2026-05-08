// @ts-nocheck
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import './ApproachStandard.css';

// ── Storage helpers ──────────────────────────────────────────────
const storage = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
};

const LS_PLAYER   = 'as_player';
const LS_SESSIONS = 'as_sessions';

// ── Domain constants ─────────────────────────────────────────────

const TIERS = [
  { id: 1, name: 'Foundation',    handicap: '15 – 20 handicap', desc: 'Get the ball in play. Build the base.' },
  { id: 2, name: 'Developing',    handicap: '10 – 15 handicap', desc: 'Build consistency at the standard.' },
  { id: 3, name: 'Competitive',   handicap: '5 – 10 handicap',  desc: 'Single-digit territory. Sharpen the line.' },
  { id: 4, name: 'Scratch',       handicap: '0 – 5 handicap',   desc: 'Scratch standard. Tour-adjacent.' },
  { id: 5, name: 'Tour Standard', handicap: 'Tour-level',       desc: 'PGA Tour median proximity. The ceiling.' },
];

// Lateral ring lookup — [tier1, tier2, tier3, tier4, tier5]
const RING_ANCHORS = {
  125: [17, 14, 11, 9, 8],
  150: [20, 16, 13, 10, 9],
  175: [24, 19, 15, 13, 11],
  200: [28, 22, 18, 17, 13],
  210: [29, 23, 19, 18, 14],
};

const ringFor = (distance, tier) => {
  const anchors = Object.keys(RING_ANCHORS).map(Number).sort((a, b) => a - b);
  if (distance <= anchors[0]) return RING_ANCHORS[anchors[0]][tier - 1];
  if (distance >= anchors[anchors.length - 1]) return RING_ANCHORS[anchors[anchors.length - 1]][tier - 1];
  let lo = anchors[0], hi = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (distance >= anchors[i] && distance <= anchors[i + 1]) { lo = anchors[i]; hi = anchors[i + 1]; break; }
  }
  const frac = (distance - lo) / (hi - lo);
  return Math.round(RING_ANCHORS[lo][tier - 1] + (RING_ANCHORS[hi][tier - 1] - RING_ANCHORS[lo][tier - 1]) * frac);
};

const carryFor = (distance) => Math.max(1, Math.round(distance / 25));

const thresholdsFor = (shotCount) => {
  if (shotCount === 5)  return { pass: 3, elite: 4, max: 5 };
  if (shotCount === 10) return { pass: 6, elite: 8, max: 10 };
  if (shotCount === 15) return { pass: 8, elite: 11, max: 15 };
  return { pass: 6, elite: 8, max: 10 };
};

const resultFor = (insideCount, shotCount) => {
  const t = thresholdsFor(shotCount);
  if (insideCount >= t.elite) return 'ELITE';
  if (insideCount >= t.pass)  return 'PASS';
  return 'FAIL';
};

// ── Yardage generation ───────────────────────────────────────────

const generateYardages = (min, max, count) => {
  const range = max - min;
  const bandSize = range / count;
  const draws = [];
  for (let i = 0; i < count; i++) {
    const bandLo = min + i * bandSize;
    const bandHi = min + (i + 1) * bandSize;
    draws.push(Math.max(min, Math.min(max, Math.round(bandLo + Math.random() * (bandHi - bandLo)))));
  }
  for (let i = draws.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [draws[i], draws[j]] = [draws[j], draws[i]];
  }
  for (let i = 0; i < draws.length - 1; i++) {
    if (Math.abs(draws[i] - draws[i + 1]) < 5) {
      for (let j = i + 2; j < draws.length; j++) {
        const wouldFix =
          Math.abs(draws[i] - draws[j]) >= 5 &&
          (j + 1 >= draws.length || Math.abs(draws[j] - draws[i + 2]) >= 5) &&
          Math.abs(draws[j - 1] - draws[i + 1]) >= 5;
        if (wouldFix) { [draws[i + 1], draws[j]] = [draws[j], draws[i + 1]]; break; }
      }
    }
  }
  return draws;
};

// ── Shot Shape (CI) system ───────────────────────────────────────

const CI_AVAILABILITY = {
  3: { calls: ['One more', 'One less'], combinable: false },
  4: { calls: ['One more', 'One less', 'Draw', 'Fade', 'High', 'Low'], combinable: false },
  5: { calls: ['One more', 'One less', 'Draw', 'Fade', 'High', 'Low'], combinable: true, combineRate: 0.25 },
};

const activationRateFor = (shapeModePassCount) => {
  if (shapeModePassCount >= 6) return 0.60;
  if (shapeModePassCount >= 3) return 0.45;
  return 0.30;
};

const categoryOf = (call) => {
  if (call === 'One more' || call === 'One less') return 'club';
  if (call === 'Draw' || call === 'Fade')         return 'shape';
  if (call === 'High' || call === 'Low')          return 'trajectory';
  return 'unknown';
};

const generateCI = (tier) => {
  const config = CI_AVAILABILITY[tier];
  if (!config) return null;
  const first = config.calls[Math.floor(Math.random() * config.calls.length)];
  if (config.combinable && Math.random() < config.combineRate) {
    const candidates = config.calls.filter(c => categoryOf(c) !== categoryOf(first));
    if (candidates.length > 0) {
      return [first, candidates[Math.floor(Math.random() * candidates.length)]];
    }
  }
  return [first];
};

const generateCIAssignments = (shotCount, tier, activationRate) => {
  if (!CI_AVAILABILITY[tier]) return new Array(shotCount).fill(null);
  const targetCount = Math.round(shotCount * activationRate);
  const assignments = new Array(shotCount).fill(null);
  const indices = [];
  if (targetCount > 0) {
    const stride = shotCount / targetCount;
    for (let i = 0; i < targetCount; i++) {
      const baseIdx = Math.floor(i * stride);
      const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(stride * 0.6)));
      const idx = Math.min(shotCount - 1, baseIdx + jitter);
      if (!indices.includes(idx)) indices.push(idx);
    }
    while (indices.length < targetCount) {
      const c = Math.floor(Math.random() * shotCount);
      if (!indices.includes(c)) indices.push(c);
    }
  }
  if (indices.includes(0) && shotCount > 3) indices[indices.indexOf(0)] = 1;
  for (let i = 0; i < indices.length - 1; i++) {
    for (let j = i + 1; j < indices.length; j++) {
      if (Math.abs(indices[i] - indices[j]) === 1) {
        const up = indices[j] + 1, down = indices[j] - 1;
        if (up < shotCount && !indices.includes(up)) indices[j] = up;
        else if (down >= 0 && !indices.includes(down)) indices[j] = down;
      }
    }
  }
  for (const idx of indices) assignments[idx] = generateCI(tier);
  return assignments;
};

const countShapeModePasses = (player, sessions) =>
  sessions.filter(s => s.tier === player.currentTier && s.shotCount !== 5 && s.shapeMode === true && (s.result === 'PASS' || s.result === 'ELITE')).length;

const shouldShowShapeModePrompt = (player, sessions) => {
  if (player.currentTier < 3) return false;
  const tierSessions = sessions.filter(s => s.tier === player.currentTier && s.shotCount !== 5).slice(-2);
  if (tierSessions.length < 2) return false;
  if (!tierSessions.every(s => s.result === 'ELITE')) return false;
  if (!tierSessions.every(s => !s.shapeMode)) return false;
  if (tierSessions.some(s => s.promptShownAfter)) return false;
  return true;
};

// ── Periodization engine ─────────────────────────────────────────

const evaluatePeriodization = (player, sessions, justCompleted) => {
  if (justCompleted.shotCount === 5) return { movement: 'NO_CHANGE', reason: 'quick_check' };

  if (player.regressionFlag && justCompleted.tier === player.regressionFlag.fromTier - 1) {
    if (justCompleted.result === 'PASS' || justCompleted.result === 'ELITE') {
      return { movement: 'RE_PROMOTE', toTier: player.regressionFlag.fromTier };
    }
  }

  const tierSessions = sessions
    .filter(s => s.tier === player.currentTier && s.shotCount !== 5)
    .slice(-5).reverse();

  if (tierSessions.length >= 2 && tierSessions[0].result === 'ELITE' && tierSessions[1].result === 'ELITE') {
    if (player.currentTier < 5) return { movement: 'EXPRESS_PROMOTE', toTier: player.currentTier + 1 };
    return { movement: 'NO_CHANGE', reason: 'tier5_ceiling' };
  }

  if (tierSessions.length >= 3 && tierSessions.slice(0, 3).every(s => s.result === 'PASS' || s.result === 'ELITE')) {
    if (player.currentTier < 5) return { movement: 'PROMOTE', toTier: player.currentTier + 1 };
    return { movement: 'NO_CHANGE', reason: 'tier5_ceiling' };
  }

  if (tierSessions.length >= 2 && player.currentTier > 1) {
    const failCount = tierSessions.slice(0, 3).filter(s => s.result === 'FAIL').length;
    if (failCount >= 2) return { movement: 'REGRESS', toTier: player.currentTier - 1, fromTier: player.currentTier };
  }

  return { movement: 'NO_CHANGE' };
};

const computeStreakStatus = (player, sessions) => {
  const tierSessions = sessions.filter(s => s.tier === player.currentTier && s.shotCount !== 5).slice(-3).reverse();
  if (tierSessions.length === 0) return { type: 'none', text: 'No sessions yet at this tier' };

  if (tierSessions[0].result === 'ELITE') {
    let eliteStreak = 0;
    for (const s of tierSessions) { if (s.result === 'ELITE') eliteStreak++; else break; }
    if (eliteStreak >= 1) return { type: 'elite', count: eliteStreak, needed: 2, text: `Elite streak · ${eliteStreak} of 2 to advance` };
  }

  let passStreak = 0;
  for (const s of tierSessions) { if (s.result === 'PASS' || s.result === 'ELITE') passStreak++; else break; }
  if (passStreak > 0) return { type: 'pass', count: passStreak, needed: 3, text: `Pass streak · ${passStreak} of 3 to advance` };

  if (tierSessions.length >= 2 && player.currentTier > 1) {
    const failCount = tierSessions.slice(0, 3).filter(s => s.result === 'FAIL').length;
    if (failCount === 1) return { type: 'risk', text: '1 more Fail in next 2 sessions regresses you' };
  }

  return { type: 'reset', text: 'Streak reset · build a new run' };
};

// ── Pattern detection ────────────────────────────────────────────

const DISTANCE_BANDS = [
  { id: 'short', label: 'Short approach', min: 125, max: 150 },
  { id: 'mid',   label: 'Mid approach',   min: 150, max: 180 },
  { id: 'long',  label: 'Long approach',  min: 180, max: 210 },
];
const bandFor = (y) => y < 150 ? 'short' : y < 180 ? 'mid' : 'long';
const stdDev = (values) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length);
};

const detectPatterns = (player, sessions) => {
  const patterns = [];
  const tierSessions = sessions.filter(s => s.tier === player.currentTier && s.shotCount !== 5);
  if (tierSessions.length < 5) return patterns;

  const last5 = tierSessions.slice(-5);
  const noPromotion = last5.every(s => !s.movement || !['PROMOTE', 'EXPRESS_PROMOTE', 'RE_PROMOTE'].includes(s.movement.movement));
  if (noPromotion && last5.length === 5) {
    patterns.push({ id: 'tier_stall', severity: 'info', title: 'Tier stall', finding: `5 consecutive sessions at Tier ${player.currentTier} with no advance.`, prescription: null, informational: true });
  }

  const insideRates = tierSessions.map(s => s.insideCount / s.shotCount);
  if (stdDev(insideRates) > 0.20) {
    patterns.push({ id: 'inconsistency', severity: 'warning', title: 'High session-to-session variance', finding: `Your Inside rate at Tier ${player.currentTier} has swung widely across sessions (SD ${(stdDev(insideRates) * 100).toFixed(0)}%).`, prescription: `Drop one tier and rebuild a consistent base before pushing back up.` });
  }

  const shapeOff = tierSessions.filter(s => !s.shapeMode);
  const shapeOn  = tierSessions.filter(s => s.shapeMode);
  if (shapeOff.length >= 3 && shapeOn.length >= 3) {
    const offRate = shapeOff.reduce((a, s) => a + s.insideCount / s.shotCount, 0) / shapeOff.length;
    const onRate  = shapeOn.reduce((a, s) => a + s.insideCount / s.shotCount, 0) / shapeOn.length;
    const gap = offRate - onRate;
    if (gap > 0.15) {
      patterns.push({ id: 'mode_dependence', severity: 'warning', title: 'Mode-dependence detected', finding: `Your Shape-off Inside rate is ${(gap * 100).toFixed(0)} points higher than your Shape-on rate at Tier ${player.currentTier}.`, prescription: `Drop one tier when running Shape mode to rebuild constraint-handling at a lower difficulty.` });
    }
  }

  if (shapeOn.length >= 3) {
    const catStats = {};
    shapeOn.forEach(s => {
      if (!s.ciAssignments) return;
      s.ciAssignments.forEach((calls, idx) => {
        if (!calls) return;
        const cat = categoryOf(calls[0]);
        if (!catStats[cat]) catStats[cat] = { inside: 0, total: 0 };
        catStats[cat].total++;
        if (s.outcomes[idx] === 'INSIDE') catStats[cat].inside++;
      });
    });
    const cats = Object.keys(catStats).filter(c => catStats[c].total >= 5);
    if (cats.length >= 2) {
      const rates = cats.map(c => ({ cat: c, rate: catStats[c].inside / catStats[c].total })).sort((a, b) => b.rate - a.rate);
      const gap = rates[0].rate - rates[rates.length - 1].rate;
      if (gap > 0.15) {
        const labels = { club: 'club calls', shape: 'shape calls', trajectory: 'trajectory calls' };
        patterns.push({ id: 'shape_weakness', severity: 'warning', title: 'Constraint-category gap', finding: `In Shape mode, your Inside rate on ${labels[rates[rates.length - 1].cat]} is ${(gap * 100).toFixed(0)} points lower than on ${labels[rates[0].cat]}.`, prescription: `Bias practice toward ${labels[rates[rates.length - 1].cat]} until the gap closes.` });
      }
    }
  }

  const bandStats = { short: { inside: 0, total: 0 }, mid: { inside: 0, total: 0 }, long: { inside: 0, total: 0 } };
  tierSessions.forEach(s => s.yardages.forEach((yd, idx) => {
    const b = bandFor(yd);
    bandStats[b].total++;
    if (s.outcomes[idx] === 'INSIDE') bandStats[b].inside++;
  }));
  const validBands = Object.keys(bandStats).filter(b => bandStats[b].total >= 8);
  if (validBands.length >= 2) {
    const bandRates = validBands.map(b => ({ band: b, label: DISTANCE_BANDS.find(d => d.id === b).label, range: `${DISTANCE_BANDS.find(d => d.id === b).min}–${DISTANCE_BANDS.find(d => d.id === b).max}`, rate: bandStats[b].inside / bandStats[b].total })).sort((a, b) => b.rate - a.rate);
    const gap = bandRates[0].rate - bandRates[bandRates.length - 1].rate;
    if (gap > 0.15) {
      const worst = bandRates[bandRates.length - 1];
      const worstDef = DISTANCE_BANDS.find(d => d.id === worst.band);
      patterns.push({ id: 'distance_band', severity: 'warning', title: 'Distance band weakness', finding: `Your Inside rate from ${worst.range} yd is ${(gap * 100).toFixed(0)} points lower than from ${bandRates[0].range} yd.`, prescription: `Cap your range to ${worst.range} yd for the next session to focus on the weak band.`, suggestedRange: [worstDef.min, worstDef.max] });
    }
  }

  return patterns;
};

// ── Sub-components ───────────────────────────────────────────────

function TierSelection({ onSelect }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="as-slide-up" style={{ padding: '0 22px 32px' }}>
      <div style={{ paddingTop: 16, paddingBottom: 28 }}>
        <div className="as-eyebrow">FIRST LAUNCH</div>
        <h2 style={{ fontSize: 28, lineHeight: 1.2, marginTop: 14, color: 'var(--chalk)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
          Choose your starting tier
        </h2>
        <p style={{ color: 'var(--ash)', marginTop: 12, fontSize: 14, lineHeight: 1.6, fontWeight: 300 }}>
          Pick where you want to begin. The system adjusts as you go — three Pass sessions advances you, two Fails pulls you back.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TIERS.map((tier) => {
          const active = picked === tier.id;
          const ring = ringFor(150, tier.id);
          return (
            <button key={tier.id} className={`as-tier-btn${active ? ' active' : ''}`} onClick={() => setPicked(tier.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: active ? 'var(--scarlet)' : 'var(--ash)', letterSpacing: '0.15em' }}>T{tier.id}</span>
                  <span style={{ fontSize: 17, color: 'var(--chalk)', fontWeight: 500 }}>{tier.name}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: active ? 'var(--scarlet)' : 'var(--cement)' }}>±{ring} yd</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--ash)' }}>{tier.handicap}</span>
                <span style={{ fontSize: 12, color: 'var(--cement)', textAlign: 'right' }}>{tier.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: 'var(--ash)', textAlign: 'center', lineHeight: 1.5 }}>
        Ring at 150 yd shown · scales with distance
      </div>
      <div style={{ marginTop: 24 }}>
        <button className="as-btn-primary" disabled={picked === null} onClick={() => onSelect(picked)}>
          Set my tier
        </button>
      </div>
    </div>
  );
}

function DrillSetup({ player, sessions, patterns, showShapePrompt, onDismissPrompt, onAcceptPrompt, onStart, onHistory }) {
  const [shotCount, setShotCount] = useState(player.lastShotCount || 10);
  const [range, setRange] = useState(player.lastRange || [125, 210]);
  const [shapeMode, setShapeMode] = useState(player.shapeMode || false);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const trackRef = useRef(null);

  const tier = TIERS.find(t => t.id === player.currentTier);
  const ciAvailable = !!CI_AVAILABILITY[player.currentTier];
  const shapeModePassCount = countShapeModePasses(player, sessions);
  const activationRate = activationRateFor(shapeModePassCount);
  const ABS_MIN = 125, ABS_MAX = 210, MIN_WIDTH = 25;

  const handlePointer = (e, handle) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const yd = Math.round(ABS_MIN + pct * (ABS_MAX - ABS_MIN));
    if (handle === 'min') setRange([Math.max(ABS_MIN, Math.min(yd, range[1] - MIN_WIDTH)), range[1]]);
    else setRange([range[0], Math.min(ABS_MAX, Math.max(yd, range[0] + MIN_WIDTH))]);
  };

  useEffect(() => {
    if (!draggingHandle) return;
    const move = (e) => handlePointer(e, draggingHandle);
    const up = () => setDraggingHandle(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [draggingHandle, range]);

  const minPct = ((range[0] - ABS_MIN) / (ABS_MAX - ABS_MIN)) * 100;
  const maxPct = ((range[1] - ABS_MIN) / (ABS_MAX - ABS_MIN)) * 100;

  const shapeModeDesc = (() => {
    if (player.currentTier === 3) return 'Adds club calls (one more / one less) on some shots';
    if (player.currentTier === 4) return 'Adds club, shape, or trajectory calls on some shots';
    if (player.currentTier === 5) return 'Adds club, shape, or trajectory calls — sometimes combined';
    return 'Available at Tier 3 and above';
  })();

  const warningPatterns = patterns ? patterns.filter(p => !p.informational) : [];

  return (
    <div style={{ padding: '0 22px 32px' }}>
      {/* Header */}
      <div style={{ paddingTop: 16, paddingBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="as-eyebrow">APPROACH STANDARD</div>
          <div style={{ fontSize: 22, color: 'var(--chalk)', marginTop: 6, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            Approach Precision
          </div>
        </div>
        <div className="as-tier-badge">T{tier.id} · {tier.name.split(' ')[0]}</div>
      </div>

      {/* Shape mode prompt */}
      {showShapePrompt && (
        <div style={{ background: 'rgba(232,32,42,.06)', border: '1px solid rgba(232,32,42,.4)', borderRadius: 'var(--radius-xl)', padding: '18px 18px 16px', marginBottom: 24 }} className="as-slide-up">
          <div className="as-eyebrow" style={{ marginBottom: 10 }}>READY TO BUILD ON THIS</div>
          <div style={{ fontSize: 14, color: 'var(--chalk)', lineHeight: 1.65 }}>
            You've passed your last two sessions at <strong style={{ fontWeight: 500 }}>{tier.name}</strong> with Shot Shape mode off. That's a good signal — your accuracy is repeatable at this distance.
          </div>
          <div style={{ fontSize: 13, color: 'var(--cement)', lineHeight: 1.65, marginTop: 10 }}>
            Adding Shot Shape mode now will make practice feel harder, but contextual interference research shows that performance feeling worse during practice is the mechanism that produces better transfer to the course. The brain learns more when each shot requires a fresh decision.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="as-btn-primary" style={{ padding: '12px 16px', fontSize: 13 }} onClick={() => { setShapeMode(true); onAcceptPrompt(); }}>
              Try Shot Shape Mode
            </button>
            <button className="as-btn-outline" style={{ padding: '11px 16px', fontSize: 13 }} onClick={onDismissPrompt}>
              Not yet
            </button>
          </div>
        </div>
      )}

      {/* Shot count */}
      <div style={{ marginBottom: 28 }}>
        <div className="as-eyebrow-muted" style={{ marginBottom: 12 }}>SHOTS</div>
        <div className="as-shot-count-grid">
          {[{ count: 5, label: 'Quick check' }, { count: 10, label: 'Skill assess' }, { count: 15, label: 'Full assess' }].map(({ count, label }) => (
            <button key={count} className={`as-shot-count-btn${shotCount === count ? ' active' : ''}`} onClick={() => setShotCount(count)}>
              <div style={{ fontSize: 26, lineHeight: 1, color: shotCount === count ? 'white' : 'var(--chalk)', fontWeight: 500 }}>{count}</div>
              <div style={{ fontSize: 11, marginTop: 6, color: shotCount === count ? 'rgba(255,255,255,.85)' : 'var(--ash)' }}>{label}</div>
            </button>
          ))}
        </div>
        {shotCount === 5 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--bogey)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--bogey)', display: 'inline-block' }} />
            Quick check sessions don't count toward streaks
          </div>
        )}
      </div>

      {/* Distance range */}
      <div style={{ marginBottom: 28 }}>
        <div className="as-eyebrow-muted" style={{ marginBottom: 12 }}>DISTANCE RANGE</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div>
            <span style={{ fontSize: 32, color: 'var(--chalk)', fontWeight: 500, fontFamily: 'var(--font-body)' }}>{range[0]}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)', marginLeft: 4, fontSize: 11 }}>yd</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)', fontSize: 10, letterSpacing: '0.2em' }}>TO</span>
          <div>
            <span style={{ fontSize: 32, color: 'var(--chalk)', fontWeight: 500, fontFamily: 'var(--font-body)' }}>{range[1]}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)', marginLeft: 4, fontSize: 11 }}>yd</span>
          </div>
        </div>

        <div ref={trackRef} className="as-range-track" style={{ marginTop: 24, marginBottom: 16 }}>
          <div className="as-range-fill" style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }} />
          <div className="as-range-handle" style={{ left: `${minPct}%` }}
            onMouseDown={(e) => { e.preventDefault(); setDraggingHandle('min'); }}
            onTouchStart={(e) => { e.preventDefault(); setDraggingHandle('min'); }} />
          <div className="as-range-handle" style={{ left: `${maxPct}%` }}
            onMouseDown={(e) => { e.preventDefault(); setDraggingHandle('max'); }}
            onTouchStart={(e) => { e.preventDefault(); setDraggingHandle('max'); }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--pitch)', letterSpacing: '0.15em' }}>
          {[125, 150, 175, 200, 210].map(n => <span key={n}>{n}</span>)}
        </div>
      </div>

      {/* Shot Shape mode toggle */}
      <div style={{ marginBottom: 24 }}>
        <div className="as-eyebrow-muted" style={{ marginBottom: 12 }}>SHOT SHAPE MODE</div>
        <button
          onClick={() => ciAvailable && setShapeMode(!shapeMode)}
          disabled={!ciAvailable}
          style={{ width: '100%', background: shapeMode ? 'rgba(232,32,42,.08)' : 'var(--shadow)', border: shapeMode ? '1px solid var(--scarlet)' : '1px solid rgba(255,255,255,.06)', borderRadius: 'var(--radius-xl)', padding: '14px 16px', textAlign: 'left', cursor: ciAvailable ? 'pointer' : 'not-allowed', opacity: ciAvailable ? 1 : 0.6, fontFamily: 'var(--font-body)', transition: 'all var(--transition-fast)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, color: 'var(--chalk)', fontWeight: 500 }}>
                {shapeMode ? 'On' : 'Off'}
                {shapeMode && ciAvailable && (
                  <span style={{ fontSize: 11, color: 'var(--scarlet)', marginLeft: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}>
                    ~{Math.round(activationRate * 100)}% OF SHOTS
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--cement)', marginTop: 4, lineHeight: 1.5 }}>
                {ciAvailable ? shapeModeDesc : 'Available at Tier 3 and above'}
              </div>
            </div>
            <div className="as-toggle-track" style={{ background: shapeMode ? 'var(--scarlet)' : 'var(--pitch)', marginLeft: 12 }}>
              <div className="as-toggle-thumb" style={{ left: shapeMode ? 20 : 2 }} />
            </div>
          </div>
        </button>
      </div>

      {/* Session summary */}
      <div className="as-card" style={{ marginBottom: 24 }}>
        <div className="as-eyebrow-muted" style={{ marginBottom: 10 }}>SESSION</div>
        <div style={{ fontSize: 14, color: 'var(--cement)', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--chalk)', fontWeight: 500 }}>{shotCount} shots</span> between {range[0]} and {range[1]} yards.
          <br />
          Tier {tier.id} rings · ring at 150 yd: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--scarlet)' }}>±{ringFor(150, tier.id)} yd</span>
          {shapeMode && ciAvailable && (
            <><br /><span style={{ color: 'var(--scarlet)' }}>Shot Shape mode on</span> · ~{Math.round(shotCount * activationRate)} shots will have a constraint</>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="as-btn-primary" onClick={() => onStart(shotCount, range, shapeMode && ciAvailable)}>
          Start Drill
        </button>
        <button
          className="as-btn-outline"
          onClick={onHistory}
          style={warningPatterns.length > 0 ? { borderColor: 'var(--scarlet)', color: 'var(--chalk)' } : undefined}
        >
          View history
          {warningPatterns.length > 0 && (
            <span style={{ marginLeft: 10, padding: '2px 8px', background: 'var(--scarlet)', color: 'white', borderRadius: 999, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
              {warningPatterns.length} pattern{warningPatterns.length === 1 ? '' : 's'}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function ShotCard({ session, onLogShot, onAbort }) {
  const [showConfirm, setShowConfirm] = useState(null);
  const [showAbortModal, setShowAbortModal] = useState(false);

  const idx = session.outcomes.length;
  const total = session.shotCount;
  const insideCount = session.outcomes.filter(o => o === 'INSIDE').length;
  const currentYd = session.yardages[idx];
  const carry = carryFor(currentYd);
  const ring = ringFor(currentYd, session.tier);
  const thresholds = thresholdsFor(total);
  const ciCall = session.ciAssignments ? session.ciAssignments[idx] : null;

  const handleOutcome = (outcome) => {
    if (showConfirm) return;
    setShowConfirm(outcome);
    setTimeout(() => { onLogShot(outcome); setShowConfirm(null); }, 700);
  };

  const failEnd = (thresholds.pass - 1) / total * 100;
  const passEnd = (thresholds.elite - 1) / total * 100;
  const currentPct = idx === 0 ? 0 : (insideCount / total) * 100;
  const projectedMaxPct = ((insideCount + (total - idx)) / total) * 100;

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 200px)' }}>
      {/* Header */}
      <div style={{ padding: '12px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => setShowAbortModal(true)} style={{ background: 'none', border: 'none', color: 'var(--ash)', cursor: 'pointer', padding: 4, fontSize: 22, fontFamily: 'var(--font-body)' }}>×</button>
        <div style={{ textAlign: 'center' }}>
          <div className="as-eyebrow-muted" style={{ marginBottom: 2 }}>SHOT</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--chalk)' }}>
            {idx + 1} <span style={{ color: 'var(--pitch)' }}>/</span> {total}
          </div>
        </div>
        <div style={{ width: 24 }} />
      </div>

      {/* Progress band */}
      <div style={{ padding: '0 22px', marginBottom: 24 }}>
        <div className="as-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--ash)' }}>
              <strong style={{ color: 'var(--chalk)', fontWeight: 500 }}>{insideCount}/{idx}</strong> inside so far
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--chalk)' }}>{insideCount}</span>
          </div>
          <div className="as-progress-band" style={{ marginBottom: 8 }}>
            <div style={{ position: 'absolute', left: 0, width: `${failEnd}%`, height: '100%', background: 'rgba(232,32,42,.18)' }} />
            <div style={{ position: 'absolute', left: `${failEnd}%`, width: `${passEnd - failEnd}%`, height: '100%', background: 'rgba(196,191,184,.18)' }} />
            <div style={{ position: 'absolute', left: `${passEnd}%`, right: 0, height: '100%', background: 'rgba(232,32,42,.22)' }} />
            <div style={{ position: 'absolute', left: 0, width: `${currentPct}%`, height: '100%', background: 'var(--scarlet)' }} />
            <div style={{ position: 'absolute', left: `${currentPct}%`, width: `${projectedMaxPct - currentPct}%`, height: '100%', background: 'rgba(232,32,42,.4)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ash)', letterSpacing: '0.1em' }}>
            <span>FAIL: 0–{thresholds.pass - 1}</span>
            <span>PASS: {thresholds.pass}–{thresholds.elite - 1}</span>
            <span>ELITE: {thresholds.elite}+</span>
          </div>
        </div>
      </div>

      {/* Target card */}
      <div style={{ padding: '0 22px', marginBottom: 24 }}>
        <div className="as-card-raised" style={{ padding: '24px 24px 28px', textAlign: 'center' }} key={idx}>
          {ciCall && (
            <div className="as-ci-banner">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,255,255,.75)', marginBottom: 4 }}>SHOT SHAPE CALL</div>
              <div style={{ fontSize: 18, fontWeight: 500, fontFamily: 'var(--font-body)', color: 'white' }}>{ciCall.join(' · ')}</div>
            </div>
          )}

          <div style={{ fontSize: 88, lineHeight: 0.9, color: 'var(--chalk)', letterSpacing: '-0.03em', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
            {currentYd}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', marginTop: 8, letterSpacing: '0.25em' }}>YARDS</div>

          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '20px 0' }} />

          <div className="as-eyebrow-muted" style={{ marginBottom: 14 }}>TO SCORE A HIT</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 28, alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 28, color: 'var(--chalk)', fontWeight: 500, fontFamily: 'var(--font-body)' }}>±{carry}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ash)', marginTop: 4, letterSpacing: '0.2em' }}>YD CARRY</div>
            </div>
            <div style={{ fontSize: 18, color: 'var(--pitch)', fontWeight: 300 }}>+</div>
            <div>
              <div style={{ fontSize: 28, color: 'var(--chalk)', fontWeight: 500, fontFamily: 'var(--font-body)' }}>±{ring}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ash)', marginTop: 4, letterSpacing: '0.2em' }}>YD LATERAL</div>
            </div>
          </div>

          <div style={{ marginTop: 22, padding: '12px 16px', background: 'rgba(232,32,42,.06)', border: '1px solid rgba(232,32,42,.18)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--cement)', lineHeight: 1.6 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--scarlet)', letterSpacing: '0.2em', marginBottom: 4 }}>ESTIMATE</div>
            Carry between <span style={{ color: 'var(--chalk)', fontWeight: 500 }}>{currentYd - carry}–{currentYd + carry} yd</span>
            <br />
            Lateral within <span style={{ color: 'var(--chalk)', fontWeight: 500 }}>~{ring} yards left or right of pin</span>
          </div>
        </div>
      </div>

      {/* Outcome buttons */}
      <div style={{ padding: '0 22px', marginBottom: 18 }}>
        <div className="as-outcome-grid">
          <button
            className="as-outcome-btn"
            onClick={() => handleOutcome('OUTSIDE')}
            disabled={showConfirm !== null}
            style={{ background: 'rgba(232,32,42,.08)', border: '1px solid rgba(232,32,42,.4)', color: 'var(--scarlet-glow)', cursor: showConfirm ? 'default' : 'pointer' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(232,32,42,.18)', border: '1.5px solid var(--scarlet-glow)', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--scarlet-glow)' }}>×</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Outside</div>
          </button>
          <button
            className="as-outcome-btn"
            onClick={() => handleOutcome('INSIDE')}
            disabled={showConfirm !== null}
            style={{ background: 'rgba(0,192,122,.08)', border: '1px solid rgba(0,192,122,.45)', color: 'var(--under)', cursor: showConfirm ? 'default' : 'pointer' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,192,122,.18)', border: '1.5px solid var(--under)', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'var(--under)' }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Inside</div>
          </button>
        </div>
      </div>

      {/* Shot tracker dots */}
      <div style={{ padding: '0 22px 24px' }}>
        <div className="as-dots">
          {Array.from({ length: total }).map((_, i) => {
            const isCurrent = i === idx;
            const outcome = session.outcomes[i];
            const dotSize = total === 15 ? 22 : 26;
            let bg = 'var(--pitch)', color = 'var(--ash)', border = '1px solid rgba(255,255,255,.1)';
            if (outcome === 'INSIDE')  { bg = 'rgba(0,192,122,.15)';  color = 'var(--under)'; border = '1px solid var(--under)'; }
            if (outcome === 'OUTSIDE') { bg = 'rgba(232,32,42,.18)';  color = 'var(--scarlet-glow)'; border = '1px solid var(--scarlet-dim)'; }
            return (
              <div key={i} className="as-dot" style={{ width: dotSize, height: dotSize, background: bg, border, color, outline: isCurrent ? '2px solid var(--scarlet)' : 'none', outlineOffset: 2 }}>
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation overlay */}
      {showConfirm && (
        <div className="as-overlay" style={{ background: 'rgba(8,8,8,.92)' }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: showConfirm === 'INSIDE' ? 'rgba(0,192,122,.2)' : 'rgba(232,32,42,.2)', border: `2px solid ${showConfirm === 'INSIDE' ? 'var(--under)' : 'var(--scarlet-glow)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, color: showConfirm === 'INSIDE' ? 'var(--under)' : 'var(--scarlet-glow)', fontWeight: 700, marginBottom: 18 }}>
            {showConfirm === 'INSIDE' ? '✓' : '×'}
          </div>
          <div style={{ fontSize: 36, color: showConfirm === 'INSIDE' ? 'var(--under)' : 'var(--scarlet-glow)', letterSpacing: '-0.01em', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
            {showConfirm === 'INSIDE' ? 'Inside' : 'Outside'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', marginTop: 12, letterSpacing: '0.2em' }}>
            {insideCount + (showConfirm === 'INSIDE' ? 1 : 0)} of {idx + 1} inside
          </div>
        </div>
      )}

      {/* Abort modal */}
      {showAbortModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, zIndex: 20 }}>
          <div style={{ background: 'var(--shadow)', padding: 24, maxWidth: 320, width: '100%', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ fontSize: 22, color: 'var(--chalk)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>End session?</div>
            <div style={{ color: 'var(--ash)', fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>This session will be discarded and won't count toward your streak.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button className="as-btn-outline" style={{ flex: 1 }} onClick={() => setShowAbortModal(false)}>Keep going</button>
              <button className="as-btn-primary" style={{ flex: 1 }} onClick={onAbort}>End</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionResult({ session, movement, streakStatus, onAnother, onHistory }) {
  const insideCount = session.outcomes.filter(o => o === 'INSIDE').length;
  const result = resultFor(insideCount, session.shotCount);
  const tier = TIERS.find(t => t.id === session.tier);

  const resultConfig = {
    ELITE: { bgFrom: 'var(--scarlet)', bgTo: 'var(--scarlet-glow)', textColor: 'white', subColor: 'rgba(255,255,255,.85)', label: 'Elite',   tagline: 'Above tour standard for this tier', icon: '★' },
    PASS:  { bgFrom: 'var(--under)',   bgTo: '#00D080',              textColor: 'white', subColor: 'rgba(255,255,255,.9)',  label: 'Pass',    tagline: 'Performed at the standard of this tier', icon: '✓' },
    FAIL:  { bgFrom: null,             bgTo: null,                   textColor: 'var(--chalk)', subColor: 'var(--ash)', label: 'Fail', tagline: 'Below the standard of this tier', icon: '×' },
  }[result];

  const getBanner = () => {
    if (!movement) return null;
    if (movement.movement === 'PROMOTE' || movement.movement === 'EXPRESS_PROMOTE') {
      const newTier = TIERS.find(t => t.id === movement.toTier);
      return { type: 'promote', title: 'Promoted', text: `Tier ${newTier.id} — ${newTier.name}`, sub: movement.movement === 'EXPRESS_PROMOTE' ? 'Express advance · 2 Elite sessions' : 'Standard advance · 3-Pass streak' };
    }
    if (movement.movement === 'REGRESS') {
      const newTier = TIERS.find(t => t.id === movement.toTier);
      return { type: 'regress', title: 'Returned', text: `Tier ${newTier.id} — ${newTier.name}`, sub: 'Rebuilding the foundation · 1 Pass restores' };
    }
    if (movement.movement === 'RE_PROMOTE') {
      const newTier = TIERS.find(t => t.id === movement.toTier);
      return { type: 'promote', title: 'Restored', text: `Tier ${newTier.id} — ${newTier.name}`, sub: 'Re-promoted to your prior tier' };
    }
    return null;
  };

  const banner = getBanner();

  return (
    <div className="as-slide-up">
      {/* Result hero */}
      <div
        className="as-result-hero"
        style={{
          background: result === 'FAIL' ? 'var(--shadow)' : `linear-gradient(135deg, ${resultConfig.bgFrom} 0%, ${resultConfig.bgTo} 100%)`,
          borderTop: result === 'FAIL' ? '2px solid var(--scarlet-dim)' : 'none',
          borderBottom: result === 'FAIL' ? '2px solid var(--scarlet-dim)' : 'none',
        }}
      >
        {result === 'FAIL' && (
          <div style={{ position: 'absolute', top: 12, right: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--scarlet-dim)', letterSpacing: '0.3em' }}>SESSION RESULT</div>
        )}
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: result === 'FAIL' ? 'rgba(232,32,42,.15)' : 'rgba(255,255,255,.18)', border: `2px solid ${result === 'FAIL' ? 'var(--scarlet-dim)' : 'rgba(255,255,255,.5)'}`, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: result === 'ELITE' ? 30 : 28, color: result === 'FAIL' ? 'var(--scarlet-dim)' : 'white', fontWeight: result === 'FAIL' ? 400 : 600 }}>
          {resultConfig.icon}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 64, lineHeight: 0.95, fontWeight: 600, color: resultConfig.textColor, letterSpacing: '-0.02em', marginBottom: 8 }}>
          {resultConfig.label}
        </div>
        <div style={{ fontSize: 14, color: resultConfig.subColor, lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
          {resultConfig.tagline}
        </div>
      </div>

      {/* Score */}
      <div style={{ padding: '28px 22px 0', textAlign: 'center' }}>
        <div className="as-eyebrow-muted" style={{ marginBottom: 8 }}>SCORE</div>
        <div style={{ fontSize: 80, lineHeight: 1, color: 'var(--chalk)', letterSpacing: '-0.04em', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
          {insideCount}<span style={{ color: 'var(--pitch)', fontSize: 44 }}>/{session.shotCount}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', marginTop: 6, letterSpacing: '0.25em' }}>INSIDE</div>
      </div>

      <div style={{ textAlign: 'center', margin: '24px 0' }}>
        <div className="as-tier-badge">PLAYED AT TIER {tier.id} · {tier.name.toUpperCase()}</div>
      </div>

      <div style={{ padding: '0 22px 32px' }}>
        {banner && (
          <div style={{ padding: '18px 18px', background: banner.type === 'promote' ? 'rgba(232,32,42,.08)' : 'var(--shadow)', border: `1px solid ${banner.type === 'promote' ? 'rgba(232,32,42,.45)' : 'var(--pitch)'}`, borderRadius: 'var(--radius-xl)', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: banner.type === 'promote' ? 'var(--scarlet)' : 'var(--bogey)', letterSpacing: '0.3em', marginBottom: 8 }}>
              {banner.type === 'promote' ? '↑' : '↓'} {banner.title.toUpperCase()}
            </div>
            <div style={{ fontSize: 18, color: 'var(--chalk)', fontWeight: 500, fontFamily: 'var(--font-body)' }}>{banner.text}</div>
            <div style={{ fontSize: 12, color: 'var(--ash)', marginTop: 4 }}>{banner.sub}</div>
          </div>
        )}

        <div className="as-card" style={{ marginBottom: 24 }}>
          <div className="as-eyebrow-muted" style={{ marginBottom: 10 }}>STREAK STATUS</div>
          <div style={{ fontSize: 14, color: 'var(--chalk)', lineHeight: 1.5 }}>{streakStatus.text}</div>
          {streakStatus.type === 'pass' && (
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < streakStatus.count ? 'var(--scarlet)' : 'var(--pitch)', transition: 'background 200ms' }} />
              ))}
            </div>
          )}
          {streakStatus.type === 'elite' && (
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < streakStatus.count ? 'var(--scarlet-glow)' : 'var(--pitch)' }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 24, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', display: 'flex', justifyContent: 'space-between', letterSpacing: '0.1em' }}>
          <span>{session.shotCount} SHOTS</span>
          <span>{session.range[0]}–{session.range[1]} YD</span>
          {session.shotCount === 5 && <span style={{ color: 'var(--bogey)' }}>QUICK CHECK</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="as-btn-primary" onClick={onAnother}>Start another session</button>
          <button className="as-btn-outline" onClick={onHistory}>View history</button>
        </div>
      </div>
    </div>
  );
}

function SessionHistory({ player, sessions, patterns, onBack, onApplyPrescription }) {
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    let s = [...sessions].reverse();
    if (filter === '10') s = s.filter(x => x.shotCount === 10);
    if (filter === '15') s = s.filter(x => x.shotCount === 15);
    if (filter === '5')  s = s.filter(x => x.shotCount === 5);
    return s;
  }, [sessions, filter]);

  const tier = TIERS.find(t => t.id === player.currentTier);
  const passRate = sessions.length > 0 ? Math.round((sessions.filter(s => s.result !== 'FAIL').length / sessions.length) * 100) : 0;

  return (
    <div style={{ padding: '0 22px 32px' }}>
      <div style={{ paddingTop: 12, paddingBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--ash)', cursor: 'pointer', fontSize: 22, fontFamily: 'var(--font-body)', padding: 4 }}>‹</button>
        <div style={{ fontSize: 22, color: 'var(--chalk)', fontWeight: 500 }}>History</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 20 }}>
        {[
          { label: 'CURRENT', value: `T${tier.id}`, sub: tier.name, valueColor: 'var(--scarlet)' },
          { label: 'SESSIONS', value: sessions.length, sub: 'Total logged', valueColor: 'var(--chalk)' },
          { label: 'PASS RATE', value: `${passRate}%`, sub: 'All time', valueColor: 'var(--chalk)' },
        ].map(({ label, value, sub, valueColor }) => (
          <div key={label} className="as-card" style={{ padding: 14, borderRadius: 'var(--radius-lg)' }}>
            <div className="as-eyebrow-muted" style={{ fontSize: 9, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, color: valueColor, lineHeight: 1, fontWeight: 500, fontFamily: 'var(--font-body)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--ash)', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Patterns */}
      {patterns && patterns.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="as-eyebrow" style={{ marginBottom: 10 }}>PATTERNS DETECTED</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patterns.map((p) => {
              const isInfo = p.severity === 'info';
              return (
                <div key={p.id} style={{ background: isInfo ? 'var(--shadow)' : 'rgba(232,32,42,.06)', border: isInfo ? '1px solid rgba(255,255,255,.08)' : '1px solid rgba(232,32,42,.35)', borderRadius: 'var(--radius-xl)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isInfo ? 'var(--ash)' : 'var(--scarlet)' }} />
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.25em', color: isInfo ? 'var(--ash)' : 'var(--scarlet)' }}>
                      {isInfo ? 'INFORMATIONAL' : 'PRESCRIPTION'}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--chalk)', fontWeight: 500, marginBottom: 6 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--cement)', lineHeight: 1.55, marginBottom: p.prescription ? 10 : 0 }}>{p.finding}</div>
                  {p.prescription && (
                    <div style={{ fontSize: 13, color: 'var(--cement)', lineHeight: 1.55, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--scarlet)', letterSpacing: '0.2em', marginRight: 8 }}>NEXT</span>
                      {p.prescription}
                      {p.suggestedRange && onApplyPrescription && (
                        <button onClick={() => onApplyPrescription(p)} style={{ display: 'block', marginTop: 10, background: 'transparent', border: '1px solid var(--scarlet)', color: 'var(--scarlet)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                          Apply to next session
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tier movement chart */}
      {sessions.length > 1 && (
        <div className="as-card" style={{ marginBottom: 20, padding: 16 }}>
          <div className="as-eyebrow-muted" style={{ marginBottom: 12 }}>TIER MOVEMENT</div>
          <div style={{ position: 'relative', height: 80 }}>
            <svg width="100%" height="80" preserveAspectRatio="none" viewBox="0 0 100 80">
              {[1, 2, 3, 4, 5].map(t => (
                <line key={t} x1="0" y1={80 - t * 14} x2="100" y2={80 - t * 14} stroke="rgba(255,255,255,.04)" strokeWidth="0.3" />
              ))}
              <polyline
                points={sessions.map((s, i) => `${(i / Math.max(sessions.length - 1, 1)) * 100},${80 - s.tier * 14}`).join(' ')}
                fill="none" stroke="var(--scarlet)" strokeWidth="2" vectorEffect="non-scaling-stroke"
              />
              {sessions.map((s, i) => (
                <circle key={i} cx={(i / Math.max(sessions.length - 1, 1)) * 100} cy={80 - s.tier * 14} r="1.4"
                  fill={s.result === 'ELITE' ? 'var(--scarlet-glow)' : s.result === 'PASS' ? 'var(--cement)' : 'var(--scarlet-dim)'} />
              ))}
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ash)', marginTop: 6, display: 'flex', justifyContent: 'space-between', letterSpacing: '0.15em' }}>
            <span>OLDEST</span><span>NEWEST</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {[{ id: 'all', label: 'All' }, { id: '10', label: '10-shot' }, { id: '15', label: '15-shot' }, { id: '5', label: 'Quick' }].map(f => (
          <button key={f.id} className="as-filter-tab" onClick={() => setFilter(f.id)}
            style={{ background: filter === f.id ? 'var(--scarlet)' : 'var(--shadow)', color: filter === f.id ? 'white' : 'var(--ash)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Session list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ash)', fontSize: 13 }}>No sessions match this filter yet.</div>
        )}
        {filtered.map((s, i) => {
          const ic = s.outcomes.filter(o => o === 'INSIDE').length;
          const isQuick = s.shotCount === 5;
          const resultColor = s.result === 'ELITE' ? 'var(--scarlet)' : s.result === 'PASS' ? 'var(--under)' : 'var(--scarlet-dim)';
          return (
            <div key={s.id} className="as-card" style={{ padding: '12px 14px', borderRadius: 'var(--radius-lg)', opacity: isQuick ? 0.7 : 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 22, color: 'var(--chalk)', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
                    {ic}<span style={{ color: 'var(--pitch)', fontSize: 14 }}>/{s.shotCount}</span>
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: resultColor, letterSpacing: '0.25em' }}>{s.result}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ash)', marginTop: 4, letterSpacing: '0.1em' }}>
                  T{s.tier} · {s.range[0]}–{s.range[1]} YD · {new Date(s.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {s.shapeMode && <span style={{ color: 'var(--scarlet)', marginLeft: 8 }}>· SHAPE MODE</span>}
                </div>
                {s.movement && s.movement.movement !== 'NO_CHANGE' && (
                  <div style={{ marginTop: 4, fontSize: 11, color: s.movement.movement.includes('PROMOTE') ? 'var(--scarlet)' : 'var(--bogey)' }}>
                    {s.movement.movement === 'PROMOTE'         && `↑ Promoted to T${s.movement.toTier}`}
                    {s.movement.movement === 'EXPRESS_PROMOTE' && `↑↑ Express promoted to T${s.movement.toTier}`}
                    {s.movement.movement === 'REGRESS'         && `↓ Regressed to T${s.movement.toTier}`}
                    {s.movement.movement === 'RE_PROMOTE'      && `↺ Restored to T${s.movement.toTier}`}
                  </div>
                )}
              </div>
              {isQuick && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bogey)', letterSpacing: '0.2em' }}>QUICK</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────

export default function ApproachStandard() {
  const [player, setPlayer] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [screen, setScreen] = useState('TIER_SELECT');
  const [currentSession, setCurrentSession] = useState(null);
  const [lastMovement, setLastMovement] = useState(null);
  const [showShapePrompt, setShowShapePrompt] = useState(false);

  // Restore from localStorage on mount
  useEffect(() => {
    const savedPlayer = storage.get(LS_PLAYER);
    const savedSessions = storage.get(LS_SESSIONS);
    if (savedPlayer) {
      setPlayer(savedPlayer);
      setSessions(savedSessions || []);
      setScreen('SETUP');
    }
  }, []);

  // Persist on change
  useEffect(() => { if (player) storage.set(LS_PLAYER, player); }, [player]);
  useEffect(() => { storage.set(LS_SESSIONS, sessions); }, [sessions]);

  const handleTierSelect = (tier) => {
    const p = { id: 'player-1', createdAt: new Date().toISOString(), startingTier: tier, currentTier: tier, regressionFlag: null, lastShotCount: 10, lastRange: [125, 210], shapeMode: false };
    setPlayer(p);
    setScreen('SETUP');
  };

  const handleStartDrill = (shotCount, range, shapeMode) => {
    const yardages = generateYardages(range[0], range[1], shotCount);
    let ciAssignments = null;
    if (shapeMode && CI_AVAILABILITY[player.currentTier]) {
      const rate = activationRateFor(countShapeModePasses(player, sessions));
      ciAssignments = generateCIAssignments(shotCount, player.currentTier, rate);
    }
    const session = { id: `s-${Date.now()}`, startedAt: new Date().toISOString(), tier: player.currentTier, shotCount, range, yardages, shapeMode: shapeMode && !!CI_AVAILABILITY[player.currentTier], ciAssignments, outcomes: [] };
    setCurrentSession(session);
    setPlayer({ ...player, lastShotCount: shotCount, lastRange: range, shapeMode });
    if (showShapePrompt) {
      setShowShapePrompt(false);
      const updated = [...sessions];
      updated.filter(s => s.tier === player.currentTier && s.shotCount !== 5).slice(-2).forEach(s => { s.promptShownAfter = true; });
      setSessions(updated);
    }
    setScreen('SHOT');
  };

  const handleLogShot = (outcome) => {
    const newOutcomes = [...currentSession.outcomes, outcome];
    if (newOutcomes.length < currentSession.shotCount) {
      setCurrentSession({ ...currentSession, outcomes: newOutcomes });
      return;
    }
    const insideCount = newOutcomes.filter(o => o === 'INSIDE').length;
    const result = resultFor(insideCount, currentSession.shotCount);
    const completed = { ...currentSession, outcomes: newOutcomes, completedAt: new Date().toISOString(), insideCount, result };
    const movement = evaluatePeriodization(player, sessions, completed);
    const sessionWithMovement = { ...completed, movement };
    const newSessions = [...sessions, sessionWithMovement];
    setSessions(newSessions);

    let newPlayer = { ...player };
    if (movement.movement === 'PROMOTE' || movement.movement === 'EXPRESS_PROMOTE') {
      newPlayer.currentTier = movement.toTier;
      newPlayer.regressionFlag = null;
    } else if (movement.movement === 'REGRESS') {
      newPlayer.currentTier = movement.toTier;
      newPlayer.regressionFlag = { fromTier: movement.fromTier, setAt: new Date().toISOString() };
    } else if (movement.movement === 'RE_PROMOTE') {
      newPlayer.currentTier = movement.toTier;
      newPlayer.regressionFlag = null;
    }
    setPlayer(newPlayer);
    setLastMovement(movement);
    setCurrentSession(completed);
    setShowShapePrompt(shouldShowShapeModePrompt(newPlayer, newSessions));
    setScreen('RESULT');
  };

  const handleApplyPrescription = (pattern) => {
    if (pattern.suggestedRange) setPlayer({ ...player, lastRange: pattern.suggestedRange });
    setScreen('SETUP');
  };

  const streakStatus = useMemo(() => {
    if (!player) return { type: 'none', text: '' };
    return computeStreakStatus(player, sessions);
  }, [player, sessions]);

  const patterns = useMemo(() => {
    if (!player) return [];
    return detectPatterns(player, sessions);
  }, [player, sessions]);

  return (
    <div className="as-wrapper px-0">
      {screen === 'TIER_SELECT' && <TierSelection onSelect={handleTierSelect} />}
      {screen === 'SETUP' && player && (
        <DrillSetup
          player={player}
          sessions={sessions}
          patterns={patterns}
          showShapePrompt={showShapePrompt}
          onDismissPrompt={() => {
            setShowShapePrompt(false);
            const updated = [...sessions];
            updated.filter(s => s.tier === player.currentTier && s.shotCount !== 5).slice(-2).forEach(s => { s.promptShownAfter = true; });
            setSessions(updated);
          }}
          onAcceptPrompt={() => setShowShapePrompt(false)}
          onStart={handleStartDrill}
          onHistory={() => setScreen('HISTORY')}
        />
      )}
      {screen === 'SHOT' && currentSession && (
        <ShotCard
          session={currentSession}
          onLogShot={handleLogShot}
          onAbort={() => { setCurrentSession(null); setScreen('SETUP'); }}
        />
      )}
      {screen === 'RESULT' && currentSession && (
        <SessionResult
          session={currentSession}
          movement={lastMovement}
          streakStatus={streakStatus}
          onAnother={() => { setCurrentSession(null); setLastMovement(null); setScreen('SETUP'); }}
          onHistory={() => setScreen('HISTORY')}
        />
      )}
      {screen === 'HISTORY' && player && (
        <SessionHistory
          player={player}
          sessions={sessions}
          patterns={patterns}
          onBack={() => setScreen('SETUP')}
          onApplyPrescription={handleApplyPrescription}
        />
      )}
    </div>
  );
}
