// @ts-nocheck
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import {
  ToolContainer,
  Eyebrow,
  Mono,
  PrimaryButton,
  SecondaryButton,
} from '@/components/playerpath/ui';
import { LS_APPROACH_STANDARD_SESSIONS } from '@/lib/constants';
import { syncDrillSession } from '@/lib/golf/useDrillHistory';

// ── Storage helpers ──────────────────────────────────────────────
const storage = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
};

const LS_PLAYER   = 'as_player';
const LS_SESSIONS = LS_APPROACH_STANDARD_SESSIONS;

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

// ── Shared styling helpers ───────────────────────────────────────

const resultClasses = {
  ELITE: { text: 'text-sg-strong', border: 'border-sg-strong' },
  PASS:  { text: 'text-sg-gain',   border: 'border-sg-gain' },
  FAIL:  { text: 'text-sg-weak',   border: 'border-sg-weak' },
};

function TierBadge({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent border border-primary/40 font-mono text-[9px] tracking-[0.2em] uppercase text-primary whitespace-nowrap">
      {children}
    </span>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function TierSelection({ onSelect }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <Eyebrow>First Launch</Eyebrow>
        <h2 className="font-display font-extrabold text-4xl mt-2 text-foreground uppercase tracking-tight">
          Pick your <span className="italic text-primary">tier</span>
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-3 max-w-md leading-relaxed">
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
              type="button"
              onClick={() => setPicked(tier.id)}
              className={`text-left p-4 transition-colors duration-150 border-l-[3px]
                ${active
                  ? 'bg-accent border-primary border-y border-r border-y-primary border-r-primary'
                  : 'bg-surface border-border hover:border-cement'}`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-baseline gap-2">
                  <span className={`font-mono text-[10px] tracking-[0.18em] uppercase ${active ? 'text-primary' : 'text-muted-foreground'}`}>Tier {tier.id}</span>
                  <span className={`font-display text-xl font-bold uppercase tracking-tight ${active ? 'text-primary' : 'text-foreground'}`}>{tier.name}</span>
                </div>
                <span className={`font-mono text-[11px] ${active ? 'text-primary' : 'text-muted-foreground'}`}>±{ring} yd</span>
              </div>
              <p className="font-body text-xs text-muted-foreground mt-1">{tier.handicap}</p>
              <p className="font-body text-sm text-muted-foreground mt-1.5">{tier.desc}</p>
            </button>
          );
        })}
      </div>

      <Mono className="text-center">Ring at 150 yd shown · scales with distance</Mono>

      <PrimaryButton disabled={picked === null} onClick={() => onSelect(picked)}>
        Set my tier
      </PrimaryButton>
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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <Eyebrow>Session Setup</Eyebrow>
          <h2 className="font-display font-extrabold text-4xl mt-2 text-foreground uppercase tracking-tight">Ready?</h2>
        </div>
        <TierBadge>T{tier.id} · {tier.name.split(' ')[0]}</TierBadge>
      </div>

      {/* Shape mode prompt */}
      {showShapePrompt && (
        <div className="bg-accent border border-primary/40 border-l-[3px] border-l-primary p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Mono className="text-primary block mb-2.5">Ready to build on this</Mono>
          <p className="font-body text-sm text-foreground leading-relaxed">
            You&apos;ve passed your last two sessions at <span className="font-semibold">{tier.name}</span> with Shot Shape mode off. That&apos;s a good signal — your accuracy is repeatable at this distance.
          </p>
          <p className="font-body text-xs text-muted-foreground leading-relaxed mt-2.5">
            Adding Shot Shape mode now will make practice feel harder, but contextual interference research shows that performance feeling worse during practice is the mechanism that produces better transfer to the course. The brain learns more when each shot requires a fresh decision.
          </p>
          <div className="flex gap-2 mt-4">
            <PrimaryButton className="flex-1 !py-3 !text-xs" onClick={() => { setShapeMode(true); onAcceptPrompt(); }}>
              Try Shape Mode
            </PrimaryButton>
            <SecondaryButton className="flex-1 !py-[11px] !text-xs" onClick={onDismissPrompt}>
              Not yet
            </SecondaryButton>
          </div>
        </div>
      )}

      {/* Shot count */}
      <div>
        <Mono className="block mb-2.5">Shots</Mono>
        <div className="grid grid-cols-3 gap-2">
          {[{ count: 5, label: 'Quick check' }, { count: 10, label: 'Skill assess' }, { count: 15, label: 'Full assess' }].map(({ count, label }) => {
            const active = shotCount === count;
            return (
              <button
                key={count}
                type="button"
                onClick={() => setShotCount(count)}
                className={`text-center px-2 py-3.5 min-h-[64px] transition-colors duration-150
                  ${active ? 'bg-accent border border-primary' : 'bg-surface border border-border hover:border-cement'}`}
              >
                <div className={`font-display text-2xl font-bold leading-none ${active ? 'text-primary' : 'text-foreground'}`}>{count}</div>
                <div className={`font-body text-[11px] mt-1.5 ${active ? 'text-primary/80' : 'text-muted-foreground'}`}>{label}</div>
              </button>
            );
          })}
        </div>
        {shotCount === 5 && (
          <p className="font-body text-xs text-bogey mt-2.5 flex items-center gap-2">
            <span className="size-1 rounded-full bg-bogey inline-block" />
            Quick check sessions don&apos;t count toward streaks
          </p>
        )}
      </div>

      {/* Distance range */}
      <div>
        <Mono className="block mb-2.5">Distance range</Mono>
        <div className="flex justify-between items-baseline mb-1">
          <div>
            <span className="font-display text-3xl font-bold text-foreground">{range[0]}</span>
            <Mono className="ml-1">yd</Mono>
          </div>
          <Mono>to</Mono>
          <div>
            <span className="font-display text-3xl font-bold text-foreground">{range[1]}</span>
            <Mono className="ml-1">yd</Mono>
          </div>
        </div>

        <div ref={trackRef} className="relative h-1 bg-pitch cursor-pointer mt-6 mb-4">
          <div className="absolute top-0 h-full bg-primary" style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }} />
          <div
            className="absolute top-1/2 size-6 rounded-full bg-foreground border-[3px] border-primary -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing active:scale-110 touch-none shadow-md transition-transform duration-150"
            style={{ left: `${minPct}%` }}
            onMouseDown={(e) => { e.preventDefault(); setDraggingHandle('min'); }}
            onTouchStart={(e) => { e.preventDefault(); setDraggingHandle('min'); }} />
          <div
            className="absolute top-1/2 size-6 rounded-full bg-foreground border-[3px] border-primary -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing active:scale-110 touch-none shadow-md transition-transform duration-150"
            style={{ left: `${maxPct}%` }}
            onMouseDown={(e) => { e.preventDefault(); setDraggingHandle('max'); }}
            onTouchStart={(e) => { e.preventDefault(); setDraggingHandle('max'); }} />
        </div>

        <div className="flex justify-between font-mono text-[9px] tracking-[0.15em] text-muted-foreground/60">
          {[125, 150, 175, 200, 210].map(n => <span key={n}>{n}</span>)}
        </div>
      </div>

      {/* Shot Shape mode toggle */}
      <div>
        <Mono className="block mb-2.5">Shot shape mode</Mono>
        <button
          type="button"
          onClick={() => ciAvailable && setShapeMode(!shapeMode)}
          disabled={!ciAvailable}
          className={`w-full flex justify-between items-center px-4 py-3.5 bg-surface border text-left transition-colors duration-150
            ${!ciAvailable ? 'border-border opacity-60 cursor-not-allowed' : shapeMode ? 'border-primary cursor-pointer' : 'border-border hover:border-cement cursor-pointer'}`}
        >
          <div className="flex-1">
            <div className={`font-display text-base font-bold uppercase tracking-tight ${shapeMode ? 'text-primary' : 'text-foreground'}`}>
              {shapeMode ? 'On' : 'Off'}
              {shapeMode && ciAvailable && (
                <span className="font-mono text-[10px] tracking-[0.15em] text-primary ml-2 font-normal">
                  ~{Math.round(activationRate * 100)}% OF SHOTS
                </span>
              )}
            </div>
            <p className="font-body text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {ciAvailable ? shapeModeDesc : 'Available at Tier 3 and above'}
            </p>
          </div>
          <div className={`relative w-11 h-6 rounded-xl shrink-0 ml-3 transition-colors duration-200 ${shapeMode ? 'bg-primary' : 'bg-pitch'}`}>
            <div className={`absolute top-[3px] size-[18px] rounded-full bg-white transition-[left] duration-200 ${shapeMode ? 'left-[23px]' : 'left-[3px]'}`} />
          </div>
        </button>
      </div>

      {/* Session summary */}
      <div className="bg-surface border border-border border-t-[3px] border-t-primary p-5">
        <Mono className="block mb-2.5">Session</Mono>
        <p className="font-body text-sm text-muted-foreground leading-relaxed">
          <span className="text-foreground font-medium">{shotCount} shots</span> between {range[0]} and {range[1]} yards.
          <br />
          Tier {tier.id} rings · ring at 150 yd: <span className="font-mono text-primary">±{ringFor(150, tier.id)} yd</span>
          {shapeMode && ciAvailable && (
            <><br /><span className="text-primary">Shot Shape mode on</span> · ~{Math.round(shotCount * activationRate)} shots will have a constraint</>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={() => onStart(shotCount, range, shapeMode && ciAvailable)}>
          Start Drill
        </PrimaryButton>
        <SecondaryButton
          onClick={onHistory}
          className={warningPatterns.length > 0 ? '!border-primary' : ''}
        >
          View history
          {warningPatterns.length > 0 && (
            <span className="ml-2.5 px-2 py-0.5 bg-primary text-primary-foreground font-mono text-[10px] tracking-[0.05em]">
              {warningPatterns.length} pattern{warningPatterns.length === 1 ? '' : 's'}
            </span>
          )}
        </SecondaryButton>
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
    <div className="relative flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex justify-between items-center">
        <button type="button" onClick={() => setShowAbortModal(true)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="End session">
          <X className="size-5" />
        </button>
        <div className="text-center">
          <Mono className="block">Shot</Mono>
          <div className="font-display text-xl font-bold mt-0.5 text-foreground">{idx + 1} / {total}</div>
        </div>
        <div className="w-5" />
      </div>

      {/* Progress band */}
      <div className="bg-surface border border-border p-4">
        <div className="flex justify-between items-baseline mb-2.5">
          <Mono><span className="text-foreground">{insideCount}/{idx}</span> inside so far</Mono>
          <div className="font-display text-xl font-extrabold text-foreground">{insideCount}</div>
        </div>
        <div className="relative h-1.5 bg-pitch overflow-hidden mb-2">
          <div className="absolute left-0 h-full bg-sg-weak/15" style={{ width: `${failEnd}%` }} />
          <div className="absolute h-full bg-cement/15" style={{ left: `${failEnd}%`, width: `${passEnd - failEnd}%` }} />
          <div className="absolute right-0 h-full bg-sg-strong/15" style={{ left: `${passEnd}%` }} />
          <div className="absolute left-0 h-full bg-primary transition-[width] duration-300" style={{ width: `${currentPct}%` }} />
          <div className="absolute h-full bg-primary/30" style={{ left: `${currentPct}%`, width: `${projectedMaxPct - currentPct}%` }} />
        </div>
        <div className="flex justify-between font-mono text-[8px] tracking-[0.15em] uppercase text-muted-foreground">
          <span>Fail: 0–{thresholds.pass - 1}</span>
          <span>Pass: {thresholds.pass}–{thresholds.elite - 1}</span>
          <span>Elite: {thresholds.elite}+</span>
        </div>
      </div>

      {/* Target card */}
      <div className="bg-surface border border-border p-6 text-center animate-in fade-in duration-200" key={idx}>
        {ciCall && (
          <div className="-mx-6 -mt-6 mb-6 bg-primary px-4 py-2.5">
            <Mono className="block text-primary-foreground/75 mb-1">Shot shape call</Mono>
            <div className="font-display text-lg font-bold uppercase tracking-tight text-primary-foreground">{ciCall.join(' · ')}</div>
          </div>
        )}

        <div className="font-display text-[clamp(64px,18vw,88px)] font-extrabold leading-[0.9] tracking-tight text-foreground">
          {currentYd}
        </div>
        <Mono className="block mt-2 tracking-[0.25em]">Yards</Mono>

        <div className="h-px bg-border my-5" />

        <Mono className="block mb-3.5">To score a hit</Mono>
        <div className="flex justify-center gap-7 items-baseline">
          <div>
            <div className="font-display text-3xl font-bold text-foreground">±{carry}</div>
            <Mono className="block mt-1">YD Carry</Mono>
          </div>
          <div className="text-lg text-muted-foreground font-light">+</div>
          <div>
            <div className="font-display text-3xl font-bold text-foreground">±{ring}</div>
            <Mono className="block mt-1">YD Lateral</Mono>
          </div>
        </div>

        <div className="mt-5 px-4 py-3 bg-accent border border-primary/20 text-left">
          <Mono className="block text-primary mb-1">Estimate</Mono>
          <p className="font-body text-xs text-muted-foreground leading-relaxed">
            Carry between <span className="text-foreground font-medium">{currentYd - carry}–{currentYd + carry} yd</span>
            <br />
            Lateral within <span className="text-foreground font-medium">~{ring} yards left or right of pin</span>
          </p>
        </div>
      </div>

      {/* Outcome buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleOutcome('OUTSIDE')}
          disabled={showConfirm !== null}
          className="bg-surface border border-scarlet-dim text-sg-weak font-display text-base font-bold tracking-[0.16em] uppercase py-5 hover:bg-sg-weak/10 transition-colors duration-150 disabled:cursor-default"
        >
          ✕ Outside
        </button>
        <button
          type="button"
          onClick={() => handleOutcome('INSIDE')}
          disabled={showConfirm !== null}
          className="bg-surface border border-sg-gain text-sg-gain font-display text-base font-bold tracking-[0.16em] uppercase py-5 hover:bg-sg-gain/10 transition-colors duration-150 disabled:cursor-default"
        >
          ✓ Inside
        </button>
      </div>

      {/* Shot tracker dots */}
      <div className="flex flex-wrap gap-1.5 justify-center pb-2">
        {Array.from({ length: total }).map((_, i) => {
          const isCurrent = i === idx;
          const outcome = session.outcomes[i];
          let cls = 'bg-pitch border border-border text-muted-foreground';
          if (outcome === 'INSIDE')  cls = 'bg-sg-gain/15 border border-sg-gain text-sg-gain';
          if (outcome === 'OUTSIDE') cls = 'bg-sg-weak/15 border border-scarlet-dim text-sg-weak';
          return (
            <div
              key={i}
              className={`rounded-full flex items-center justify-center font-mono font-semibold
                ${total === 15 ? 'size-[22px] text-[9px]' : 'size-[26px] text-[10px]'}
                ${cls} ${isCurrent ? 'outline-2 outline-primary outline-offset-2' : ''}`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>

      {/* Confirmation overlay */}
      {showConfirm && (
        <div className="absolute inset-0 z-10 flex flex-col justify-center items-center bg-background/95 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-4">
            <div className={`size-14 rounded-full flex items-center justify-center border-2
              ${showConfirm === 'INSIDE' ? 'border-sg-gain bg-sg-gain/10' : 'border-sg-weak bg-sg-weak/10'}`}>
              <span className={`font-display text-3xl font-extrabold ${showConfirm === 'INSIDE' ? 'text-sg-gain' : 'text-sg-weak'}`}>
                {showConfirm === 'INSIDE' ? '✓' : '✕'}
              </span>
            </div>
            <span className={`font-display text-4xl font-extrabold italic uppercase ${showConfirm === 'INSIDE' ? 'text-sg-gain' : 'text-sg-weak'}`}>
              {showConfirm === 'INSIDE' ? 'Inside' : 'Outside'}
            </span>
          </div>
          <Mono className="block mt-3.5">
            {insideCount + (showConfirm === 'INSIDE' ? 1 : 0)} of {idx + 1} inside
          </Mono>
        </div>
      )}

      {/* Abort modal */}
      {showAbortModal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 p-5">
          <div className="bg-surface border border-border p-6 max-w-xs w-full">
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">End session?</h3>
            <p className="font-body text-sm text-muted-foreground mt-2.5 leading-relaxed">This session will be discarded and won&apos;t count toward your streak.</p>
            <div className="flex gap-2 mt-5">
              <SecondaryButton className="flex-1" onClick={() => setShowAbortModal(false)}>Keep going</SecondaryButton>
              <PrimaryButton className="flex-1" onClick={onAbort}>End</PrimaryButton>
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
    ELITE: { label: 'Elite', tagline: 'Above tour standard for this tier' },
    PASS:  { label: 'Pass',  tagline: 'Performed at the standard of this tier' },
    FAIL:  { label: 'Fail',  tagline: 'Below the standard of this tier' },
  }[result];
  const cfg = resultClasses[result];

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
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Eyebrow>{session.shotCount === 5 ? 'Quick check — session result' : 'Session result'}</Eyebrow>

      <div>
        <h2 className={`font-display text-6xl font-extrabold italic uppercase ${cfg.text}`}>{resultConfig.label}</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">{resultConfig.tagline}</p>
      </div>

      {/* Score block */}
      <div className="bg-surface border border-border p-5">
        <div className="flex justify-between items-baseline mb-2.5">
          <Mono>Score</Mono>
          <Mono>T{tier.id} {tier.name}{session.shapeMode ? ' · Shape' : ''}</Mono>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-display text-6xl font-extrabold ${cfg.text}`}>{insideCount}</span>
          <span className="font-display text-3xl text-muted-foreground">/{session.shotCount}</span>
        </div>
        <Mono className="block mt-2">Inside</Mono>
      </div>

      {banner && (
        <div className={`p-4 border border-l-[3px]
          ${banner.type === 'promote' ? 'bg-sg-strong/10 border-sg-strong border-l-sg-strong' : 'bg-accent border-primary border-l-primary'}`}>
          <Mono className={`block ${banner.type === 'promote' ? 'text-sg-strong' : 'text-primary'}`}>
            {banner.type === 'promote' ? '↑' : '↓'} {banner.title}
          </Mono>
          <p className="font-display text-lg font-bold uppercase tracking-tight text-foreground mt-2">{banner.text}</p>
          <p className="font-body text-xs text-muted-foreground mt-1">{banner.sub}</p>
        </div>
      )}

      <div className="bg-surface border border-border p-4">
        <Mono className="block mb-2.5">Streak status</Mono>
        <p className="font-body text-sm text-foreground">{streakStatus.text}</p>
        {streakStatus.type === 'pass' && (
          <div className="flex gap-1 mt-3">
            {[0, 1, 2].map(i => (
              <div key={i} className={`flex-1 h-1 transition-colors duration-200 ${i < streakStatus.count ? 'bg-primary' : 'bg-pitch'}`} />
            ))}
          </div>
        )}
        {streakStatus.type === 'elite' && (
          <div className="flex gap-1 mt-3">
            {[0, 1].map(i => (
              <div key={i} className={`flex-1 h-1 ${i < streakStatus.count ? 'bg-sg-strong' : 'bg-pitch'}`} />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between font-mono text-[10px] tracking-[0.1em] uppercase text-muted-foreground">
        <span>{session.shotCount} shots</span>
        <span>{session.range[0]}–{session.range[1]} yd</span>
        {session.shotCount === 5 && <span className="text-bogey">Quick check</span>}
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <PrimaryButton onClick={onAnother}>Start another session</PrimaryButton>
        <SecondaryButton onClick={onHistory}>View history</SecondaryButton>
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
    <div className="flex flex-col gap-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="size-3" /> Back
        </button>
        <Eyebrow>History</Eyebrow>
        <h2 className="font-display font-extrabold text-4xl mt-1 text-foreground uppercase tracking-tight">Sessions</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Current', value: `T${tier.id}`, sub: tier.name, valueClass: 'text-primary' },
          { label: 'Sessions', value: sessions.length, sub: 'Total logged', valueClass: 'text-foreground' },
          { label: 'Pass rate', value: `${passRate}%`, sub: 'All time', valueClass: 'text-foreground' },
        ].map(({ label, value, sub, valueClass }) => (
          <div key={label} className="bg-surface border border-border p-3.5">
            <Mono className="block mb-1.5 text-[9px]">{label}</Mono>
            <div className={`font-display text-2xl font-bold leading-none ${valueClass}`}>{value}</div>
            <p className="font-body text-[11px] text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Patterns */}
      {patterns && patterns.length > 0 && (
        <div>
          <Eyebrow className="mb-2.5">Patterns detected</Eyebrow>
          <div className="flex flex-col gap-2">
            {patterns.map((p) => {
              const isInfo = p.severity === 'info';
              return (
                <div key={p.id} className={`p-4 border border-l-[3px] ${isInfo ? 'bg-surface border-border border-l-border' : 'bg-accent border-primary/40 border-l-primary'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`size-1.5 rounded-full ${isInfo ? 'bg-muted-foreground' : 'bg-primary'}`} />
                    <Mono className={isInfo ? '' : 'text-primary'}>{isInfo ? 'Informational' : 'Prescription'}</Mono>
                  </div>
                  <h3 className="font-display text-lg font-bold uppercase tracking-tight text-foreground mb-1.5">{p.title}</h3>
                  <p className="font-body text-xs text-muted-foreground leading-relaxed">{p.finding}</p>
                  {p.prescription && (
                    <div className="font-body text-xs text-muted-foreground leading-relaxed mt-2.5 pt-2.5 border-t border-border">
                      <Mono className="text-primary mr-2">Next</Mono>
                      {p.prescription}
                      {p.suggestedRange && onApplyPrescription && (
                        <button
                          type="button"
                          onClick={() => onApplyPrescription(p)}
                          className="block mt-2.5 px-3.5 py-2 border border-primary text-primary font-mono text-[10px] tracking-[0.15em] uppercase hover:bg-primary/10 transition-colors cursor-pointer"
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
        <div className="bg-surface border border-border p-4">
          <Mono className="block mb-3">Tier movement</Mono>
          <div className="relative h-20">
            <svg width="100%" height="80" preserveAspectRatio="none" viewBox="0 0 100 80">
              {[1, 2, 3, 4, 5].map(t => (
                <line key={t} x1="0" y1={80 - t * 14} x2="100" y2={80 - t * 14} stroke="var(--border-color)" strokeWidth="0.3" />
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
          <div className="flex justify-between font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground mt-1.5">
            <span>Oldest</span><span>Newest</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: 'all', label: 'All' }, { id: '10', label: '10-shot' }, { id: '15', label: '15-shot' }, { id: '5', label: 'Quick' }].map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`min-h-[44px] px-3 whitespace-nowrap border font-mono text-[10px] tracking-[0.18em] uppercase transition-colors duration-150
              ${filter === f.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface text-muted-foreground border-border hover:border-cement'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Session list */}
      <div className="flex flex-col gap-1.5">
        {filtered.length === 0 && (
          <p className="font-body text-sm text-muted-foreground text-center py-10">No sessions match this filter yet.</p>
        )}
        {filtered.map((s) => {
          const ic = s.outcomes.filter(o => o === 'INSIDE').length;
          const isQuick = s.shotCount === 5;
          const cfg = resultClasses[s.result] || resultClasses.FAIL;
          return (
            <div key={s.id} className={`bg-surface border border-border border-l-[3px] ${cfg.border} p-3 flex justify-between items-center gap-2.5 ${isQuick ? 'opacity-70' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-display text-xl font-bold text-foreground">
                    {ic}<span className="text-xs text-muted-foreground ml-0.5">/{s.shotCount}</span>
                  </span>
                  <Mono className={cfg.text}>{s.result}</Mono>
                </div>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-muted-foreground mt-1">
                  T{s.tier} · {s.range[0]}–{s.range[1]} YD · {new Date(s.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {s.shapeMode && <span className="text-primary ml-2">· Shape mode</span>}
                </p>
                {s.movement && s.movement.movement !== 'NO_CHANGE' && (
                  <p className={`font-body text-[11px] mt-1 ${s.movement.movement.includes('PROMOTE') ? 'text-sg-strong' : 'text-bogey'}`}>
                    {s.movement.movement === 'PROMOTE'         && `↑ Promoted to T${s.movement.toTier}`}
                    {s.movement.movement === 'EXPRESS_PROMOTE' && `↑↑ Express promoted to T${s.movement.toTier}`}
                    {s.movement.movement === 'REGRESS'         && `↓ Regressed to T${s.movement.toTier}`}
                    {s.movement.movement === 'RE_PROMOTE'      && `↺ Restored to T${s.movement.toTier}`}
                  </p>
                )}
              </div>
              {isQuick && <Mono className="text-bogey text-[8px] shrink-0">Quick</Mono>}
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
    // Sync only at creation -- later local-only mutations (e.g.
    // promptShownAfter below) aren't re-synced, same tradeoff as
    // Driver Standard.
    void syncDrillSession({
      drillType: 'approach-standard',
      session: sessionWithMovement,
      getId: (s) => s.id,
      getPlayedAt: (s) => s.startedAt,
    });

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
    <ToolContainer>
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
    </ToolContainer>
  );
}
