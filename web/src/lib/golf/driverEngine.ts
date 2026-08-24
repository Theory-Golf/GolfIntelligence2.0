/**
 * Golf Intelligence — PlayerPath Driver Engine
 *
 * Evaluates the seventeen published drivers against a filtered shot set and
 * returns a prioritised list. Two principles govern the result:
 *
 *   Impact is strokes gained. Because SG is already benchmark-relative, a
 *   negative total on a driver's failing shots *is* the number of strokes lost
 *   against the selected tier. No severity multipliers, no specificity bonuses
 *   — the strokes are the ranking, and every number on a card is reproducible
 *   by hand.
 *
 *   Sample size never suppresses a driver. Reviewing a three-round tournament
 *   must surface the same drivers as a full season. Small populations are
 *   labelled, not hidden.
 */

import type { ProcessedShot } from './types';
import type { BenchmarkSelection } from './benchmarks';
import { getHoleScores } from './calculations';
import {
  DRIVER_SPECS,
  type DriverCode,
  type DriverSpec,
  type EngineContext,
  type Pillar,
  type Qualification,
  type Tier,
  type TierBounds,
  type Tier5Code,
} from './driverSpecs';

/** Minimum cost, in strokes per round, for a driver to warrant practice time. */
export const MATERIALITY_SG_PER_ROUND = 0.3;

export const MAX_PRIMARY = 3;
export const MAX_MONITORING = 2;

export interface DriverResult {
  code: DriverCode;
  pillar: Pillar;
  name: string;
  summary: string;
  /** The driver's rate or count, in its own units. */
  metricValue: number;
  /** The elite edge the metric is measured against. */
  thresholdValue: number | null;
  tierBounds: TierBounds | null;
  tier: Tier;
  polarity: 'lower' | 'higher';
  /** Strokes per round. Negative means strokes lost against the benchmark. */
  impactSG: number;
  /** Observational context only; never influences ranking. */
  scoreToParDelta: number | null;
  /** Size of the metric's denominator. */
  sampleSize: number;
  /** Occurrences of the failure — the meaningful count for event-based drivers. */
  eventCount: number;
  rounds: number;
  lowSample: boolean;
  provisional: boolean;
  contextual: boolean;
  tiger5: Tier5Code[];
  source: string;
  detail?: Record<string, number | string>;
  /** Set when the causal-chain rule moved this driver down the list. */
  reorderNote?: string;
}

export interface DriverEngineResult {
  /** Every driver that produced a population, ranked or not. */
  all: DriverResult[];
  primary: DriverResult[];
  monitoring: DriverResult[];
  pillarState: Record<Pillar, Tier>;
  totalRounds: number;
}

const UPSTREAM_PILLARS: Pillar[] = ['Driving', 'Approach'];
const DOWNSTREAM_PILLARS: Pillar[] = ['ShortGame', 'Putting'];

const TIER_RANK: Record<Tier, number> = {
  unrated: 0,
  elite: 1,
  flag: 2,
  severe: 3,
};

function buildContext(
  shots: ProcessedShot[],
  benchmark: BenchmarkSelection,
): EngineContext {
  const byHole = new Map<string, ProcessedShot[]>();
  shots.forEach(s => {
    const key = `${s.roundId}-${s.holeNumber}`;
    const existing = byHole.get(key);
    if (existing) existing.push(s);
    else byHole.set(key, [s]);
  });
  byHole.forEach(holeShots => holeShots.sort((a, b) => a.shotNumber - b.shotNumber));

  return {
    shots,
    byHole,
    holeScores: getHoleScores(shots),
    benchmark,
    totalRounds: new Set(shots.map(s => s.roundId)).size,
  };
}

/**
 * Place a metric against its two bounds. Flag is everything between them, so
 * every value lands in exactly one band.
 */
function classify(
  metricValue: number,
  bounds: TierBounds,
  polarity: 'lower' | 'higher',
  severeInclusive = false,
): Tier {
  if (polarity === 'lower') {
    const isSevere = severeInclusive
      ? metricValue >= bounds.severe
      : metricValue > bounds.severe;
    if (isSevere) return 'severe';
    return metricValue <= bounds.elite ? 'elite' : 'flag';
  }
  const isSevere = severeInclusive
    ? metricValue <= bounds.severe
    : metricValue < bounds.severe;
  if (isSevere) return 'severe';
  return metricValue >= bounds.elite ? 'elite' : 'flag';
}

function resolveBounds(spec: DriverSpec, ctx: EngineContext): TierBounds | null {
  if (spec.tiers === 'unrated') return null;
  if (spec.tiers === 'derived') return spec.deriveTiers ? spec.deriveTiers(ctx) : null;
  return spec.tiers;
}

/**
 * Average score to par on holes where the driver fired against holes where it
 * did not, controlling for par. Observational context for the card — the ethos
 * papers describe it, but it is untested, so it never enters the ranking.
 */
