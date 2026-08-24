'use client';

/**
 * PlayerPath — prioritised performance drivers.
 *
 * Answers one question: what is driving my scores, and what do I work on first?
 * The engine (lib/golf/driverEngine.ts) does the arithmetic; this file decides
 * what a coach sees first.
 *
 * Every card carries two independent readings that are deliberately not blended:
 * the tier says how far off standard the player is, the strokes-gained figure
 * says what it costs. They can disagree — a Severe driver on a thin population
 * may cost very little — and that disagreement is exactly the judgement a coach
 * needs to make rather than have hidden inside a composite score.
 */

import { useState } from 'react';
import type { DriverEngineResult, DriverResult } from '@/lib/golf/driverEngine';
import { MATERIALITY_SG_PER_ROUND } from '@/lib/golf/driverEngine';
import { PILLAR_COLORS, PILLAR_LABELS, type Pillar, type Tier } from '@/lib/golf/driverSpecs';
import { BENCHMARK_TIER_LABELS, type BenchmarkSelection } from '@/lib/golf/benchmarks';

interface PlayerPathViewProps {
  driverEngine: DriverEngineResult;
  benchmark: BenchmarkSelection;
}

const PILLAR_ORDER: Pillar[] = ['Driving', 'Approach', 'ShortGame', 'Putting'];

const TIER_LABEL: Record<Tier, string> = {
  elite: 'Elite',
  flag: 'Flag',
  severe: 'Severe',
  unrated: 'Unrated',
};

/** Percentages read as rates; SG1 is a count per round. */
function formatMetric(driver: DriverResult): string {
  if (driver.code === 'SG1') return `${driver.metricValue.toFixed(1)} per round`;
  if (driver.code === 'P3') {
    const bias = driver.detail?.bias;
    return `${driver.metricValue.toFixed(0)}pts off balance${bias ? ` · bias ${bias}` : ''}`;
  }
  return `${driver.metricValue.toFixed(1)}%`;
}

function formatThreshold(driver: DriverResult): string | null {
  if (!driver.tierBounds) return null;
  const { elite } = driver.tierBounds;
  const unit = driver.code === 'SG1' ? '' : '%';
  return `${driver.polarity === 'lower' ? '≤' : '≥'} ${elite.toFixed(elite % 1 === 0 ? 0 : 1)}${unit} elite`;
}

const formatSG = (sg: number): string => `${sg > 0 ? '+' : ''}${sg.toFixed(2)}`;

/**
 * Band widths for the threshold meter.
 *
 * The scale runs in the direction the metric improves, so a lower-is-better
 * driver reads elite-first from the left and a higher-is-better driver reads
 * severe-first — the player's marker always moves right as they get worse.
 */
function meterSegments(driver: DriverResult): {
  segments: Array<{ tier: Tier; width: number }>;
  markerPct: number;
  scale: string[];
} | null {
  const bounds = driver.tierBounds;
  if (!bounds) return null;

  if (driver.polarity === 'lower') {
    const max = Math.max(bounds.severe * 1.6, driver.metricValue * 1.15, bounds.severe + 1);
    const pct = (v: number) => Math.min(100, Math.max(0, (v / max) * 100));
    return {
      segments: [
        { tier: 'elite', width: pct(bounds.elite) },
        { tier: 'flag', width: pct(bounds.severe) - pct(bounds.elite) },
        { tier: 'severe', width: 100 - pct(bounds.severe) },
      ],
      markerPct: pct(driver.metricValue),
      scale: ['0', bounds.elite.toFixed(0), bounds.severe.toFixed(0)],
    };
  }

  // Higher-is-better: 0–100% of the rate, worst on the left.
  const pct = (v: number) => Math.min(100, Math.max(0, v));
  return {
    segments: [
      { tier: 'severe', width: pct(bounds.severe) },
      { tier: 'flag', width: pct(bounds.elite) - pct(bounds.severe) },
      { tier: 'elite', width: 100 - pct(bounds.elite) },
    ],
    markerPct: pct(driver.metricValue),
    scale: ['0', bounds.severe.toFixed(0), bounds.elite.toFixed(0), '100'],
  };
}

