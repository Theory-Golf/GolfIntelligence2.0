// @ts-nocheck
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

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
    <div className="animate-slide-up px-[22px] pb-8">
      <div className="pt-4 pb-7">
        <p className="eyebrow">FIRST LAUNCH</p>
        <h2 className="font-body text-[28px] font-medium leading-[1.2] text-foreground mt-3.5">
          Choose your starting tier
        </h2>
        <p className="font-body text-sm font-light text-muted-foreground leading-relaxed mt-3">
          Pick where you want to begin. The system adjusts as you go — three Pass sessions advances you, two Fails pulls you back.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {TIERS.map((tier) => {
          const active = picked === tier.id;
          const ring = ringFor(150, tier.id);
          return (
            <button
              key={tier.id}
              className={cn(
                'bg-card border border-border p-4 text-left cursor-pointer transition-colors hover:bg-surface w-full font-body',
                active && 'bg-surface border-primary'
              )}
              onClick={() => setPicked(tier.id)}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-baseline gap-3">
                  <span className={cn('font-mono text-[11px] tracking-[0.15em] transition-colors', active ? 'text-primary' : 'text-muted-foreground')}>
                    T{tier.id}
                  </span>
                  <span className="text-[17px] text-foreground font-medium">{tier.name}</span>
                </div>
                <span className={cn('font-mono text-[11px] transition-colors', active ? 'text-primary' : 'text-muted-foreground')}>
                  ±{ring} yd
                </span>
              </div>
              <div className="flex justify-between mt-2 gap-3 items-center">
                <span className="text-xs text-muted-foreground">{tier.handicap}</span>
                <span className="text-xs text-muted-foreground text-right">{tier.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="font-mono text-[11px] text-muted-foreground text-center leading-relaxed mt-5">
        Ring at 150 yd shown · scales with distance
      </p>
      <div className="mt-6">
        <button
          className="w-full py-4 bg-primary text-white font-body font-medium text-[15px] tracking-[0.02em] transition-colors hover:bg-scarlet-dim disabled:bg-border disabled:text-muted-foreground disabled:cursor-not-allowed"
          disabled={picked === null}
          onClick={() => onSelect(picked)}
        >
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="px-[22px] pb-8">
      {/* Header */}
      <div className="pt-4 pb-7 flex justify-between items-center">
        <div>
          <p className="eyebrow">APPROACH STANDARD</p>
          <p className="font-body text-[22px] text-foreground font-medium mt-1.5">Approach Precision</p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 bg-primary/5 border border-primary/30 rounded-full font-mono text-[9px] tracking-[0.2em] uppercase text-primary">
          T{tier.id} · {tier.name.split(' ')[0]}
        </span>
      </div>

      {/* Shape mode prompt */}
      {showShapePrompt && (
        <div className="animate-slide-up bg-primary/8 border border-primary/40 p-[18px] mb-6">
          <p className="eyebrow mb-2.5">READY TO BUILD ON THIS</p>
          <p className="font-body text-sm text-foreground leading-[1.65]">
            You&apos;ve passed your last two sessions at <strong className="font-medium">{tier.name}</strong> with Shot Shape mode off. That&apos;s a good signal — your accuracy is repeatable at this distance.
          </p>
          <p className="font-body text-[13px] text-muted-foreground leading-[1.65] mt-2.5">
            Adding Shot Shape mode now will make practice feel harder, but contextual interference research shows that performance feeling worse during practice is the mechanism that produces better transfer to the course. The brain learns more when each shot requires a fresh decision.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              className="flex-1 py-3 bg-primary text-white font-body font-medium text-[13px] tracking-[0.02em] transition-colors hover:bg-scarlet-dim"
              onClick={() => { setShapeMode(true); onAcceptPrompt(); }}
            >
              Try Shot Shape Mode
            </button>
            <button
              className="flex-1 py-[11px] bg-transparent text-muted-foreground border border-border font-body font-medium text-[13px] transition-colors hover:border-muted-foreground hover:text-foreground"
              onClick={onDismissPrompt}
            >
              Not yet
            </button>
          </div>
        </div>
      )}

      {/* Shot count */}
      <div className="mb-7">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">SHOTS</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[{ count: 5, label: 'Quick check' }, { count: 10, label: 'Skill assess' }, { count: 15, label: 'Full assess' }].map(({ count, label }) => (
            <button
              key={count}
              className={cn(
                'border py-3.5 px-2 cursor-pointer transition-colors text-center font-body',
                count === shotCount ? 'bg-primary border-transparent' : 'bg-card border-border'
              )}
              onClick={() => setShotCount(count)}
            >
              <div className={cn('text-[26px] leading-none font-medium', count === shotCount ? 'text-white' : 'text-foreground')}>{count}</div>
              <div className={cn('text-[11px] mt-1.5', count === shotCount ? 'text-white/85' : 'text-muted-foreground')}>{label}</div>
            </button>
          ))}
        </div>
        {shotCount === 5 && (
          <div className="flex items-center gap-2 mt-2.5 text-xs text-bogey">
            <span className="size-1 rounded-full bg-bogey flex-shrink-0" />
            Quick check sessions don&apos;t count toward streaks
          </div>
        )}
      </div>

      {/* Distance range */}
      <div className="mb-7">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">DISTANCE RANGE</p>
        <div className="flex justify-between items-baseline mb-1">
          <div>
            <span className="text-[32px] text-foreground font-medium font-body">{range[0]}</span>
            <span className="font-mono text-muted-foreground ml-1 text-[11px]">yd</span>
          </div>
          <span className="font-mono text-muted-foreground text-[10px] tracking-[0.2em]">TO</span>
          <div>
            <span className="text-[32px] text-foreground font-medium font-body">{range[1]}</span>
            <span className="font-mono text-muted-foreground ml-1 text-[11px]">yd</span>
          </div>
        </div>

        <div ref={trackRef} className="relative h-1 bg-border cursor-pointer mt-6 mb-4">
          <div className="absolute top-0 h-full bg-primary" style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }} />
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-foreground border-[3px] border-primary cursor-grab active:scale-110 touch-none shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform"
            style={{ left: `${minPct}%` }}
            onMouseDown={(e) => { e.preventDefault(); setDraggingHandle('min'); }}
            onTouchStart={(e) => { e.preventDefault(); setDraggingHandle('min'); }}
          />
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-foreground border-[3px] border-primary cursor-grab active:scale-110 touch-none shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform"
            style={{ left: `${maxPct}%` }}
            onMouseDown={(e) => { e.preventDefault(); setDraggingHandle('max'); }}
            onTouchStart={(e) => { e.preventDefault(); setDraggingHandle('max'); }}
          />
        </div>

        <div className="flex justify-between font-mono text-[9px] text-border tracking-[0.15em]">
          {[125, 150, 175, 200, 210].map(n => <span key={n}>{n}</span>)}
        </div>
      </div>

      {/* Shot Shape mode toggle */}
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">SHOT SHAPE MODE</p>
        <button
          className={cn(
            'w-full border p-3.5 text-left transition-colors font-body',
            shapeMode ? 'bg-primary/8 border-primary' : 'bg-card border-border',
            !ciAvailable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          )}
          onClick={() => ciAvailable && setShapeMode(!shapeMode)}
          disabled={!ciAvailable}
        >
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="text-[15px] text-foreground font-medium">
                {shapeMode ? 'On' : 'Off'}
                {shapeMode && ciAvailable && (
                  <span className="font-mono text-[11px] text-primary ml-2 tracking-[0.15em]">
                    ~{Math.round(activationRate * 100)}% OF SHOTS
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {ciAvailable ? shapeModeDesc : 'Available at Tier 3 and above'}
              </div>
            </div>
            <div className={cn('w-10 h-[22px] rounded-full relative transition-colors flex-shrink-0 ml-3', shapeMode ? 'bg-primary' : 'bg-border')}>
              <div className={cn('absolute top-[2px] size-[18px] rounded-full bg-white shadow-sm transition-[left] duration-[140ms]', shapeMode ? 'left-5' : 'left-[2px]')} />
            </div>
          </div>
        </button>
      </div>

      {/* Session summary */}
      <div className="bg-card border border-border p-5 mb-6">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2.5">SESSION</p>
        <p className="font-body text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground font-medium">{shotCount} shots</strong> between {range[0]} and {range[1]} yards.
          <br />
          Tier {tier.id} rings · ring at 150 yd:{' '}
          <span className="font-mono text-primary">±{ringFor(150, tier.id)} yd</span>
          {shapeMode && ciAvailable && (
            <><br /><span className="text-primary">Shot Shape mode on</span> · ~{Math.round(shotCount * activationRate)} shots will have a constraint</>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          className="w-full py-4 bg-primary text-white font-body font-medium text-[15px] tracking-[0.02em] transition-colors hover:bg-scarlet-dim"
          onClick={() => onStart(shotCount, range, shapeMode && ciAvailable)}
        >
          Start Drill
        </button>
        <button
          className={cn(
            'w-full py-3.5 bg-transparent font-body font-medium text-sm tracking-[0.02em] transition-colors flex items-center justify-center gap-2 border',
            warningPatterns.length > 0
              ? 'border-primary text-foreground hover:bg-primary/8'
              : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
          )}
          onClick={onHistory}
        >
          View history
          {warningPatterns.length > 0 && (
            <span className="px-2 py-0.5 bg-primary text-white rounded-full text-[11px] font-semibold font-mono tracking-[0.05em]">
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
  const dotSize = total === 15 ? 22 : 26;

  return (
    <div className="relative">
      {/* Header */}
      <div className="px-[22px] py-3 flex justify-between items-center">
        <button
          className="bg-transparent border-none text-muted-foreground cursor-pointer p-1 text-[22px] font-body hover:text-foreground transition-colors"
          onClick={() => setShowAbortModal(true)}
        >
          ×
        </button>
        <div className="text-center">
          <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-0.5">SHOT</div>
          <div className="font-display font-extrabold text-[18px] text-foreground">
            {idx + 1} <span className="text-border">/</span> {total}
          </div>
        </div>
        <div className="w-6" aria-hidden />
      </div>

      {/* Progress band */}
      <div className="px-[22px] mb-6">
        <div className="bg-card border border-border p-3.5">
          <div className="flex justify-between items-baseline mb-2.5">
            <span className="text-xs text-muted-foreground">
              <strong className="text-foreground font-medium">{insideCount}/{idx}</strong> inside so far
            </span>
            <span className="font-display font-extrabold text-[22px] text-foreground">{insideCount}</span>
          </div>
          <div className="relative h-[6px] bg-border mb-2 overflow-hidden">
            <div className="absolute top-0 h-full bg-primary/18" style={{ width: `${failEnd}%` }} />
            <div className="absolute top-0 h-full bg-muted-foreground/18" style={{ left: `${failEnd}%`, width: `${passEnd - failEnd}%` }} />
            <div className="absolute top-0 right-0 h-full bg-primary/22" style={{ left: `${passEnd}%` }} />
            <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${currentPct}%` }} />
            <div className="absolute top-0 h-full bg-primary/40" style={{ left: `${currentPct}%`, width: `${projectedMaxPct - currentPct}%` }} />
          </div>
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground tracking-[0.1em]">
            <span>FAIL: 0–{thresholds.pass - 1}</span>
            <span>PASS: {thresholds.pass}–{thresholds.elite - 1}</span>
            <span>ELITE: {thresholds.elite}+</span>
          </div>
        </div>
      </div>

      {/* Target card */}
      <div className="px-[22px] mb-6" key={idx}>
        <div className="bg-surface border border-border p-6 text-center">
          {ciCall && (
            <div className="bg-primary px-4 py-2.5 -mx-6 -mt-6 mb-6 text-center">
              <div className="font-mono text-[9px] tracking-[0.3em] text-white/75 mb-1">SHOT SHAPE CALL</div>
              <div className="text-[18px] font-medium font-body text-white">{ciCall.join(' · ')}</div>
            </div>
          )}

          <div className="text-[88px] leading-[0.9] text-foreground tracking-[-0.03em] font-medium font-body">
            {currentYd}
          </div>
          <span className="block font-mono text-[11px] text-muted-foreground mt-2 tracking-[0.25em]">YARDS</span>

          <div className="h-px bg-border my-5" />

          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3.5">TO SCORE A HIT</p>
          <div className="flex justify-center gap-7 items-baseline">
            <div className="text-center">
              <div className="text-[28px] text-foreground font-medium font-body">±{carry}</div>
              <div className="font-mono text-[9px] text-muted-foreground mt-1 tracking-[0.2em]">YD CARRY</div>
            </div>
            <div className="text-[18px] text-border font-light">+</div>
            <div className="text-center">
              <div className="text-[28px] text-foreground font-medium font-body">±{ring}</div>
              <div className="font-mono text-[9px] text-muted-foreground mt-1 tracking-[0.2em]">YD LATERAL</div>
            </div>
          </div>

          <div className="mt-[22px] p-3 px-4 bg-primary/6 border border-primary/18 text-xs text-muted-foreground leading-relaxed text-left">
            <span className="block font-mono text-[9px] text-primary tracking-[0.2em] mb-1">ESTIMATE</span>
            Carry between <strong className="text-foreground font-medium">{currentYd - carry}–{currentYd + carry} yd</strong>
            <br />
            Lateral within <strong className="text-foreground font-medium">~{ring} yards left or right of pin</strong>
          </div>
        </div>
      </div>

      {/* Outcome buttons */}
      <div className="px-[22px] mb-[18px] grid grid-cols-2 gap-2">
        <button
          className="py-[22px] px-5 cursor-pointer font-body font-medium text-center border transition-transform active:scale-[0.98] disabled:cursor-default bg-primary/8 border-primary/40 text-scarlet-glow"
          onClick={() => handleOutcome('OUTSIDE')}
          disabled={showConfirm !== null}
        >
          <div className="size-9 rounded-full bg-primary/18 border-[1.5px] border-scarlet-glow mx-auto mb-2.5 flex items-center justify-center text-[20px] text-scarlet-glow">×</div>
          <div className="text-[15px]">Outside</div>
        </button>
        <button
          className="py-[22px] px-5 cursor-pointer font-body font-medium text-center border transition-transform active:scale-[0.98] disabled:cursor-default bg-under/8 border-under/45 text-under"
          onClick={() => handleOutcome('INSIDE')}
          disabled={showConfirm !== null}
        >
          <div className="size-9 rounded-full bg-under/18 border-[1.5px] border-under mx-auto mb-2.5 flex items-center justify-center text-[18px] font-semibold text-under">✓</div>
          <div className="text-[15px]">Inside</div>
        </button>
      </div>

      {/* Shot tracker dots */}
      <div className="px-[22px] pb-6 flex flex-wrap gap-1.5 justify-center">
        {Array.from({ length: total }).map((_, i) => {
          const outcome = session.outcomes[i];
          return (
            <div
              key={i}
              className={cn(
                'rounded-full flex items-center justify-center font-mono text-[10px] font-semibold border',
                outcome === 'INSIDE'
                  ? 'bg-under/15 text-under border-under'
                  : outcome === 'OUTSIDE'
                  ? 'bg-primary/18 text-scarlet-glow border-scarlet-dim'
                  : 'bg-border text-muted-foreground border-border',
                i === idx && 'outline outline-2 outline-primary outline-offset-2'
              )}
              style={{ width: dotSize, height: dotSize }}
            >
              {i + 1}
            </div>
          );
        })}
      </div>

      {/* Confirmation overlay */}
      {showConfirm && (
        <div className="absolute inset-0 bg-background/92 flex items-center justify-center flex-col z-10 animate-overlay-in">
          <div className={cn(
            'size-[84px] rounded-full flex items-center justify-center font-bold mb-[18px] border-2 text-[44px]',
            showConfirm === 'INSIDE'
              ? 'bg-under/20 border-under text-under'
              : 'bg-primary/20 border-scarlet-glow text-scarlet-glow'
          )}>
            {showConfirm === 'INSIDE' ? '✓' : '×'}
          </div>
          <div className={cn(
            'text-[36px] tracking-[-0.01em] font-medium font-body',
            showConfirm === 'INSIDE' ? 'text-under' : 'text-scarlet-glow'
          )}>
            {showConfirm === 'INSIDE' ? 'Inside' : 'Outside'}
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-3 tracking-[0.2em]">
            {insideCount + (showConfirm === 'INSIDE' ? 1 : 0)} of {idx + 1} inside
          </div>
        </div>
      )}

      {/* Abort modal */}
      {showAbortModal && (
        <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-[22px] z-20">
          <div className="bg-card p-6 max-w-[320px] w-full border border-border">
            <div className="text-[22px] text-foreground font-body font-medium">End session?</div>
            <div className="text-muted-foreground text-sm mt-2.5 leading-relaxed">
              This session will be discarded and won&apos;t count toward your streak.
            </div>
            <div className="flex gap-2 mt-6">
              <button
                className="flex-1 py-3.5 border border-border text-muted-foreground font-body font-medium text-sm transition-colors hover:text-foreground hover:border-muted-foreground"
                onClick={() => setShowAbortModal(false)}
              >
                Keep going
              </button>
              <button
                className="flex-1 py-4 bg-primary text-white font-body font-medium text-[15px] transition-colors hover:bg-scarlet-dim"
                onClick={onAbort}
              >
                End
              </button>
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
    ELITE: { label: 'Elite',  tagline: 'Above tour standard for this tier',      icon: '★' },
    PASS:  { label: 'Pass',   tagline: 'Performed at the standard of this tier', icon: '✓' },
    FAIL:  { label: 'Fail',   tagline: 'Below the standard of this tier',        icon: '×' },
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
    <div className="animate-slide-up">
      {/* Result hero — full-bleed within the component's max-width container */}
      <div className={cn(
        'px-[22px] pt-9 pb-8 text-center relative overflow-hidden',
        result === 'ELITE' ? 'bg-gradient-to-br from-primary to-scarlet-glow'
          : result === 'PASS' ? 'bg-gradient-to-br from-under to-[#00D080]'
          : 'bg-card border-t-2 border-b-2 border-primary/30'
      )}>
        {result === 'FAIL' && (
          <div className="absolute top-3 right-4 font-mono text-[10px] text-primary/30 tracking-[0.3em]">
            SESSION RESULT
          </div>
        )}
        <div className={cn(
          'size-16 rounded-full mx-auto mb-[18px] flex items-center justify-center border-2',
          result === 'FAIL'
            ? 'bg-primary/15 border-primary/30 text-primary/30 text-[28px] font-normal'
            : 'bg-white/18 border-white/50 text-white font-semibold',
          result === 'ELITE' ? 'text-[30px]' : result !== 'FAIL' ? 'text-[28px]' : ''
        )}>
          {resultConfig.icon}
        </div>
        <div className={cn(
          'font-body text-[64px] leading-[0.95] font-semibold tracking-[-0.02em] mb-2',
          result === 'FAIL' ? 'text-foreground' : 'text-white'
        )}>
          {resultConfig.label}
        </div>
        <div className={cn(
          'text-sm leading-relaxed max-w-[280px] mx-auto',
          result === 'FAIL' ? 'text-muted-foreground' : 'text-white/85'
        )}>
          {resultConfig.tagline}
        </div>
      </div>

      {/* Score */}
      <div className="pt-7 text-center">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">SCORE</p>
        <div className="text-[80px] leading-none text-foreground tracking-[-0.04em] font-medium font-body">
          {insideCount}<span className="text-border text-[44px]">/{session.shotCount}</span>
        </div>
        <span className="block font-mono text-[11px] text-muted-foreground mt-1.5 tracking-[0.25em]">INSIDE</span>
      </div>

      <div className="text-center my-6">
        <span className="inline-flex items-center px-2.5 py-1 bg-primary/5 border border-primary/30 rounded-full font-mono text-[9px] tracking-[0.2em] uppercase text-primary">
          PLAYED AT TIER {tier.id} · {tier.name.toUpperCase()}
        </span>
      </div>

      <div className="px-[22px] pb-8">
        {banner && (
          <div className={cn(
            'p-[18px] mb-4',
            banner.type === 'promote'
              ? 'bg-primary/8 border border-primary/45'
              : 'bg-card border border-border'
          )}>
            <div className={cn(
              'font-mono text-[10px] tracking-[0.3em] mb-2',
              banner.type === 'promote' ? 'text-primary' : 'text-bogey'
            )}>
              {banner.type === 'promote' ? '↑' : '↓'} {banner.title.toUpperCase()}
            </div>
            <div className="text-[18px] text-foreground font-medium font-body">{banner.text}</div>
            <div className="text-xs text-muted-foreground mt-1">{banner.sub}</div>
          </div>
        )}

        {/* Streak card */}
        <div className="bg-card border border-border p-5 mb-6">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2.5">STREAK STATUS</p>
          <div className="text-sm text-foreground leading-relaxed">{streakStatus.text}</div>
          {(streakStatus.type === 'pass' || streakStatus.type === 'elite') && (
            <div className="flex gap-1 mt-3">
              {Array.from({ length: streakStatus.type === 'elite' ? 2 : 3 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-1 rounded-sm transition-colors',
                    i < streakStatus.count
                      ? streakStatus.type === 'elite' ? 'bg-scarlet-glow' : 'bg-primary'
                      : 'bg-border'
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 font-mono text-[11px] text-muted-foreground flex justify-between tracking-[0.1em]">
          <span>{session.shotCount} SHOTS</span>
          <span>{session.range[0]}–{session.range[1]} YD</span>
          {session.shotCount === 5 && <span className="text-bogey">QUICK CHECK</span>}
        </div>

        <div className="flex flex-col gap-2">
          <button
            className="w-full py-4 bg-primary text-white font-body font-medium text-[15px] tracking-[0.02em] transition-colors hover:bg-scarlet-dim"
            onClick={onAnother}
          >
            Start another session
          </button>
          <button
            className="w-full py-3.5 bg-transparent text-muted-foreground border border-border font-body font-medium text-sm tracking-[0.02em] transition-colors hover:border-muted-foreground hover:text-foreground"
            onClick={onHistory}
          >
            View history
          </button>
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
  const passRate = sessions.length > 0
    ? Math.round((sessions.filter(s => s.result !== 'FAIL').length / sessions.length) * 100)
    : 0;

  return (
    <div className="px-[22px] pb-8">
      {/* Header */}
      <div className="pt-3 pb-5 flex items-center gap-4">
        <button
          className="bg-transparent border-none text-muted-foreground cursor-pointer text-[22px] font-body p-1 hover:text-foreground transition-colors"
          onClick={onBack}
        >
          ‹
        </button>
        <div className="text-[22px] text-foreground font-medium">History</div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-5">
        {[
          { label: 'CURRENT',   value: `T${tier.id}`,    sub: tier.name,       accent: true  },
          { label: 'SESSIONS',  value: sessions.length,  sub: 'Total logged',  accent: false },
          { label: 'PASS RATE', value: `${passRate}%`,   sub: 'All time',      accent: false },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className="bg-card border border-border p-3.5">
            <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground mb-1.5">{label}</div>
            <div className={cn('text-[22px] leading-none font-medium font-body', accent ? 'text-primary' : 'text-foreground')}>{value}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Patterns */}
      {patterns && patterns.length > 0 && (
        <div className="mb-6">
          <p className="eyebrow mb-2.5">PATTERNS DETECTED</p>
          <div className="flex flex-col gap-2">
            {patterns.map((p) => {
              const isInfo = p.severity === 'info';
              return (
                <div
                  key={p.id}
                  className={cn(
                    'border p-3.5 px-4',
                    isInfo ? 'bg-card border-border' : 'bg-primary/6 border-primary/35'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={cn('size-1.5 rounded-full flex-shrink-0', isInfo ? 'bg-muted-foreground' : 'bg-primary')} />
                    <div className={cn('font-mono text-[9px] tracking-[0.25em]', isInfo ? 'text-muted-foreground' : 'text-primary')}>
                      {isInfo ? 'INFORMATIONAL' : 'PRESCRIPTION'}
                    </div>
                  </div>
                  <div className="text-sm text-foreground font-medium mb-1.5">{p.title}</div>
                  <div className="text-[13px] text-muted-foreground leading-[1.55]">{p.finding}</div>
                  {p.prescription && (
                    <div className="text-[13px] text-muted-foreground leading-[1.55] pt-2.5 mt-2.5 border-t border-border">
                      <span className="font-mono text-[9px] text-primary tracking-[0.2em] mr-2">NEXT</span>
                      {p.prescription}
                      {p.suggestedRange && onApplyPrescription && (
                        <button
                          className="block mt-2.5 bg-transparent border border-primary text-primary px-3.5 py-2 text-xs font-body font-medium cursor-pointer transition-colors hover:bg-primary/8"
                          onClick={() => onApplyPrescription(p)}
                        >
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
        <div className="bg-card border border-border p-4 mb-5">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">TIER MOVEMENT</p>
          <div className="relative h-20">
            <svg width="100%" height="80" preserveAspectRatio="none" viewBox="0 0 100 80">
              {[1, 2, 3, 4, 5].map(t => (
                <line key={t} x1="0" y1={80 - t * 14} x2="100" y2={80 - t * 14} stroke="rgba(255,255,255,.04)" strokeWidth="0.3" />
              ))}
              <polyline
                points={sessions.map((s, i) => `${(i / Math.max(sessions.length - 1, 1)) * 100},${80 - s.tier * 14}`).join(' ')}
                fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke"
              />
              {sessions.map((s, i) => (
                <circle
                  key={i}
                  cx={(i / Math.max(sessions.length - 1, 1)) * 100}
                  cy={80 - s.tier * 14}
                  r="1.4"
                  fill={s.result === 'ELITE' ? 'var(--scarlet-glow)' : s.result === 'PASS' ? 'var(--cement)' : 'var(--scarlet-dim)'}
                />
              ))}
            </svg>
          </div>
          <div className="font-mono text-[9px] text-muted-foreground mt-1.5 flex justify-between tracking-[0.15em]">
            <span>OLDEST</span><span>NEWEST</span>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {[{ id: 'all', label: 'All' }, { id: '10', label: '10-shot' }, { id: '15', label: '15-shot' }, { id: '5', label: 'Quick' }].map(f => (
          <button
            key={f.id}
            className={cn(
              'px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase cursor-pointer whitespace-nowrap border-none transition-colors',
              filter === f.id ? 'bg-primary text-white' : 'bg-card text-muted-foreground'
            )}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Session list */}
      <div className="flex flex-col gap-1">
        {filtered.length === 0 && (
          <div className="py-10 px-5 text-center text-muted-foreground text-[13px]">
            No sessions match this filter yet.
          </div>
        )}
        {filtered.map((s) => {
          const ic = s.outcomes.filter(o => o === 'INSIDE').length;
          const isQuick = s.shotCount === 5;
          return (
            <div
              key={s.id}
              className={cn(
                'bg-card border border-border p-3 px-3.5 flex justify-between items-center gap-2.5',
                isQuick && 'opacity-70'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-[22px] text-foreground font-medium font-body">
                    {ic}<span className="text-border text-sm">/{s.shotCount}</span>
                  </span>
                  <span className={cn(
                    'font-mono text-[10px] tracking-[0.25em]',
                    s.result === 'ELITE' ? 'text-primary' : s.result === 'PASS' ? 'text-under' : 'text-scarlet-dim'
                  )}>
                    {s.result}
                  </span>
                </div>
                <div className="font-mono text-[9px] text-muted-foreground mt-1 tracking-[0.1em]">
                  T{s.tier} · {s.range[0]}–{s.range[1]} YD · {new Date(s.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {s.shapeMode && <span className="text-primary ml-2">· SHAPE MODE</span>}
                </div>
                {s.movement && s.movement.movement !== 'NO_CHANGE' && (
                  <div className={cn('mt-1 text-[11px]', s.movement.movement.includes('PROMOTE') ? 'text-primary' : 'text-bogey')}>
                    {s.movement.movement === 'PROMOTE'         && `↑ Promoted to T${s.movement.toTier}`}
                    {s.movement.movement === 'EXPRESS_PROMOTE' && `↑↑ Express promoted to T${s.movement.toTier}`}
                    {s.movement.movement === 'REGRESS'         && `↓ Regressed to T${s.movement.toTier}`}
                    {s.movement.movement === 'RE_PROMOTE'      && `↺ Restored to T${s.movement.toTier}`}
                  </div>
                )}
              </div>
              {isQuick && <span className="font-mono text-[8px] text-bogey tracking-[0.2em]">QUICK</span>}
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
    <div className="max-w-[520px] mx-auto pb-16">
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