function scoreToParDelta(q: Qualification, ctx: EngineContext): number | null {
  if (q.impactPopulation.length === 0) return null;

  const firedHoles = new Set(q.impactPopulation.map(s => `${s.roundId}-${s.holeNumber}`));
  let firedSum = 0;
  let firedCount = 0;
  let cleanSum = 0;
  let cleanCount = 0;

  ctx.holeScores.forEach(h => {
    const toPar = h.score - h.par;
    if (firedHoles.has(`${h.roundId}-${h.hole}`)) {
      firedSum += toPar;
      firedCount += 1;
    } else {
      cleanSum += toPar;
      cleanCount += 1;
    }
  });

  if (firedCount === 0 || cleanCount === 0) return null;
  return firedSum / firedCount - cleanSum / cleanCount;
}

function evaluate(spec: DriverSpec, ctx: EngineContext): DriverResult | null {
  const q = spec.qualify(ctx);
  if (!q || q.metricPopulation.length === 0) return null;

  const bounds = resolveBounds(spec, ctx);
  const tier = spec.tierOverride
    ? spec.tierOverride(q, ctx)
    : bounds
      ? classify(q.metricValue, bounds, spec.polarity, spec.severeInclusive)
      : 'unrated';

  const impactSG =
    q.impactPopulation.reduce((sum, s) => sum + s.calculatedStrokesGained, 0) /
    Math.max(1, ctx.totalRounds);

  return {
    code: spec.code,
    pillar: spec.pillar,
    name: spec.name,
    summary: spec.summary,
    metricValue: q.metricValue,
    thresholdValue: bounds ? bounds.elite : null,
    tierBounds: bounds,
    tier,
    polarity: spec.polarity,
    impactSG,
    scoreToParDelta: scoreToParDelta(q, ctx),
    sampleSize: q.metricPopulation.length,
    eventCount: q.impactPopulation.length,
    rounds: ctx.totalRounds,
    lowSample:
      (spec.lowSampleBasis === 'events'
        ? q.impactPopulation.length
        : q.metricPopulation.length) < spec.lowSampleAt,
    provisional: spec.provisional === true,
    contextual: spec.contextual === true,
    tiger5: spec.tiger5,
    source: spec.source,
    detail: q.detail,
  };
}

/** The worst tier reached within each pillar, used for the causal-chain rule. */
function computePillarState(results: DriverResult[]): Record<Pillar, Tier> {
  const state: Record<Pillar, Tier> = {
    Driving: 'unrated',
    Approach: 'unrated',
    ShortGame: 'unrated',
    Putting: 'unrated',
  };
  results.forEach(r => {
    if (TIER_RANK[r.tier] > TIER_RANK[state[r.pillar]]) state[r.pillar] = r.tier;
  });
  return state;
}

/**
 * Golf scoring is sequential, so a downstream deficiency is often an expression
 * of an upstream one. A Short Game or Putting driver may not outrank a Driving
 * or Approach driver whose pillar is itself flagged — directing practice at
 * putting when approach distance is the structural problem is the most costly
 * error in player development.
 */
function applyCausalChain(
  ranked: DriverResult[],
  pillarState: Record<Pillar, Tier>,
): DriverResult[] {
  const upstreamFlagged = UPSTREAM_PILLARS.filter(p => TIER_RANK[pillarState[p]] >= TIER_RANK.flag);
  if (upstreamFlagged.length === 0) return ranked;

  const upstream = ranked.filter(r => UPSTREAM_PILLARS.includes(r.pillar));
  const downstream = ranked.filter(r => DOWNSTREAM_PILLARS.includes(r.pillar));
  if (upstream.length === 0 || downstream.length === 0) return ranked;

  const firstUpstreamIndex = ranked.findIndex(r => UPSTREAM_PILLARS.includes(r.pillar));
  const noted = downstream.map(r => {
    const outranked = ranked.indexOf(r) < firstUpstreamIndex;
    if (!outranked) return r;
    return {
      ...r,
      reorderNote: `Ranked below ${upstreamFlagged.join(' and ')} — upstream deficiencies are evaluated first.`,
    };
  });

  return [...upstream, ...noted];
}

export function runDriverEngine(
  shots: ProcessedShot[],
  benchmark: BenchmarkSelection,
): DriverEngineResult {
  if (shots.length === 0) {
    return {
      all: [],
      primary: [],
      monitoring: [],
      pillarState: {
        Driving: 'unrated',
        Approach: 'unrated',
        ShortGame: 'unrated',
        Putting: 'unrated',
      },
      totalRounds: 0,
    };
  }

  const ctx = buildContext(shots, benchmark);

  // Every driver is evaluated. Nothing is filtered out for having a small
  // population — only for having no population at all.
  const all = DRIVER_SPECS.map(spec => evaluate(spec, ctx)).filter(
    (r): r is DriverResult => r !== null,
  );

  const pillarState = computePillarState(all);

  // The materiality gate is the only gate: is this worth practice time?
  const candidates = all
    .filter(r => !r.contextual)
    .filter(r => r.impactSG <= -MATERIALITY_SG_PER_ROUND)
    .sort((a, b) => a.impactSG - b.impactSG);

  const ordered = applyCausalChain(candidates, pillarState);

  return {
    all,
    primary: ordered.slice(0, MAX_PRIMARY),
    monitoring: ordered.slice(MAX_PRIMARY, MAX_PRIMARY + MAX_MONITORING),
    pillarState,
    totalRounds: ctx.totalRounds,
  };
}