function TierBadge({ tier }: { tier: Tier }) {
  return <span className={`pp-tier pp-tier-${tier}`}>{TIER_LABEL[tier]}</span>;
}

function ThresholdMeter({ driver }: { driver: DriverResult }) {
  const meter = meterSegments(driver);
  if (!meter) return null;

  return (
    <div className="pp-meter">
      <div className="pp-meter-bar">
        {meter.segments.map(seg => (
          <i
            key={seg.tier}
            className={`pp-seg-${seg.tier}`}
            style={{ width: `${Math.max(0, seg.width)}%` }}
          />
        ))}
        <span className="pp-marker" style={{ left: `${meter.markerPct}%` }} />
      </div>
      <div className="pp-meter-scale">
        {meter.scale.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function DriverFooter({ driver }: { driver: DriverResult }) {
  return (
    <div className="pp-foot">
      <span>
        {driver.sampleSize} shots · {driver.rounds} {driver.rounds === 1 ? 'round' : 'rounds'}
      </span>
      {driver.lowSample && <span style={{ color: 'var(--bogey)' }}>Low sample</span>}
      {driver.provisional && <span style={{ color: 'var(--ash)' }}>Provisional threshold</span>}
      {driver.scoreToParDelta !== null && (
        <span title="Average score to par on holes where this fired, against holes where it did not. Observational context only.">
          {formatSG(driver.scoreToParDelta)} to par on affected holes
        </span>
      )}
    </div>
  );
}

function PrimaryCard({ driver, rank }: { driver: DriverResult; rank: number }) {
  const threshold = formatThreshold(driver);

  return (
    <div
      className="pp-card"
      style={{ ['--pp-pillar' as string]: PILLAR_COLORS[driver.pillar] }}
    >
      <div className="pp-card-top">
        <span>
          {String(rank).padStart(2, '0')} · {PILLAR_LABELS[driver.pillar]} · {driver.code}
        </span>
        <TierBadge tier={driver.tier} />
      </div>

      <div className="pp-name">{driver.name}</div>
      <div className="pp-summary">{driver.summary}</div>

      <div className="pp-metric">
        {formatMetric(driver)}
        {threshold && <span style={{ color: 'var(--ash)' }}> vs {threshold}</span>}
      </div>

      <ThresholdMeter driver={driver} />

      <div>
        <div className="pp-impact">{formatSG(driver.impactSG)}</div>
        <div className="pp-impact-label">Strokes gained / round</div>
      </div>

      {driver.reorderNote && <div className="pp-note">{driver.reorderNote}</div>}

      <DriverFooter driver={driver} />
    </div>
  );
}

function MonitorRow({ driver }: { driver: DriverResult }) {
  return (
    <div
      className="pp-monitor"
      style={{ ['--pp-pillar' as string]: PILLAR_COLORS[driver.pillar] }}
    >
      <strong style={{ color: 'var(--chalk)' }}>{driver.code}</strong>
      <span>{driver.name}</span>
      <span>{formatMetric(driver)}</span>
      <TierBadge tier={driver.tier} />
      <span style={{ color: 'var(--scarlet)' }}>{formatSG(driver.impactSG)} SG/rd</span>
      {driver.lowSample && <span style={{ color: 'var(--bogey)' }}>Low sample</span>}
    </div>
  );
}

function CausalChain({ pillarState }: { pillarState: Record<Pillar, Tier> }) {
  return (
    <div className="pp-chain">
      {PILLAR_ORDER.map((pillar, i) => (
        <div key={pillar} className="pp-chain-step">
          {i > 0 && <span className="pp-chain-arrow">→</span>}
          <span className="pp-chain-dot" style={{ background: PILLAR_COLORS[pillar] }} />
          <span style={{ color: 'var(--chalk)' }}>{PILLAR_LABELS[pillar]}</span>
          <TierBadge tier={pillarState[pillar]} />
        </div>
      ))}
    </div>
  );
}

function SegmentSection({
  pillar,
  drivers,
}: {
  pillar: Pillar;
  drivers: DriverResult[];
}) {
  const [open, setOpen] = useState(true);
  if (drivers.length === 0) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          background: 'var(--shadow)',
          border: 0,
          borderLeft: `3px solid ${PILLAR_COLORS[pillar]}`,
          padding: '12px 16px',
          cursor: 'pointer',
          color: 'var(--chalk)',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {PILLAR_LABELS[pillar]}
          <span style={{ color: 'var(--ash)', marginLeft: '10px', fontWeight: 400 }}>
            {drivers.length}
          </span>
        </span>
        <span style={{ color: 'var(--ash)', fontSize: '11px' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '4px 16px 8px', background: 'var(--obsidian)' }}>
          {drivers.map(driver => (
            <div key={driver.code} className="pp-row">
              <span className="pp-row-code">{driver.code}</span>
              <span>
                <span style={{ color: 'var(--chalk)', fontSize: '13px' }}>{driver.name}</span>
                {driver.lowSample && (
                  <span
                    style={{
                      color: 'var(--bogey)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9.5px',
                      marginLeft: '8px',
                      letterSpacing: '0.1em',
                    }}
                  >
                    LOW SAMPLE
                  </span>
                )}
              </span>
              <span className="pp-row-figures">
                <span style={{ color: 'var(--cement)' }}>{formatMetric(driver)}</span>
                <TierBadge tier={driver.tier} />
                <span style={{ minWidth: '68px', textAlign: 'right' }}>
                  {driver.contextual ? '—' : `${formatSG(driver.impactSG)} SG/rd`}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlayerPathView({ driverEngine, benchmark }: PlayerPathViewProps) {
  const { all, primary, monitoring, pillarState, totalRounds } = driverEngine;

  if (totalRounds === 0) {
    return (
      <div className="content">
        <h4 style={{ marginBottom: '8px', color: 'var(--ash)' }}>Player Path</h4>
        <p style={{ color: 'var(--ash)', fontSize: '13px' }}>
          No rounds in the current filter. Adjust the filters or add a round to see performance
          drivers.
        </p>
      </div>
    );
  }

  const byPillar = (pillar: Pillar) =>
    all
      .filter(d => d.pillar === pillar)
      .sort((a, b) => a.impactSG - b.impactSG);

  return (
    <div className="content">
      <h4 style={{ marginBottom: '4px', color: 'var(--ash)' }}>Player Path</h4>
      <p style={{ fontSize: '12px', color: 'var(--ash)', marginBottom: '18px' }}>
        Ranked by strokes gained against {BENCHMARK_TIER_LABELS[benchmark.tier]} over{' '}
        {totalRounds} {totalRounds === 1 ? 'round' : 'rounds'}. Drivers costing less than{' '}
        {MATERIALITY_SG_PER_ROUND.toFixed(1)} strokes per round are tracked below rather than
        surfaced here.
      </p>

      {primary.length > 0 ? (
        <>
          <div className="grid-cards-3" style={{ gap: '16px', marginBottom: '20px' }}>
            {primary.map((driver, i) => (
              <PrimaryCard key={driver.code} driver={driver} rank={i + 1} />
            ))}
          </div>

          {monitoring.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--ash)',
                  marginBottom: '8px',
                }}
              >
                Monitoring
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {monitoring.map(driver => (
                  <MonitorRow key={driver.code} driver={driver} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            background: 'var(--shadow)',
            padding: '24px',
            marginBottom: '24px',
            color: 'var(--ash)',
          }}
        >
          <p style={{ color: 'var(--chalk)', marginBottom: '6px' }}>
            No driver is costing more than {MATERIALITY_SG_PER_ROUND.toFixed(1)} strokes per round.
          </p>
          <p style={{ fontSize: '12px' }}>
            Every driver is still measured — see the segment detail below.
          </p>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--ash)',
            marginBottom: '8px',
          }}
        >
          Causal chain
        </div>
        <CausalChain pillarState={pillarState} />
      </div>

      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--ash)',
          marginBottom: '8px',
        }}
      >
        All drivers
      </div>
      {PILLAR_ORDER.map(pillar => (
        <SegmentSection key={pillar} pillar={pillar} drivers={byPillar(pillar)} />
      ))}
    </div>
  );
}

export default PlayerPathView;
