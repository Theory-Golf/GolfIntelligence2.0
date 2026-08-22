'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import {
  Band,
  Eyebrow,
  Mono,
  PrimaryButton,
  SecondaryButton,
  TextButton,
  ToolContainer,
  Stat,
  StatRow,
  bandClasses,
} from '@/components/playerpath/ui';
import { LS_DRIVER_STANDARD } from '@/lib/constants';
import { derivedClientId } from '@/lib/playerpath/clientId';
import { syncDrillHistory } from '@/lib/playerpath/history';
import { drillSessionInput, recordDrillSession } from '@/lib/playerpath/record';

// ── Domain ───────────────────────────────────────────────────────────

type Shape = 'Draw' | 'Fade';
type Track = 'off' | 'on';

interface Tier {
  num: number;
  name: string;
  width: number;
  half: number;
  profile: string;
  desc: string;
}

const TIERS: Tier[] = [
  { num: 1, name: 'Foundation',    width: 60, half: 30, profile: 'Developing competitor',      desc: 'Build a repeatable swing inside a generous window.' },
  { num: 2, name: 'Developing',    width: 50, half: 25, profile: '5–10 handicap',              desc: 'Tighten dispersion to amateur fairway range.' },
  { num: 3, name: 'Competitive',   width: 42, half: 21, profile: 'Low single-digit / college', desc: 'Tournament-narrow fairway territory.' },
  { num: 4, name: 'Scratch',       width: 36, half: 18, profile: 'Scratch / +1',               desc: 'Drive it like a scratch player — USGA standard.' },
  { num: 5, name: 'Tour Standard', width: 28, half: 14, profile: 'Tour-level dispersion',      desc: 'Tighter than the average tour fairway.' },
];

const tierData = (n: number) => TIERS.find((t) => t.num === n) ?? TIERS[0];

interface ShapeBreakdown {
  Draw: { hits: number; total: number };
  Fade: { hits: number; total: number };
}

interface SessionRecord {
  tier: number;
  hits: number;
  totalShots: number;
  band: Band;
  isStandard: boolean;
  shapeMode: boolean;
  shapeBreakdown: ShapeBreakdown | null;
  timestamp: number;
}

interface StreakState {
  passStreak: number;
  eliteStreak: number;
  recent: Band[];
}

interface TrackState {
  tier: number;
  streak: StreakState;
  reselectCount: number;
  ciDismissals: number;
  dismissedPatterns: string[];
}

interface PersistedState {
  initialized: boolean;
  shapeMode: boolean;
  tracks: { off: TrackState; on: TrackState };
  history: SessionRecord[];
}

const emptyStreak = (): StreakState => ({ passStreak: 0, eliteStreak: 0, recent: [] });
const emptyTrack = (tier = 1): TrackState => ({
  tier,
  streak: emptyStreak(),
  reselectCount: 0,
  ciDismissals: 0,
  dismissedPatterns: [],
});

const LS_KEY = LS_DRIVER_STANDARD;

const loadState = (): PersistedState => {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw) as PersistedState;
  } catch {
    return defaultState();
  }
};

const saveState = (s: PersistedState) => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
};

const defaultState = (): PersistedState => ({
  initialized: false,
  shapeMode: false,
  tracks: { off: emptyTrack(), on: emptyTrack() },
  history: [],
});

// ── Helpers ──────────────────────────────────────────────────────────

const randomShape = (history: Shape[]): Shape => {
  if (history.length >= 3) {
    const last3 = history.slice(-3);
    if (last3.every((s) => s === last3[0])) {
      return last3[0] === 'Draw' ? 'Fade' : 'Draw';
    }
  }
  return Math.random() < 0.5 ? 'Draw' : 'Fade';
};

const bandFor = (hits: number, isStandard: boolean): Band => {
  if (isStandard) {
    if (hits >= 8) return 'Elite';
    if (hits >= 5) return 'Pass';
    return 'Fail';
  }
  return hits >= 2 ? 'Pass' : 'Fail';
};

interface PatternResult {
  id: string;
  title: string;
  summary: string;
  prescription: string;
}

const detectPattern = (
  trackHistory: SessionRecord[],
  currentTier: number,
  shapeMode: boolean,
  dismissed: string[],
): PatternResult | null => {
  const MIN = 5;
  const standard = trackHistory.filter((s) => s.isStandard);
  if (standard.length < MIN) return null;
  const window = standard.slice(-MIN);

  // Pattern 1 — Shape weakness (shape on, gap >20pp)
  if (shapeMode) {
    const shapeOn = window.filter((s) => s.shapeMode && s.shapeBreakdown);
    if (shapeOn.length >= MIN) {
      let dh = 0, dt = 0, fh = 0, ft = 0;
      shapeOn.forEach((s) => {
        const sb = s.shapeBreakdown!;
        dh += sb.Draw.hits; dt += sb.Draw.total;
        fh += sb.Fade.hits; ft += sb.Fade.total;
      });
      const dr = dt ? dh / dt : 0;
      const fr = ft ? fh / ft : 0;
      const gap = Math.abs(dr - fr);
      if (gap > 0.20) {
        const weak: Shape = dr < fr ? 'Draw' : 'Fade';
        const id = `shape-weakness-${weak}-T${currentTier}`;
        if (!dismissed.includes(id)) {
          const weakRate = Math.round((weak === 'Draw' ? dr : fr) * 100);
          return {
            id,
            title: `${weak} weakness`,
            summary: `Your ${weak.toLowerCase()} hit rate is ${weakRate}%, ${Math.round(gap * 100)} points below your ${weak === 'Draw' ? 'fade' : 'draw'}.`,
            prescription: `Next session: drop one tier and call ${weak} on every shot. Concentrated reps on the weak shape will close the gap.`,
          };
        }
      }
    }
  }

  // Pattern 2 — Inconsistency (std dev > 2.0 at same tier)
  const sameTier = window.filter((s) => s.tier === currentTier);
  if (sameTier.length >= MIN) {
    const hits = sameTier.map((s) => s.hits);
    const mean = hits.reduce((a, b) => a + b, 0) / hits.length;
    const variance = hits.reduce((a, b) => a + (b - mean) ** 2, 0) / hits.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 2.0) {
      const id = `inconsistency-T${currentTier}`;
      if (!dismissed.includes(id)) {
        return {
          id,
          title: 'High variance',
          summary: `Your scores at this tier are swinging session to session (${hits.join(' → ')}). Good days and bad days, not a consistent skill level.`,
          prescription: `Next session: drop one tier and rebuild a 3-Pass streak before re-attempting Tier ${currentTier}. A stable foundation will smooth out the variance.`,
        };
      }
    }
  }

  // Pattern 3 — Tier stall (5 same-tier sessions, no advance)
  if (sameTier.length >= MIN) {
    const id = `stall-T${currentTier}-${shapeMode ? 'on' : 'off'}`;
    if (!dismissed.includes(id)) {
      return {
        id,
        title: 'Tier stall',
        summary: `You've held Tier ${currentTier} for ${sameTier.length} sessions without advancing.`,
        prescription: `Consider taking a rest day, then run a session at one tier lower to reset. Distributed practice often resolves stalls faster than added volume.`,
      };
    }
  }

  return null;
};

