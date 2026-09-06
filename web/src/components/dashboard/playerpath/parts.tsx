'use client';

/**
 * PlayerPath verdict layer — the plain-language section above Advanced Analysis.
 *
 * Reads overview → verdict → why → plan. The strip leads so the verdict is a
 * conclusion the reader can already see the basis for, rather than one they
 * have to take on faith; it also hands a Tiger-5-first reader their whole
 * distribution immediately.
 */

import { useState, type ReactNode } from 'react';
import { PILLAR_COLORS, PILLAR_LABELS } from '@/lib/golf/driverSpecs';
import { MATERIALITY_SG_PER_ROUND } from '@/lib/golf/driverEngine';
import { LOSS_SHAPE_TUNING, type SegmentDiagnosisResult, type SegmentReading } from '@/lib/golf/segmentDiagnosis';
import type { Prescription, PracticePlan } from '@/lib/golf/practicePrescription';

const fmtSG = (sg: number) => `${sg > 0 ? '+' : sg < 0 ? '−' : ''}${Math.abs(sg).toFixed(2)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Colour from the five-step scale already defined in globals.css, so a number
 * here reads the same as the same number anywhere else in the dashboard.
 */
function sgColor(sgPerRound: number): string {
  if (sgPerRound >= 0.3) return 'var(--sg-strong)';
  if (sgPerRound > 0) return 'var(--sg-gain)';
  if (sgPerRound > -MATERIALITY_SG_PER_ROUND) return 'var(--sg-neutral)';
  if (sgPerRound > -0.75) return 'var(--sg-loss)';
  return 'var(--sg-weak)';
}

const pillarStyle = (r: SegmentReading) =>
  ({ ['--pp-pillar' as string]: PILLAR_COLORS[r.segment] });

// ── Overview strip ──────────────────────────────────────────────────────

export function SegmentStrip({
  readings,
  lead,
  totalT5Holes,
}: {
  readings: SegmentReading[];
  lead: SegmentReading | null;
  totalT5Holes: number;
}) {
  return (
    <div>
      <div className="ppv-eyebrow">Your game right now</div>
      <div className="ppv-strip">
        {readings.map(r => (
          <div
 key={r.segment}
 className={`ppv-seg${r === lead ? ' ppv-seg-lead' : ''}`}
 style={pillarStyle(r)}
          >
            <div className="ppv-seg-name">{PILLAR_LABELS[r.segment]}</div>
            <div className="ppv-seg-sg" style={{ color: sgColor(r.sgPerRound) }}>
              {r.shotCount === 0 ? '—' : fmtSG(r.sgPerRound)}
            </div>
            <div className="ppv-seg-rule" />
            <div className="ppv-seg-t5">{totalT5Holes === 0 ? '—' : pct(r.t5Share)}</div>
            <div className="ppv-seg-t5-label">
              of Tiger 5 · {r.t5Holes} {r.t5Holes === 1 ? 'hole' : 'holes'}
            </div>
            <div className="ppv-seg-bar">
              <i style={{ width: `${Math.round(r.t5Share * 100)}%` }} />
            </div>
            {r.demoted && <div className="ppv-seg-note">{r.demotionNote}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Verdict ─────────────────────────────────────────────────────────────

export function Verdict({
  diagnosis,
  benchmarkLabel,
}: {
  diagnosis: SegmentDiagnosisResult;
  benchmarkLabel: string;
}) {
  const { headline, t5Promoted, totalRounds, totalT5Holes } = diagnosis;
  if (!headline) return null;

  const lead = t5Promoted ?? headline;
  const name = PILLAR_LABELS[headline.segment];
  const edge = !headline.material;

  return (
    <div className="ppv-verdict" style={pillarStyle(lead)}>
      <div className="ppv-verdict-line">
        <span style={{ color: PILLAR_COLORS[headline.segment] }}>{name}</span>{' '}
        {edge ? 'is where your next stroke is' : 'is the one to work on'}
      </div>

      {/* Gate 4: the scoring damage and the strokes disagree, and that is the
          finding — so both get said rather than one being resolved away. */}
      {t5Promoted && (
        <div className="ppv-verdict-line">
          But{' '}
          <span style={{ color: PILLAR_COLORS[t5Promoted.segment] }}>
            {t5Promoted.t5Share >= 0.99 ? 'every one' : pct(t5Promoted.t5Share)}
          </span>{' '}
          of your Tiger 5 holes traces to {PILLAR_LABELS[t5Promoted.segment].toLowerCase()}
        </div>
      )}

      <div className="ppv-verdict-sub">
        {fmtSG(headline.sgPerRound)} a round vs {benchmarkLabel} · {headline.shotCount} shots over{' '}
        {totalRounds} {totalRounds === 1 ? 'round' : 'rounds'} · {totalT5Holes} Tiger 5{' '}
        {totalT5Holes === 1 ? 'hole' : 'holes'}
        {edge && ' · this is an edge, not a leak'}
      </div>
    </div>
  );
}

// ── Why ─────────────────────────────────────────────────────────────────

/**
 * Every shot in the segment, worst on the left, disasters picked out.
 *
 * Scaled to the 90th-percentile loss rather than the single worst shot: one
 * blow-up is often several times any other shot, and scaling to it flattens
 * every ordinary shot into an invisible sliver — which hides the very
 * comparison the plot exists to make. Disasters clip at full height instead.
 */
function ShotPlot({ shotSGs }: { shotSGs: number[] }) {
  if (shotSGs.length === 0) return null;
  const losses = shotSGs.filter(sg => sg < 0).map(Math.abs).sort((a, b) => a - b);
  const p90 = losses.length > 0 ? losses[Math.floor(losses.length * 0.9)] : 0;
  const scale = Math.max(p90 ?? 0, 0.15);
  return (
    <div className="ppv-plot">
      <div className="ppv-plot-row" aria-hidden="true">
        {shotSGs.map((sg, i) => (
          <i
 key={i}
 className={sg < LOSS_SHAPE_TUNING.DISASTER_SG ? 'bad' : undefined}
 style={{ height: `${Math.min(100, Math.max(6, (Math.abs(Math.min(sg, 0)) / scale) * 100))}%` }}
          />
        ))}
      </div>
      <div className="ppv-plot-scale">
        <span>Worst shot</span>
        <span>{shotSGs.length} shots</span>
        <span>Best</span>
      </div>
    </div>
  );
}

function shapeSentence(r: SegmentReading): string {
  const worst = Math.round(r.concentration * 100);
  switch (r.shape) {
    case 'blowup':
      return `Your typical shot is at standard — but the worst 10% are doing ${worst}% of the damage. This is a small number of bad shots, not a broad weakness.`;
    case 'leak':
      return `You are losing a little on most shots rather than blowing up on a few — the worst 10% account for only ${worst}% of the loss. This is a level problem.`;
    case 'mixed':
      return `The loss is spread but the tail matters: the worst 10% carry ${worst}% of it.`;
    default:
      return 'Not enough shots yet to say whether this is a slow leak or a few bad shots.';
  }
}

export function WhyCard({
  diagnosis,
  reading,
}: {
  diagnosis: SegmentDiagnosisResult;
  reading: SegmentReading;
}) {
  const context = segmentContext(diagnosis, reading);
  return (
    <div className="ppv-why">
      <div className="ppv-eyebrow">Why</div>

      {/* Strokes and Tiger 5 at equal weight — plenty of players read only the
          second, and the card has to work for them. */}
      <div className="ppv-stats">
        <div className="ppv-stat">
          <div className="ppv-stat-key">Strokes lost / round</div>
          <div className="ppv-stat-val" style={{ color: sgColor(reading.sgPerRound) }}>
            {fmtSG(reading.sgPerRound)}
          </div>
          <div className="ppv-stat-note">
            {reading.shotCount} shots · median {fmtSG(reading.medianShotSG)} a shot
          </div>
        </div>
        <div className="ppv-stat">
          <div className="ppv-stat-key">Tiger 5 root causes</div>
          <div
 className="ppv-stat-val"
 style={{ color: reading.t5Share >= 0.4 ? 'var(--sg-weak)' : 'var(--chalk)' }}
          >
            {reading.t5Holes} of {diagnosis.totalT5Holes}
          </div>
          <div className="ppv-stat-note">
            {diagnosis.totalT5Holes === 0
              ? 'No Tiger 5 holes in this window'
              : `${pct(reading.t5Share)} of your scoring damage`}
          </div>
        </div>
      </div>

      {context && <div className="ppv-finding">{context}</div>}
      <div className="ppv-finding">{shapeSentence(reading)}</div>
      <ShotPlot shotSGs={reading.shotSGs} />
    </div>
  );
}

/** The one contextual fact that makes the finding specific. */
function segmentContext(d: SegmentDiagnosisResult, r: SegmentReading): ReactNode {
  if (r.segment === 'Driving') {
    const miss = d.driving.oneWayMiss;
    return (
      <>
        {d.driving.nonDriverLossShare >= 0.4 && (
          <>
            <strong>{pct(d.driving.nonDriverLossShare)}</strong> of the loss comes from non-driver
            clubs off the tee.{' '}
          </>
        )}
        {miss ? (
          <>
            Your miss is <strong>{miss.toLowerCase()}</strong>{' '}
            {Math.round(miss === 'Left' ? d.driving.missLeftPct : d.driving.missRightPct)}% of the
            time.
          </>
        ) : (
          <>Penalty rate is {d.driving.penaltyRate.toFixed(1)}% off the tee.</>
        )}
      </>
    );
  }

  if (r.segment === 'Approach') {
    const band = d.approach.worstBand;
    if (!band) return null;
    return (
      <>
        <strong>{band.label}</strong> is carrying the loss —{' '}
        {band.greenHitPct.toFixed(0)}% of those approaches find the green, at{' '}
        {band.proximityFt.toFixed(0)} ft average proximity. Overall,{' '}
        {d.approach.within20FtPct.toFixed(0)}% of your approaches finish inside 20 feet.
      </>
    );
  }

  if (r.segment === 'Putting') {
    const zone = d.putting.worstZone;
    const gir = d.putting.girFirstPuttAvgFt;
    return (
      <>
        {zone && (
          <>
            <strong>{zone.label}</strong> ({zone.minFt}
            {zone.maxFt > 100 ? '+' : `–${zone.maxFt}`} ft) is your weakest zone.{' '}
          </>
        )}
        {gir !== null && (
          <>First putts average {gir.toFixed(0)} ft on greens in regulation.</>
        )}
      </>
    );
  }

  return (
    <>
      {d.shortGame.girAttemptShots > 0 && (
        <>
          <strong>{d.shortGame.girAttemptShots}</strong> of these shots were attempts at the green —
          live birdie chances.{' '}
        </>
      )}
      {pct(d.shortGame.routedFromMissedGreen)} of your short game follows a missed green.
    </>
  );
}

// ── Practice plan ───────────────────────────────────────────────────────

function GameCard({ card, lastPlayed }: { card: Prescription; lastPlayed?: string }) {
  return (
    <a
 className={`ppv-game${card.maintenance ? ' ppv-game-upkeep' : ''}`}
 href={card.route}
 style={{ ['--pp-pillar' as string]: PILLAR_COLORS[card.segment] }}
    >
      <div className="ppv-game-name">{card.name}</div>
      {card.config && <div className="ppv-game-config">{card.config}</div>}
      <div className="ppv-game-why">{card.why}</div>
      {card.target && <div className="ppv-game-target">{card.target}</div>}
      {/* Only claimed when we actually know. `drill_sessions` reads are scoped
          by RLS to the signed-in user, so on a coach's dashboard this would be
          the coach's own history, not the player's — better silent than wrong. */}
      {lastPlayed && <div className="ppv-game-meta">Last played {lastPlayed}</div>}
    </a>
  );
}

export function PracticePlanSection({
  plan,
  lastPlayed,
}: {
  plan: PracticePlan;
  lastPlayed: Record<string, string>;
}) {
  if (plan.cards.length === 0 && !plan.coachLed) return null;
  return (
    <div>
      <div className="ppv-eyebrow">Practice plan</div>
      {plan.cards.length > 0 && (
        <div className="ppv-plan">
          {plan.cards.map(c => (
            <GameCard key={c.activityId} card={c} lastPlayed={lastPlayed[c.activityId]} />
          ))}
        </div>
      )}
      {plan.coachLed && (
        <div className="ppv-coach" style={{ marginTop: plan.cards.length > 0 ? '10px' : 0 }}>
          <div className="ppv-game-name" style={{ color: 'var(--ash)' }}>
            {PILLAR_LABELS[plan.coachLed.segment]} · no game for this yet
          </div>
          <div className="ppv-game-why">{plan.coachLed.why}</div>
        </div>
      )}
    </div>
  );
}

// ── Monitors ────────────────────────────────────────────────────────────

export function Monitors({ readings }: { readings: SegmentReading[] }) {
  if (readings.length === 0) return null;
  return (
    <div>
      <div className="ppv-eyebrow">Also watching</div>
      <div className="grid gap-2">
        {readings.map(r => (
          <div key={r.segment} className="ppv-monitor" style={pillarStyle(r)}>
            <span className="ppv-monitor-name">{PILLAR_LABELS[r.segment]}</span>
            <span className="ppv-monitor-sg" style={{ color: sgColor(r.sgPerRound) }}>
              {fmtSG(r.sgPerRound)} SG/rd
            </span>
            <span>{pct(r.t5Share)} of Tiger 5</span>
            {r.demoted && <span>{r.demotionNote}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Advanced Analysis ───────────────────────────────────────────────────

/** The seventeen-driver framework, unchanged, collapsed by default. */
export function AdvancedAnalysis({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ppv-advanced">
      <button className="ppv-advanced-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="ppv-advanced-title">Advanced Analysis</span>
        <span className="ppv-advanced-hint">
          Seventeen performance drivers {open ? '▲' : '▼'}
        </span>
      </button>
      {open && <div className="ppv-advanced-body">{children}</div>}
    </div>
  );
}