// ── Atoms ────────────────────────────────────────────────────────────
// Shared atoms come from @/components/playerpath/ui; only the tool-specific
// shape palette lives here.

const shapeClasses: Record<Shape, { text: string; bg: string; border: string }> = {
  Draw: { text: 'text-c1', bg: 'bg-c1', border: 'border-c1' },
  Fade: { text: 'text-c5', bg: 'bg-c5', border: 'border-c5' },
};

// ── Screens ──────────────────────────────────────────────────────────

interface BaseProps { state: PersistedState; setState: (s: PersistedState) => void; }

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-4">
        <Eyebrow>Player Path Standard</Eyebrow>
        <h2 className="font-display font-extrabold text-4xl text-foreground uppercase tracking-tight">
          How it <span className="italic text-primary">works</span>
        </h2>
        <p className="font-body text-base text-muted-foreground max-w-md leading-relaxed">
          A periodized practice protocol for off-the-tee accuracy. Five tiers, anchored to PGA Tour and USGA fairway standards. Binary scoring — every shot is Hit or Miss. The standard rises with you.
        </p>
      </div>

      <StatRow>
        <Stat label="Tiers" value="5" />
        <Stat label="Range" value="60→28" unit="YD" />
        <Stat label="Session" value="13" unit="SHOTS" />
      </StatRow>

      <PrimaryButton onClick={onStart}>Begin</PrimaryButton>
    </div>
  );
}

function TierSelectScreen({
  isReselect, currentTier, prevResult, onBack, onSelect,
}: {
  isReselect?: boolean;
  currentTier?: number;
  prevResult?: { hits: number; totalShots: number } | null;
  onBack?: () => void;
  onSelect: (tier: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(currentTier ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="size-3" /> Back
          </button>
        )}
        <Eyebrow>{isReselect ? 'Confirm or Re-select' : 'Tier Selection'}</Eyebrow>
        <h2 className="font-display font-extrabold text-4xl mt-2 text-foreground uppercase tracking-tight">
          {isReselect ? 'Right tier?' : 'Pick your tier'}
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-3 max-w-md leading-relaxed">
          {isReselect && prevResult
            ? `You scored ${prevResult.hits}/${prevResult.totalShots} last session. Confirm your tier or re-select before this session.`
            : 'Choose the tier that matches your current driving. The system will calibrate over your first three sessions.'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {TIERS.map((t) => {
          const active = selected === t.num;
          return (
            <button
              key={t.num}
              type="button"
              onClick={() => setSelected(t.num)}
              className={`text-left p-4 transition-colors duration-150 border-l-[3px]
                ${active
                  ? 'bg-accent border-primary border-y border-r border-y-primary border-r-primary'
                  : 'bg-surface border-border hover:border-cement'}`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-baseline gap-2">
                  <span className={`font-mono text-[10px] tracking-[0.18em] uppercase ${active ? 'text-primary' : 'text-muted-foreground'}`}>Tier {t.num}</span>
                  <span className={`font-display text-xl font-bold uppercase tracking-tight ${active ? 'text-primary' : 'text-foreground'}`}>{t.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-extrabold text-foreground">
                    {t.width}<span className="text-[11px] text-muted-foreground ml-0.5">YD</span>
                  </div>
                  <Mono className="block mt-0.5">±{t.half} from center</Mono>
                </div>
              </div>
              <p className="font-body text-xs text-muted-foreground mt-1">{t.profile}</p>
              <p className="font-body text-sm text-muted-foreground mt-1.5">{t.desc}</p>
            </button>
          );
        })}
      </div>

      <PrimaryButton onClick={() => selected && onSelect(selected)} disabled={!selected}>
        {isReselect ? (selected === currentTier ? 'Confirm tier' : 'Switch tier') : 'Select tier'}
      </PrimaryButton>
    </div>
  );
}

function PatternCard({ pattern, onDismiss }: { pattern: PatternResult | null; onDismiss: () => void }) {
  if (!pattern) return null;
  return (
    <div className="relative bg-surface border border-border border-l-[3px] border-l-primary p-4 mb-4">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss pattern"
      >
        <X className="size-4" />
      </button>
      <Mono className="text-primary block mb-2">Pattern detected</Mono>
      <h3 className="font-display text-xl font-bold italic text-foreground uppercase mb-2">{pattern.title}</h3>
      <p className="font-body text-xs text-muted-foreground mb-2.5">{pattern.summary}</p>
      <div className="h-px bg-border my-2.5" />
      <Mono className="block mb-1.5">Prescription</Mono>
      <p className="font-body text-xs text-foreground">{pattern.prescription}</p>
    </div>
  );
}

function SessionSetupScreen({
  state, setState, onStart, onShowHistory, pattern, onDismissPattern,
}: BaseProps & {
  onStart: (length: 'mini' | 'standard') => void;
  onShowHistory: () => void;
  pattern: PatternResult | null;
  onDismissPattern: () => void;
}) {
  const [length, setLength] = useState<'mini' | 'standard'>('standard');
  const track: Track = state.shapeMode ? 'on' : 'off';
  const ts = state.tracks[track];
  const td = tierData(ts.tier);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Session Setup</Eyebrow>
        <h2 className="font-display font-extrabold text-4xl mt-2 text-foreground uppercase tracking-tight">Ready?</h2>
      </div>

      <PatternCard pattern={pattern} onDismiss={onDismissPattern} />

      {/* Current tier card */}
      <div className="bg-surface border border-border border-t-[3px] border-t-primary p-5">
        <div className="flex justify-between items-start">
          <div>
            <Mono className="text-primary block">Current tier</Mono>
            <div className="font-display text-3xl font-extrabold uppercase text-foreground mt-1">
              T{ts.tier} <span className="text-primary italic">{td.name}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-extrabold text-foreground">
              {td.width}<span className="text-xs text-muted-foreground ml-0.5">YD</span>
            </div>
            <Mono className="block mt-0.5">±{td.half}</Mono>
          </div>
        </div>
        <div className="h-px bg-border my-3" />
        <div className="flex justify-between gap-6">
          <div>
            <Mono className="block">Pass streak</Mono>
            <p className="font-body text-sm text-foreground mt-0.5">{ts.streak.passStreak} of 3</p>
          </div>
          <div>
            <Mono className="block">Last 3</Mono>
            <p className="font-body text-sm text-foreground mt-0.5">
              {ts.streak.recent.length === 0 ? '—' : ts.streak.recent.slice(-3).map((r, i) => (
                <span key={i} className={`mr-1.5 font-mono ${bandClasses[r].text}`}>{r[0]}</span>
              ))}
            </p>
          </div>
          <div>
            <Mono className="block">Track</Mono>
            <p className="font-body text-sm text-foreground mt-0.5">Shape {state.shapeMode ? 'on' : 'off'}</p>
          </div>
        </div>
      </div>

      {/* Session length */}
      <div>
        <Mono className="block mb-2.5">Session length</Mono>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'mini' as const,     label: 'Mini',     shots: 6,  sub: 'Check-in' },
            { id: 'standard' as const, label: 'Standard', shots: 13, sub: 'Counts toward streak' },
          ].map((opt) => {
            const active = length === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLength(opt.id)}
                className={`text-left p-3.5 transition-colors duration-150
                  ${active ? 'bg-accent border border-primary' : 'bg-surface border border-border hover:border-cement'}`}
              >
                <div className="flex justify-between items-baseline">
                  <span className={`font-display text-lg font-bold uppercase tracking-tight ${active ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
                  <span className={`font-mono text-[10px] tracking-[0.18em] uppercase ${active ? 'text-primary' : 'text-muted-foreground'}`}>{opt.shots} shots</span>
                </div>
                <p className="font-body text-[11px] text-muted-foreground mt-1">{opt.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shape mode toggle */}
      <div>
        <Mono className="block mb-2.5">Shape mode</Mono>
        <button
          type="button"
          onClick={() => setState({ ...state, shapeMode: !state.shapeMode })}
          className={`w-full flex justify-between items-center px-4 py-3.5 bg-surface border transition-colors duration-150
            ${state.shapeMode ? 'border-primary' : 'border-border hover:border-cement'}`}
        >
          <div className="text-left">
            <div className={`font-display text-base font-bold uppercase tracking-tight ${state.shapeMode ? 'text-primary' : 'text-foreground'}`}>
              {state.shapeMode ? 'On' : 'Off'}
            </div>
            <p className="font-body text-[11px] text-muted-foreground mt-0.5">
              {state.shapeMode ? 'Each shot will call Draw or Fade' : 'Width only — no shape called'}
            </p>
          </div>
          <div className={`relative w-11 h-6 rounded-xl transition-colors duration-200 ${state.shapeMode ? 'bg-primary' : 'bg-pitch'}`}>
            <div className={`absolute top-[3px] size-[18px] rounded-full bg-white transition-[left] duration-200 ${state.shapeMode ? 'left-[23px]' : 'left-[3px]'}`} />
          </div>
        </button>
      </div>

      <PrimaryButton onClick={() => onStart(length)}>Start session</PrimaryButton>

      <TextButton onClick={onShowHistory} className="text-center">View history</TextButton>
    </div>
  );
}

function ShotScreen({
  shotNum, totalShots, hits, shape, shapeMode, tier, onResult, onAbandon, toast,
}: {
  shotNum: number;
  totalShots: number;
  hits: number;
  shape: Shape;
  shapeMode: boolean;
  tier: number;
  onResult: (isHit: boolean) => void;
  onAbandon: () => void;
  toast: { isHit: boolean; shape: Shape | null; shotNum: number } | null;
}) {
  const td = tierData(tier);
  const isStandard = totalShots === 13;
  const passThreshold = isStandard ? 5 : 2;
  const eliteThreshold = isStandard ? 8 : null;
  const fillPct = (hits / totalShots) * 100;
  const passPct = (passThreshold / totalShots) * 100;
  const elitePct = eliteThreshold ? (eliteThreshold / totalShots) * 100 : null;

  let fillColor = 'bg-primary';
  let fillText = 'text-foreground';
  if (eliteThreshold && hits >= eliteThreshold) {
    fillColor = 'bg-sg-strong';
    fillText = 'text-sg-strong';
  } else if (hits >= passThreshold) {
    fillColor = 'bg-sg-gain';
    fillText = 'text-sg-gain';
  }

  return (
    <div className="relative flex flex-col gap-7">
      {toast && (
        <div className="absolute inset-0 z-50 flex flex-col justify-center items-center bg-background/95 animate-in fade-in duration-150">
          <div className="flex items-center gap-4">
            <div className={`size-14 rounded-full flex items-center justify-center border-2
              ${toast.isHit ? 'border-sg-gain bg-sg-gain/10' : 'border-sg-weak bg-sg-weak/10'}`}>
              <span className={`font-display text-3xl font-extrabold ${toast.isHit ? 'text-sg-gain' : 'text-sg-weak'}`}>
                {toast.isHit ? '✓' : '✕'}
              </span>
            </div>
            <span className={`font-display text-4xl font-extrabold italic uppercase ${toast.isHit ? 'text-sg-gain' : 'text-sg-weak'}`}>
              {toast.isHit ? 'Hit' : 'Miss'}
            </span>
          </div>
          <Mono className="block mt-3.5">
            Shot {toast.shotNum} logged{toast.shape ? ` · ${toast.shape}` : ''}
          </Mono>
        </div>
      )}

      {/* Top bar */}
      <div className="flex justify-between items-center">
        <button type="button" onClick={onAbandon} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="End session">
          <X className="size-5" />
        </button>
        <div className="text-center">
          <Mono className="block">Shot</Mono>
          <div className="font-display text-xl font-bold mt-0.5 text-foreground">{shotNum} / {totalShots}</div>
        </div>
        <div className="w-5" />
      </div>

      {/* Hit progress bar */}
      <div className="bg-surface border border-border p-4">
        <div className="flex justify-between items-baseline mb-2.5">
          <Mono>Hits</Mono>
          <div className={`font-display text-xl font-extrabold ${fillText}`}>
            {hits}<span className="text-muted-foreground text-sm">/{totalShots}</span>
          </div>
        </div>
        <div className="relative h-1 bg-pitch">
          <div
            className={`absolute top-0 left-0 h-full transition-[width,background-color] duration-300 ${fillColor}`}
            style={{ width: `${fillPct}%` }}
          />
          <div className="absolute -top-[3px] w-px h-2.5 bg-cement" style={{ left: `${passPct}%` }} />
          {elitePct !== null && (
            <div className="absolute -top-[3px] w-px h-2.5 bg-sg-strong" style={{ left: `${elitePct}%` }} />
          )}
        </div>
        <div className="relative h-3 mt-1.5">
          <div
            className="absolute font-mono text-[8px] tracking-[0.15em] uppercase text-muted-foreground whitespace-nowrap -translate-x-1/2"
            style={{ left: `${passPct}%` }}
          >
            Pass · {passThreshold}
          </div>
          {eliteThreshold && (
            <div
              className="absolute font-mono text-[8px] tracking-[0.15em] uppercase text-sg-strong whitespace-nowrap -translate-x-1/2"
              style={{ left: `${elitePct}%` }}
            >
              Elite · {eliteThreshold}
            </div>
          )}
        </div>
      </div>

      {/* Shape / Window */}
      <div className="flex flex-col items-center justify-center py-6">
        <Mono className="block mb-4">{shapeMode ? 'Call' : 'Window'}</Mono>
        {shapeMode ? (
          <span className={`font-display text-[clamp(40px,8vw,72px)] font-extrabold italic uppercase leading-none ${shapeClasses[shape].text}`}>
            {shape}
          </span>
        ) : (
          <span className="font-display text-[clamp(40px,8vw,72px)] font-extrabold uppercase leading-none text-foreground">
            {td.width}<span className="text-2xl text-muted-foreground ml-1.5">YD</span>
          </span>
        )}
        <div className="h-px w-20 bg-border my-5" />
        {shapeMode ? (
          <>
            <Mono>Window</Mono>
            <p className="font-body text-sm text-foreground mt-1">±{td.half} yds from center</p>
          </>
        ) : (
          <p className="font-body text-sm text-muted-foreground">±{td.half} from center line</p>
        )}
      </div>

      <p className="font-body text-xs text-muted-foreground text-center">
        {shapeMode
          ? 'Was the shot inside your window AND the correct shape?'
          : 'Was the shot inside your window?'}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onResult(false)}
          className="bg-surface border border-scarlet-dim text-sg-weak font-display text-base font-bold tracking-[0.16em] uppercase py-5 hover:bg-sg-weak/10 transition-colors duration-150"
        >
          ✕ Miss
        </button>
        <button
          type="button"
          onClick={() => onResult(true)}
          className="bg-surface border border-sg-gain text-sg-gain font-display text-base font-bold tracking-[0.16em] uppercase py-5 hover:bg-sg-gain/10 transition-colors duration-150"
        >
          ✓ Hit
        </button>
      </div>
    </div>
  );
}

interface SummaryResult {
  hits: number;
  totalShots: number;
  band: Band;
  isStandard: boolean;
  tier: number;
  shapeMode: boolean;
  shapeBreakdown: ShapeBreakdown | null;
  advancement: { label: string; tone: 'primary' | 'success' | 'default'; message: string } | null;
}

function SummaryScreen({
  result, onContinue, onShowCIPrompt, ciPromptEligible,
}: {
  result: SummaryResult;
  onContinue: () => void;
  onShowCIPrompt: () => void;
  ciPromptEligible: boolean;
}) {
  const { hits, totalShots, band, isStandard, tier, shapeMode, advancement, shapeBreakdown } = result;
  const td = tierData(tier);
  const passThreshold = isStandard ? 5 : 2;
  const eliteThreshold = isStandard ? 8 : null;
  const cfg = bandClasses[band];
  const msg = {
    Pass: 'You met the standard for this tier.',
    Fail: 'Below the standard for this tier.',
    Elite: 'Above the standard for this tier.',
  }[band];

  return (
    <div className="flex flex-col gap-4">
      <Eyebrow>{isStandard ? 'Standard session' : 'Mini session — check-in'}</Eyebrow>

      <div>
        <h2 className={`font-display text-6xl font-extrabold italic uppercase ${cfg.text}`}>{band}</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">{msg}</p>
      </div>

      {/* Score block */}
      <div className="bg-surface border border-border p-5">
        <div className="flex justify-between items-baseline mb-2.5">
          <Mono>Score</Mono>
          <Mono>T{tier} {td.name}{shapeMode ? ' · Shape' : ''}</Mono>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-display text-6xl font-extrabold ${cfg.text}`}>{hits}</span>
          <span className="font-display text-3xl text-muted-foreground">/{totalShots}</span>
        </div>
        <div className="relative h-6 mt-3.5">
          <div className="absolute top-[10px] inset-x-0 h-1 bg-pitch" />
          <div
            className={`absolute top-[10px] left-0 h-1 transition-[width] duration-500 ${cfg.bg}`}
            style={{ width: `${(hits / totalShots) * 100}%` }}
          />
          <div className="absolute top-1 w-px h-4 bg-cement" style={{ left: `${(passThreshold / totalShots) * 100}%` }} />
          <div
            className="absolute top-[22px] -translate-x-1/2 font-mono text-[8px] tracking-[0.15em] uppercase text-muted-foreground"
            style={{ left: `${(passThreshold / totalShots) * 100}%` }}
          >
            Pass
          </div>
          {eliteThreshold && (
            <>
              <div className="absolute top-1 w-px h-4 bg-sg-strong" style={{ left: `${(eliteThreshold / totalShots) * 100}%` }} />
              <div
                className="absolute top-[22px] -translate-x-1/2 font-mono text-[8px] tracking-[0.15em] uppercase text-sg-strong"
                style={{ left: `${(eliteThreshold / totalShots) * 100}%` }}
              >
                Elite
              </div>
            </>
          )}
        </div>
      </div>

      {shapeMode && shapeBreakdown && (
        <div className="bg-surface border border-border p-4">
          <Mono className="block mb-3">By shape</Mono>
          <div className="grid grid-cols-2 gap-2">
            {(['Draw', 'Fade'] as Shape[]).map((shape) => {
              const sb = shapeBreakdown[shape];
              const pct = sb.total === 0 ? 0 : (sb.hits / sb.total) * 100;
              const sc = shapeClasses[shape];
              return (
                <div key={shape} className={`bg-shadow p-3 border-t-2 ${sc.border}`}>
                  <div className={`font-display text-base font-bold italic uppercase ${sc.text}`}>{shape}</div>
                  <div className="font-display text-2xl font-extrabold mt-1 text-foreground">
                    {sb.hits}<span className="text-muted-foreground text-sm">/{sb.total}</span>
                  </div>
                  <div className="mt-1.5 h-0.5 bg-pitch">
                    <div className={`h-full ${sc.bg}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {advancement && (
        <div className={`p-4 border border-l-[3px]
          ${advancement.tone === 'primary' ? 'bg-accent border-primary border-l-primary' :
            advancement.tone === 'success' ? 'bg-sg-strong/10 border-sg-strong border-l-sg-strong' :
            'bg-surface border-border border-l-border'}`}>
          <Mono className={`block ${advancement.tone === 'primary' ? 'text-primary' : advancement.tone === 'success' ? 'text-sg-strong' : ''}`}>
            {advancement.label}
          </Mono>
          <p className="font-body text-sm text-foreground mt-2">{advancement.message}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        {ciPromptEligible && (
          <SecondaryButton onClick={onShowCIPrompt}>Ready for the next layer?</SecondaryButton>
        )}
        <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
      </div>
    </div>
  );
}

function CIReadinessScreen({
  tierName, trigger, onAccept, onDismiss,
}: { tierName: string; trigger: string; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Eyebrow>Contextual interference</Eyebrow>
      <h2 className="font-display text-5xl font-extrabold italic uppercase tracking-tight text-foreground leading-[0.9]">
        Ready for the<br />
        <span className="text-primary">next layer?</span>
      </h2>
      <div className="h-px bg-border my-4" />
      <p className="font-body text-base text-muted-foreground leading-relaxed">
        You&rsquo;ve passed your last {trigger} at <span className="text-foreground">{tierName}</span> with shape mode off. That&rsquo;s a good signal — your dispersion is repeatable at this width.
      </p>
      <p className="font-body text-base text-muted-foreground leading-relaxed">
        Adding shape mode now will make practice <span className="text-foreground">feel harder</span>, but research on contextual interference shows that performance feeling worse during practice is the mechanism that produces better transfer to the course. The brain learns more when each shot requires a fresh decision.
      </p>
      <p className="font-body text-base text-muted-foreground leading-relaxed">
        You can turn it on for your next session and turn it off any time.
      </p>
      <div className="flex flex-col gap-2 pt-2">
        <PrimaryButton onClick={onAccept}>Try shape mode</PrimaryButton>
        <SecondaryButton onClick={onDismiss}>Not yet</SecondaryButton>
      </div>
    </div>
  );
}

function PromotionScreen({
  fromTier, toTier, isExpress, onContinue,
}: { fromTier: number; toTier: number; isExpress: boolean; onContinue: () => void }) {
  const fromData = tierData(fromTier);
  const toData = tierData(toTier);
  return (
    <div className="flex flex-col items-center text-center gap-6 py-6">
      <div className="font-display text-3xl font-extrabold italic uppercase tracking-wide text-sg-strong">
        {isExpress ? 'Express' : 'Tier'}<br />
        {isExpress ? 'Promotion' : 'Up'}
      </div>
      <div className="h-px w-14 bg-sg-strong/40" />
      <div>
        <div className="font-display text-7xl sm:text-8xl font-extrabold italic uppercase text-foreground leading-[0.85]">Tier {toTier}</div>
        <div className="font-display text-3xl font-bold uppercase text-foreground mt-2">{toData.name}</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <Mono className="block">From</Mono>
          <div className="font-display text-xl font-bold text-muted-foreground mt-0.5">
            {fromData.width}<span className="text-[11px] ml-0.5">YD</span>
          </div>
        </div>
        <div className="text-2xl text-sg-strong">→</div>
        <div className="text-left">
          <Mono className="block text-sg-strong">To</Mono>
          <div className="font-display text-xl font-bold text-sg-strong mt-0.5">
            {toData.width}<span className="text-[11px] ml-0.5">YD</span>
          </div>
        </div>
      </div>
      <p className="font-body text-sm text-muted-foreground max-w-xs">
        {isExpress
          ? 'Two consecutive Elite sessions. The system promoted you immediately.'
          : 'Three consecutive Pass sessions. You&rsquo;ve earned the next tier.'}
      </p>
      <div className="w-full pt-2">
        <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
      </div>
    </div>
  );
}

function HistoryScreen({ history, onBack }: { history: SessionRecord[]; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-primary transition-colors self-start"
      >
        <ArrowLeft className="size-3" /> Back
      </button>
      <Eyebrow>History</Eyebrow>
      <h2 className="font-display font-extrabold text-4xl mt-1 text-foreground uppercase tracking-tight">Sessions</h2>

      {history.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">No sessions logged yet. Complete a session to see it here.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {[...history].reverse().map((s, i) => {
            const td = tierData(s.tier);
            const cfg = bandClasses[s.band];
            return (
              <div key={i} className={`bg-surface border border-border border-l-[3px] ${cfg.border} p-3`}>
                <div className="flex justify-between items-baseline">
                  <div>
                    <Mono className={`block ${cfg.text}`}>{s.band} · T{s.tier} {td.name}</Mono>
                    <p className="font-body text-xs text-muted-foreground mt-1">
                      {s.isStandard ? 'Standard 13' : 'Mini 6'} · Shape {s.shapeMode ? 'On' : 'Off'}
                    </p>
                  </div>
                  <div className={`font-display text-xl font-bold ${cfg.text}`}>
                    {s.hits}<span className="text-xs text-muted-foreground ml-0.5">/{s.totalShots}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Orchestrator ─────────────────────────────────────────────────────

type Screen =
  | 'welcome'
  | 'tier-select'
  | 'tier-select-confirm'
  | 'setup'
  | 'shot'
  | 'summary'
  | 'ci-prompt'
  | 'promotion'
  | 'history';

export default function DriverStandard() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setStateRaw] = useState<PersistedState>(defaultState);
  const [screen, setScreen] = useState<Screen>('welcome');

  // Active session
  const [sessionLength, setSessionLength] = useState<'mini' | 'standard'>('standard');
  const [shotNum, setShotNum] = useState(1);
  const [hits, setHits] = useState(0);
  const [shotLog, setShotLog] = useState<{ shape: Shape | null; isHit: boolean }[]>([]);
  const [currentShape, setCurrentShape] = useState<Shape>('Draw');
  const [toast, setToast] = useState<{ isHit: boolean; shape: Shape | null; shotNum: number } | null>(null);

  const [lastResult, setLastResult] = useState<SummaryResult | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: number; to: number; isExpress: boolean } | null>(null);
  const [pendingRegression, setPendingRegression] = useState<number | null>(null);
  const [activePattern, setActivePattern] = useState<PatternResult | null>(null);

  // Hydration / persistence
  useEffect(() => {
    const loaded = loadState();
    setStateRaw(loaded);
    setScreen(loaded.initialized ? 'setup' : 'welcome');
    setHydrated(true);
    // Fold in sessions logged on the player's other devices.
    void syncDrillHistory<SessionRecord>({
      drillType: 'driver-standard',
      local: loaded.history ?? [],
      hydrate: (r) => r.payload as unknown as SessionRecord,
      keyOf: (x) => String(x.timestamp),
      sortKey: (x) => x.timestamp,
    }).then((merged) => {
      if (!merged) return;
      setStateRaw((prev) => ({ ...prev, history: merged }));
    });
  }, []);

  const setState = (s: PersistedState) => {
    setStateRaw(s);
    saveState(s);
  };

  const track: Track = state.shapeMode ? 'on' : 'off';
  const ts = state.tracks[track];
  const currentTier = ts.tier;

  // Pattern detection — re-run when entering setup
  useEffect(() => {
    if (screen !== 'setup') return;
    const trackHistory = state.history.filter((h) => (h.shapeMode ? 'on' : 'off') === track);
    const detected = detectPattern(trackHistory, currentTier, state.shapeMode, ts.dismissedPatterns);
    setActivePattern(detected);
  }, [screen, state.history, currentTier, track, state.shapeMode, ts.dismissedPatterns]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleStart = () => setScreen('tier-select');

  const handleInitialTierSelect = (tier: number) => {
    setState({
      ...state,
      initialized: true,
      tracks: {
        ...state.tracks,
        [track]: { ...state.tracks[track], tier },
      },
    });
    setScreen('setup');
  };

  const handleStartSession = (length: 'mini' | 'standard') => {
    setSessionLength(length);
    setShotNum(1);
    setHits(0);
    setShotLog([]);
    if (state.shapeMode) setCurrentShape(randomShape([]));
    setScreen('shot');
  };

  const handleShotResult = (isHit: boolean) => {
    const totalShots = sessionLength === 'standard' ? 13 : 6;
    const newHits = hits + (isHit ? 1 : 0);
    const loggedShape = state.shapeMode ? currentShape : null;
    const newLog = [...shotLog, { shape: loggedShape, isHit }];

    setHits(newHits);
    setShotLog(newLog);
    setToast({ isHit, shape: loggedShape, shotNum });

    setTimeout(() => {
      setToast(null);
      if (shotNum >= totalShots) {
        finalizeSession(newHits, totalShots, newLog);
      } else {
        setShotNum(shotNum + 1);
        if (state.shapeMode) {
          const shapeHistory = newLog
            .map((s) => s.shape)
            .filter((s): s is Shape => s !== null);
          setCurrentShape(randomShape(shapeHistory));
        }
      }
    }, 750);
  };

  const finalizeSession = (
    finalHits: number,
    totalShots: number,
    finalLog: { shape: Shape | null; isHit: boolean }[],
  ) => {
    const isStandard = sessionLength === 'standard';
    const band = bandFor(finalHits, isStandard);

    let shapeBreakdown: ShapeBreakdown | null = null;
    if (state.shapeMode) {
      shapeBreakdown = { Draw: { hits: 0, total: 0 }, Fade: { hits: 0, total: 0 } };
      finalLog.forEach((shot) => {
        if (shot.shape) {
          shapeBreakdown![shot.shape].total += 1;
          if (shot.isHit) shapeBreakdown![shot.shape].hits += 1;
        }
      });
    }

    let advancement: SummaryResult['advancement'] = null;
    let promotion: typeof pendingPromotion = null;
    let regression: number | null = null;
    const newTrackState: TrackState = JSON.parse(JSON.stringify(ts));

    if (isStandard) {
      newTrackState.streak.recent = [...ts.streak.recent, band].slice(-3);
      if (band === 'Elite') {
        newTrackState.streak.eliteStreak = ts.streak.eliteStreak + 1;
        newTrackState.streak.passStreak = ts.streak.passStreak + 1;
      } else if (band === 'Pass') {
        newTrackState.streak.passStreak = ts.streak.passStreak + 1;
        newTrackState.streak.eliteStreak = 0;
      } else {
        newTrackState.streak.passStreak = 0;
        newTrackState.streak.eliteStreak = 0;
      }
      const failsInLast3 = newTrackState.streak.recent.filter((r) => r === 'Fail').length;

      if (newTrackState.streak.eliteStreak >= 2 && currentTier < 5) {
        advancement = {
          label: 'Express promotion',
          tone: 'success',
          message: `Two consecutive Elite sessions. You've been promoted to Tier ${currentTier + 1}.`,
        };
        promotion = { from: currentTier, to: currentTier + 1, isExpress: true };
        newTrackState.streak = emptyStreak();
      } else if (newTrackState.streak.passStreak >= 3 && currentTier < 5) {
        advancement = {
          label: 'Tier up',
          tone: 'success',
          message: `Three consecutive Pass sessions. You've been promoted to Tier ${currentTier + 1}.`,
        };
        promotion = { from: currentTier, to: currentTier + 1, isExpress: false };
        newTrackState.streak = emptyStreak();
      } else if (failsInLast3 >= 2 && currentTier > 1) {
        advancement = {
          label: 'Tier down',
          tone: 'primary',
          message: `Two Fails in last three sessions. Regressing to Tier ${currentTier - 1} to rebuild.`,
        };
        regression = currentTier - 1;
        newTrackState.streak = emptyStreak();
      } else if (currentTier === 5 && newTrackState.streak.passStreak >= 3) {
        advancement = {
          label: 'Tour standard held',
          tone: 'success',
          message: 'Tier 5 is the ceiling. Continuing to pass at Tour Standard is the goal of the tool.',
        };
        newTrackState.streak.passStreak = 0;
      } else if (band === 'Pass') {
        advancement = {
          label: 'Next session',
          tone: 'default',
          message: `Pass streak: ${newTrackState.streak.passStreak} of 3. Stay at Tier ${currentTier}.`,
        };
      } else if (band === 'Elite') {
        advancement = {
          label: 'Elite — keep going',
          tone: 'primary',
          message: `One more Elite for express promotion. Stay at Tier ${currentTier}.`,
        };
      } else {
        advancement = {
          label: 'Reset',
          tone: 'default',
          message: `Pass streak reset. Stay at Tier ${currentTier}, work on consistency.`,
        };
      }
    } else {
      advancement = {
        label: 'Mini — check-in only',
        tone: 'default',
        message: "Mini sessions don't affect your streak. Run a Standard session when you're ready.",
      };
    }

    const sessionRecord: SessionRecord = {
      tier: currentTier,
      hits: finalHits,
      totalShots,
      band,
      isStandard,
      shapeMode: state.shapeMode,
      shapeBreakdown,
      timestamp: Date.now(),
    };

    setState({
      ...state,
      history: [...state.history, sessionRecord],
      tracks: {
        ...state.tracks,
        [track]: newTrackState,
      },
    });

    // Local write first (the state effect persists it), then push to the
    // player's account. Records are keyed on a timestamp, so derive a stable
    // uuid from it — the upload derives the same one.
    void recordDrillSession(
      drillSessionInput(
        'driver-standard',
        // Keyed on timestamp alone: the stored history records carry no
        // track, so the one-time upload must derive the same value.
        derivedClientId('driver-standard', sessionRecord.timestamp),
        new Date(sessionRecord.timestamp),
        { track, ...sessionRecord },
      ),
    );

    setLastResult({
      hits: finalHits,
      totalShots,
      band,
      isStandard,
      tier: currentTier,
      shapeMode: state.shapeMode,
      shapeBreakdown,
      advancement,
    });
    setPendingPromotion(promotion);
    setPendingRegression(regression);
    setScreen('summary');
  };

  const ciPromptEligible = useMemo(() => {
    if (!lastResult || !lastResult.isStandard) return false;
    if (state.shapeMode) return false;
    if (currentTier > 2) return false;
    if (state.tracks.off.ciDismissals >= 3) return false;
    if (lastResult.band === 'Elite') return true;
    const recent = state.tracks.off.streak.recent;
    return (
      recent.length >= 2 &&
      recent[recent.length - 1] === 'Pass' &&
      recent[recent.length - 2] === 'Pass'
    );
  }, [lastResult, state.shapeMode, currentTier, state.tracks.off]);

  const handleContinueFromSummary = () => {
    if (pendingPromotion) {
      setScreen('promotion');
      return;
    }

    let next = state;
    if (pendingRegression !== null) {
      next = {
        ...next,
        tracks: {
          ...next.tracks,
          [track]: { ...next.tracks[track], tier: pendingRegression },
        },
      };
      setPendingRegression(null);
    }

    // Re-selection window — first 3 sessions on this track
    const sessionsOnTrack = next.history.filter((h) => (h.shapeMode ? 'on' : 'off') === track).length;
    const trackState = next.tracks[track];
    if (sessionsOnTrack <= 2 && trackState.reselectCount < sessionsOnTrack) {
      next = {
        ...next,
        tracks: {
          ...next.tracks,
          [track]: { ...trackState, reselectCount: sessionsOnTrack },
        },
      };
      setState(next);
      setScreen('tier-select-confirm');
      return;
    }

    setState(next);
    setLastResult(null);
    setScreen('setup');
  };

  const handlePromotionContinue = () => {
    if (!pendingPromotion) return;
    setState({
      ...state,
      tracks: {
        ...state.tracks,
        [track]: { ...state.tracks[track], tier: pendingPromotion.to },
      },
    });
    setPendingPromotion(null);
    setLastResult(null);
    setScreen('setup');
  };

  const handleConfirmReselect = (tier: number) => {
    setState({
      ...state,
      tracks: {
        ...state.tracks,
        [track]: { ...state.tracks[track], tier },
      },
    });
    setLastResult(null);
    setScreen('setup');
  };

  const handleAcceptCI = () => {
    setState({ ...state, shapeMode: true });
    setLastResult(null);
    setScreen('setup');
  };

  const handleDismissCI = () => {
    setState({
      ...state,
      tracks: {
        ...state.tracks,
        off: { ...state.tracks.off, ciDismissals: state.tracks.off.ciDismissals + 1 },
      },
    });
    handleContinueFromSummary();
  };

  const handleAbandonSession = () => {
    if (window.confirm("End session? This session will be discarded and won't count toward your streak.")) {
      setShotNum(1);
      setHits(0);
      setShotLog([]);
      setScreen('setup');
    }
  };

  const handleDismissPattern = () => {
    if (!activePattern) return;
    setState({
      ...state,
      tracks: {
        ...state.tracks,
        [track]: {
          ...state.tracks[track],
          dismissedPatterns: [...state.tracks[track].dismissedPatterns, activePattern.id],
        },
      },
    });
    setActivePattern(null);
  };

  const handleResetAll = () => {
    if (!window.confirm('Reset all Driver Standard progress? This cannot be undone.')) return;
    const fresh = defaultState();
    setState(fresh);
    setScreen('welcome');
  };

  // ── Render ───────────────────────────────────────────────────────

  if (!hydrated) {
    return <div className="px-6 py-12 max-w-xl mx-auto" />;
  }

  const totalShots = sessionLength === 'standard' ? 13 : 6;
  const trigger = lastResult?.band === 'Elite' ? 'Elite session' : 'two sessions';

  return (
    <ToolContainer>
      <div>
        {screen === 'welcome' && <WelcomeScreen onStart={handleStart} />}

        {screen === 'tier-select' && (
          <TierSelectScreen onSelect={handleInitialTierSelect} onBack={() => setScreen('welcome')} />
        )}

        {screen === 'tier-select-confirm' && (
          <TierSelectScreen
            isReselect
            currentTier={currentTier}
            prevResult={lastResult}
            onSelect={handleConfirmReselect}
          />
        )}

        {screen === 'setup' && (
          <SessionSetupScreen
            state={state}
            setState={setState}
            onStart={handleStartSession}
            onShowHistory={() => setScreen('history')}
            pattern={activePattern}
            onDismissPattern={handleDismissPattern}
          />
        )}

        {screen === 'shot' && (
          <ShotScreen
            shotNum={shotNum}
            totalShots={totalShots}
            hits={hits}
            shape={currentShape}
            shapeMode={state.shapeMode}
            tier={currentTier}
            onResult={handleShotResult}
            onAbandon={handleAbandonSession}
            toast={toast}
          />
        )}

        {screen === 'summary' && lastResult && (
          <SummaryScreen
            result={lastResult}
            onContinue={handleContinueFromSummary}
            onShowCIPrompt={() => setScreen('ci-prompt')}
            ciPromptEligible={ciPromptEligible}
          />
        )}

        {screen === 'ci-prompt' && (
          <CIReadinessScreen
            tierName={tierData(currentTier).name}
            trigger={trigger}
            onAccept={handleAcceptCI}
            onDismiss={handleDismissCI}
          />
        )}

        {screen === 'promotion' && pendingPromotion && (
          <PromotionScreen
            fromTier={pendingPromotion.from}
            toTier={pendingPromotion.to}
            isExpress={pendingPromotion.isExpress}
            onContinue={handlePromotionContinue}
          />
        )}

        {screen === 'history' && (
          <HistoryScreen history={state.history} onBack={() => setScreen('setup')} />
        )}

        {state.initialized && screen !== 'shot' && screen !== 'promotion' && (
          <div className="mt-12 pt-6 border-t border-border flex justify-end">
            <TextButton onClick={handleResetAll}>Reset progress</TextButton>
          </div>
        )}
      </div>
    </ToolContainer>
  );
}
