/**
 * Golf Intelligence — Segment Diagnosis
 *
 * Answers the first of PlayerPath's two questions: which part of the game is
 * costing strokes. The seventeen-driver engine (driverEngine.ts) answers a
 * finer question and keeps doing so underneath; this module sits above it and
 * reports at the four-segment altitude a player can act on.
 *
 * Three readings per segment, deliberately never blended into one score — the
 * same rule the driver cards already follow. Cost says what it costs, Tiger 5
 * says how much scoring damage it did, and loss shape says whether the damage
 * is a slow leak or a few disasters. They are allowed to disagree; where they
 * do (Gate 4) the disagreement is itself the finding.
 */

import type { HoleScore, ProcessedShot, ShotType } from './types';
import type { BenchmarkSelection } from './benchmarks';
import { getHoleScores, calculateApproachByDistance, calculatePuttingByDistance } from './calculations';
import { MATERIALITY_SG_PER_ROUND } from './driverEngine';
import type { Pillar } from './driverSpecs';

// ============================================
// Tuning
//
// Every cut-point below is a judgement call awaiting real player results.
// They live together so retuning is a one-block change that touches no logic.
// ============================================

export const LOSS_SHAPE_TUNING = {
  /** The tail whose share of the loss defines concentration. A fraction, not a
   *  count: "the worst two shots" is a vanishing slice of a season's sample. */
  TAIL_FRACTION: 0.1,
  /** Concentration at or above this, with a healthy median, reads as a blow-up. */
  CONCENTRATION_HIGH: 0.55,
  /** Concentration below this, with a sick median, reads as a leak. */
  CONCENTRATION_LOW: 0.4,
  /** A shot losing more than this is destructive on its own. */
  DISASTER_SG: -0.55,
  /** Median per-shot SG at or below this means the typical shot is off standard. */
  MEDIAN_LEAK_SG: -0.02,
  /** Below this many shots the shape is reported as 'unknown', never guessed. */
  MIN_SHOTS: 12,
} as const;

export const GATE_TUNING = {
  /**
   * Gate 2. Expected putts cross 2.00 near 30 ft on the benchmark curve, so a
   * player should two-putt from there most of the time. Measured on greens in
   * regulation only — all-first-putts is contaminated by chip-ons.
   */
  FIRST_PUTT_STRESS_FT: 30,
  /** A miss split past this is one-way; below it, a two-way miss is no pattern. */
  MISS_BIAS_SHARE: 0.65,
  MISS_BIAS_MIN_SAMPLE: 10,
  /** Gate 4. Share of Tiger 5 root causes that promotes a non-SG-leader. */
  T5_OVERRIDE_SHARE: 0.4,
  /** Gate 4's floor. 100% of two fail holes is noise, not a signal. */
  T5_OVERRIDE_MIN_HOLES: 5,
  /** Share of driving loss from non-driver clubs that makes the bail-out club the story. */
  NON_DRIVER_LOSS_SHARE: 0.4,
} as const;

// ============================================
// Types
// ============================================

export type Segment = Pillar;

/**
 * Scoring order, not the shot order. Putting acts on every hole; ordinary
 * scrambling is usually an effect of the miss that created it. The order sets
 * priority, not permission — any segment can lead (see the gates).
 */
export const SEGMENT_ORDER: Segment[] = ['Driving', 'Approach', 'Putting', 'ShortGame'];

export type LossShape = 'leak' | 'blowup' | 'mixed' | 'unknown';

export interface SegmentReading {
  segment: Segment;
  sgTotal: number;
  sgPerRound: number;
  shotCount: number;
  /** Tiger 5 holes whose worst shot belongs to this segment. */
  t5Holes: number;
  /** That count as a share of all attributed Tiger 5 holes, 0–1. */
  t5Share: number;
  shape: LossShape;
  /** Share of the segment's total loss carried by its worst decile, 0–1. */
  concentration: number;
  /** Share of shots losing more than DISASTER_SG, 0–1. */
  disasterRate: number;
  medianShotSG: number;
  /** Per-shot SG, ascending — the strip plot's data. */
  shotSGs: number[];
  /** Losing at least MATERIALITY_SG_PER_ROUND. A label, never a filter. */
  material: boolean;
  demoted: boolean;
  demotionNote?: string;
}

export type PuttingZoneId = 'make' | 'conversion' | 'lag';

export interface PuttingZoneReading {
  id: PuttingZoneId;
  label: string;
  minFt: number;
  maxFt: number;
  putts: number;
  sgPerRound: number;
  /** Share of misses finishing past the hole, 0–1. Null when unclassified. */
  longMissShare: number | null;
}

export interface PuttingContext {
  /** Average first-putt distance on greens in regulation, in feet. */
  girFirstPuttAvgFt: number | null;
  girFirstPuttCount: number;
  threePuttHoles: number;
  zones: PuttingZoneReading[];
  worstZone: PuttingZoneReading | null;
  /** True when the make zone's loss sits at the short end — Winners Circle territory. */
  shortMakeZone: boolean;
}

export interface ApproachBandReading {
  label: string;
  minY: number;
  maxY: number;
  shots: number;
  sgPerRound: number;
  greenHitPct: number;
  proximityFt: number;
}

export interface ApproachContext {
  bands: ApproachBandReading[];
  worstBand: ApproachBandReading | null;
  /** The worst band's green-hit rate is below the published bound for its distance. */
  missesGreen: boolean;
  within20FtPct: number;
  /** Losing from clean fairway lies — execution, with no lie to blame. */
  fairwayLieWeak: boolean;
}

export interface DrivingContext {
  /** Share of driving's loss coming from non-driver clubs off the tee, 0–1. */
  nonDriverLossShare: number;
  missLeftPct: number;
  missRightPct: number;
  missRecorded: number;
  oneWayMiss: 'Left' | 'Right' | null;
  penaltyRate: number;
}

export interface ShortGameContext {
  /** Shots that were themselves attempts at the green: shotNumber <= par - 2. */
  girAttemptShots: number;
  girAttemptSgPerRound: number;
  scramblingShots: number;
  scramblingSgPerRound: number;
  /** Share of short game shots that follow a missed green, 0–1. */
  routedFromMissedGreen: number;
  /** Which Gate 3 route the loss qualifies under, if any. */
  route: 'A' | 'B' | null;
}

export interface SegmentDiagnosisResult {
  /** Every segment, in SEGMENT_ORDER. */
  all: SegmentReading[];
  headline: SegmentReading | null;
  monitors: SegmentReading[];
  /** Gate 4: a segment promoted by its Tiger 5 share despite not leading on SG. */
  t5Promoted: SegmentReading | null;
  totalRounds: number;
  totalT5Holes: number;
  driving: DrivingContext;
  approach: ApproachContext;
  putting: PuttingContext;
  shortGame: ShortGameContext;
}

// ============================================
// Helpers
// ============================================

const holeKey = (roundId: string, hole: number) => `${roundId}::${hole}`;

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

function median(ns: number[]): number {
  if (ns.length === 0) return 0;
  const s = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

const share = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

/** Shots grouped by hole, each list sorted by shot number. */
function groupByHole(shots: ProcessedShot[]): Map<string, ProcessedShot[]> {
  const map = new Map<string, ProcessedShot[]>();
  shots.forEach(s => {
    const key = holeKey(s.roundId, s.holeNumber);
    const existing = map.get(key);
    if (existing) existing.push(s);
    else map.set(key, [s]);
  });
  map.forEach(list => list.sort((a, b) => a.shotNumber - b.shotNumber));
  return map;
}

const BASE_SEGMENT: Partial<Record<ShotType, Segment>> = {
  Drive: 'Driving',
  Approach: 'Approach',
  'Short Game': 'ShortGame',
  Putt: 'Putting',
};

/**
 * The segment a shot's strokes belong to.
 *
 * A Recovery shot is charged to whatever segment produced the shot before it:
 * a recovery is damage caused upstream, not a skill of its own. `Other` (a long
 * par-5 second) is excluded — it belongs to no segment cleanly.
 *
 * Penalties need no special case here, because the penalised shot already
 * carries its own type: a tee shot that goes out of bounds is still a Drive.
 * The special case lives in the Tiger 5 attribution below, where the existing
 * root-cause engine would file it under a flat `penalties` bucket instead.
 */
export function segmentOf(
  shot: ProcessedShot,
  byHole: Map<string, ProcessedShot[]>,
): Segment | null {
  if (shot.shotType === 'Recovery') {
    const hole = byHole.get(holeKey(shot.roundId, shot.holeNumber));
    const prev = hole?.filter(s => s.shotNumber < shot.shotNumber).pop();
    return prev ? segmentOf(prev, byHole) : 'Driving';
  }
  return BASE_SEGMENT[shot.shotType] ?? null;
}

/**
 * Whether a hole is a Tiger 5 failure.
 *
 * Mirrors the criteria in `calculateRootCause` (calculations.ts) — the five
 * published categories. Reimplemented rather than imported because that
 * function reports penalty as its own root-cause category, which is right for
 * the Tiger 5 view and wrong for a four-segment rollup: it would strand the
 * highest-cost shots in the game under no segment at all.
 */
export function isTiger5FailHole(hole: HoleScore, holeShots: ProcessedShot[]): boolean {
  const threePutt = holeShots.filter(s => s.shotType === 'Putt').length >= 3;
  const par5Bogey = hole.par === 5 && hole.score >= 6;
  const doublePlus = hole.score >= hole.par + 2;
  const shortIronBogey =
    hole.score >= hole.par + 1 &&
    holeShots.some(s => {
      if (s.startingLie === 'Recovery' || s.startingDistance > 125) return false;
      if (hole.par === 3) return s.shotNumber === 1;
      if (hole.par === 4) return s.shotNumber === 2;
      return s.shotNumber === 2 || s.shotNumber === 3;
    });
  const missedGreen = holeShots.some(s => s.shotType === 'Short Game' && s.endingLie !== 'Green');
  return threePutt || par5Bogey || doublePlus || shortIronBogey || missedGreen;
}

/** A short game shot that was itself an attempt at the green. */
export const isGirAttempt = (s: ProcessedShot) =>
  s.shotType === 'Short Game' && s.shotNumber <= s.holePar - 2;

// ============================================
// Loss shape
// ============================================

export interface LossShapeReading {
  shape: LossShape;
  concentration: number;
  disasterRate: number;
  medianShotSG: number;
  shotSGs: number[];
}

/**
 * Is this segment bleeding a little on many shots, or being wrecked by a few?
 *
 * Two players can lose the same strokes per round and need opposite practice:
 * one is below standard on nearly every shot, the other is at standard on all
 * but two. Concentration and the median separate them.
 */
export function readLossShape(shots: ProcessedShot[]): LossShapeReading {
  const sgs = shots.map(s => s.calculatedStrokesGained).sort((a, b) => a - b);
  const empty: LossShapeReading = {
    shape: 'unknown',
    concentration: 0,
    disasterRate: 0,
    medianShotSG: 0,
    shotSGs: sgs,
  };
  if (sgs.length === 0) return empty;

  const totalLoss = sum(sgs.filter(sg => sg < 0));
  const tailSize = Math.max(1, Math.ceil(sgs.length * LOSS_SHAPE_TUNING.TAIL_FRACTION));
  const tailLoss = sum(sgs.slice(0, tailSize).filter(sg => sg < 0));
  const concentration = totalLoss === 0 ? 0 : tailLoss / totalLoss;
  const disasterRate = share(
    sgs.filter(sg => sg < LOSS_SHAPE_TUNING.DISASTER_SG).length,
    sgs.length,
  );
  const medianShotSG = median(sgs);

  if (sgs.length < LOSS_SHAPE_TUNING.MIN_SHOTS) {
    return { ...empty, concentration, disasterRate, medianShotSG };
  }

  const typicalShotIsFine = medianShotSG > LOSS_SHAPE_TUNING.MEDIAN_LEAK_SG;
  let shape: LossShape = 'mixed';
  if (concentration >= LOSS_SHAPE_TUNING.CONCENTRATION_HIGH && typicalShotIsFine) {
    shape = 'blowup';
  } else if (concentration < LOSS_SHAPE_TUNING.CONCENTRATION_LOW && !typicalShotIsFine) {
    shape = 'leak';
  }

  return { shape, concentration, disasterRate, medianShotSG, shotSGs: sgs };
}

// ============================================
// Context builders
// ============================================

export const APPROACH_TUNING = {
  /**
   * Green-hit rate below this reads as "missing greens" rather than "hitting
   * them and finishing far". 55% is the elite bound published for both A1
   * (150–200y) and A2 (50–150y) in driverSpecs.ts — no new GIR number is
   * invented here. Ties go to the directional read, so a band that is weak on
   * both counts routes to line work first.
   */
  GIR_ELITE_PCT: 55,
  /** The wedge/full-swing boundary the prescription splits on. */
  WEDGE_MAX_Y: 125,
} as const;

function buildDrivingContext(shots: ProcessedShot[]): DrivingContext {
  const drives = shots.filter(s => s.shotType === 'Drive');
  const losing = drives.filter(s => s.calculatedStrokesGained < 0);
  const totalLoss = sum(losing.map(s => s.calculatedStrokesGained));
  const nonDriverLoss = sum(
    losing.filter(s => s.clubCategory === 'Non-driver').map(s => s.calculatedStrokesGained),
  );

  const left = drives.filter(s => s.missDirection === 'Left').length;
  const right = drives.filter(s => s.missDirection === 'Right').length;
  const missRecorded = left + right;
  const missLeftPct = share(left, missRecorded) * 100;
  const missRightPct = share(right, missRecorded) * 100;

  let oneWayMiss: 'Left' | 'Right' | null = null;
  if (missRecorded >= GATE_TUNING.MISS_BIAS_MIN_SAMPLE) {
    if (missLeftPct / 100 >= GATE_TUNING.MISS_BIAS_SHARE) oneWayMiss = 'Left';
    else if (missRightPct / 100 >= GATE_TUNING.MISS_BIAS_SHARE) oneWayMiss = 'Right';
  }

  return {
    nonDriverLossShare: totalLoss === 0 ? 0 : nonDriverLoss / totalLoss,
    missLeftPct,
    missRightPct,
    missRecorded,
    oneWayMiss,
    penaltyRate: share(drives.filter(s => s.hasPenalty).length, drives.length) * 100,
  };
}

function buildApproachContext(shots: ProcessedShot[], rounds: number): ApproachContext {
  const bands: ApproachBandReading[] = calculateApproachByDistance(shots).map(b => ({
    label: b.description,
    minY: b.minDistance,
    maxY: b.maxDistance,
    shots: b.totalShots,
    sgPerRound: b.strokesGained / Math.max(1, rounds),
    greenHitPct: b.greenHitPct,
    proximityFt: b.proximity,
  }));

  const populated = bands.filter(b => b.shots > 0);
  const worstBand =
    populated.length === 0
      ? null
      : populated.reduce((worst, b) => (b.sgPerRound < worst.sgPerRound ? b : worst));

  const approaches = shots.filter(s => s.shotType === 'Approach');
  const onGreen = approaches.filter(s => s.endingLie === 'Green');
  const within20FtPct = share(
    onGreen.filter(s => s.endingDistance <= 20).length,
    approaches.length,
  ) * 100;

  // Losing from a clean fairway lie is pure execution — there is no lie to blame.
  const fromFairway = approaches.filter(s => s.startingLie === 'Fairway');
  const fairwayLieWeak =
    fromFairway.length > 0 &&
    sum(fromFairway.map(s => s.calculatedStrokesGained)) / Math.max(1, rounds) <=
      -MATERIALITY_SG_PER_ROUND;

  return {
    bands,
    worstBand,
    missesGreen: worstBand !== null && worstBand.greenHitPct < APPROACH_TUNING.GIR_ELITE_PCT,
    within20FtPct,
    fairwayLieWeak,
  };
}

const PUTTING_ZONES: Array<{ id: PuttingZoneId; label: string; minFt: number; maxFt: number }> = [
  { id: 'make', label: 'Make zone', minFt: 0, maxFt: 12 },
  { id: 'conversion', label: 'Conversion zone', minFt: 13, maxFt: 20 },
  { id: 'lag', label: 'Lag', minFt: 21, maxFt: Number.MAX_SAFE_INTEGER },
];

/** The short end of the make zone, where survival formats bite. */
const SHORT_MAKE_MAX_FT = 6;

function buildPuttingContext(
  shots: ProcessedShot[],
  holeScores: HoleScore[],
  rounds: number,
): PuttingContext {
  const putts = shots.filter(s => s.shotType === 'Putt');
  const byHole = groupByHole(putts);

  let girFirstPuttTotal = 0;
  let girFirstPuttCount = 0;
  let threePuttHoles = 0;

  byHole.forEach(holePutts => {
    if (holePutts.length >= 3) threePuttHoles += 1;
    const first = holePutts[0];
    if (!first) return;
    // Green in regulation: on the putting surface in par - 2 strokes, so the
    // first putt is stroke par - 1 at the latest.
    if (first.shotNumber <= first.holePar - 1) {
      girFirstPuttTotal += first.startingDistance;
      girFirstPuttCount += 1;
    }
  });

  const zones: PuttingZoneReading[] = PUTTING_ZONES.map(z => {
    const inZone = putts.filter(
      s => s.startingDistance >= z.minFt && s.startingDistance <= z.maxFt,
    );
    const missed = inZone.filter(s => s.endingDistance > 0);
    const classified = missed.filter(s => s.puttLongShort !== null);
    return {
      id: z.id,
      label: z.label,
      minFt: z.minFt,
      maxFt: z.maxFt,
      putts: inZone.length,
      sgPerRound: sum(inZone.map(s => s.calculatedStrokesGained)) / Math.max(1, rounds),
      longMissShare:
        classified.length === 0
          ? null
          : share(classified.filter(s => s.puttLongShort === 'Long').length, classified.length),
    };
  });

  const populated = zones.filter(z => z.putts > 0);
  const worstZone =
    populated.length === 0
      ? null
      : populated.reduce((worst, z) => (z.sgPerRound < worst.sgPerRound ? z : worst));

  const makeZonePutts = putts.filter(s => s.startingDistance <= 12);
  const shortLoss = sum(
    makeZonePutts
      .filter(s => s.startingDistance <= SHORT_MAKE_MAX_FT)
      .map(s => s.calculatedStrokesGained),
  );
  const makeZoneLoss = sum(makeZonePutts.map(s => s.calculatedStrokesGained));

  return {
    girFirstPuttAvgFt: girFirstPuttCount === 0 ? null : girFirstPuttTotal / girFirstPuttCount,
    girFirstPuttCount,
    threePuttHoles,
    zones,
    worstZone,
    shortMakeZone: makeZoneLoss < 0 && shortLoss / makeZoneLoss >= 0.5,
  };
}

function buildShortGameContext(
  shots: ProcessedShot[],
  byHole: Map<string, ProcessedShot[]>,
  rounds: number,
): ShortGameContext {
  const shortGame = shots.filter(s => s.shotType === 'Short Game');
  const girAttempts = shortGame.filter(isGirAttempt);
  const scrambling = shortGame.filter(s => !isGirAttempt(s));

  const afterMissedGreen = shortGame.filter(s => {
    const hole = byHole.get(holeKey(s.roundId, s.holeNumber));
    const prev = hole?.filter(o => o.shotNumber < s.shotNumber).pop();
    return !!prev && prev.shotType === 'Approach' && prev.endingLie !== 'Green';
  }).length;

  return {
    girAttemptShots: girAttempts.length,
    girAttemptSgPerRound: sum(girAttempts.map(s => s.calculatedStrokesGained)) / Math.max(1, rounds),
    scramblingShots: scrambling.length,
    scramblingSgPerRound: sum(scrambling.map(s => s.calculatedStrokesGained)) / Math.max(1, rounds),
    routedFromMissedGreen: share(afterMissedGreen, shortGame.length),
    route: null,
  };
}

// ============================================
// Tiger 5 attribution
// ============================================

/**
 * Charge each Tiger 5 failure hole to the segment of its worst shot.
 *
 * This is where the penalty rule earns its place. `calculateRootCause` tests
 * `isPenalty` before it branches on shot type, so a penalised worst shot lands
 * in a flat `penalties` bucket and never reaches driving or approach. Right for
 * the Tiger 5 view, which reports penalty as its own category; wrong here,
 * because it would leave the most destructive shots in the game attributed to
 * no segment at all — and Gate 4 turns on exactly that kind of damage.
 */
function attributeTiger5(
  shots: ProcessedShot[],
  holeScores: HoleScore[],
  byHole: Map<string, ProcessedShot[]>,
): { bySegment: Record<Segment, number>; total: number } {
  const bySegment: Record<Segment, number> = {
    Driving: 0,
    Approach: 0,
    ShortGame: 0,
    Putting: 0,
  };
  let total = 0;

  holeScores.forEach(hole => {
    const holeShots = byHole.get(holeKey(hole.roundId, hole.hole)) ?? [];
    if (holeShots.length === 0) return;
    if (!isTiger5FailHole(hole, holeShots)) return;

    const worst = holeShots.reduce((w, s) =>
      s.calculatedStrokesGained < w.calculatedStrokesGained ? s : w,
    );
    const segment = segmentOf(worst, byHole);
    if (!segment) return;
    bySegment[segment] += 1;
    total += 1;
  });

  return { bySegment, total };
}

// ============================================
// Engine
// ============================================

export function runSegmentDiagnosis(
  shots: ProcessedShot[],
  _benchmark: BenchmarkSelection,
): SegmentDiagnosisResult {
  const totalRounds = new Set(shots.map(s => s.roundId)).size;
  const byHole = groupByHole(shots);
  const holeScores = getHoleScores(shots);

  const empty: SegmentDiagnosisResult = {
    all: [],
    headline: null,
    monitors: [],
    t5Promoted: null,
    totalRounds: 0,
    totalT5Holes: 0,
    driving: buildDrivingContext([]),
    approach: buildApproachContext([], 1),
    putting: buildPuttingContext([], [], 1),
    shortGame: buildShortGameContext([], byHole, 1),
  };
  if (shots.length === 0 || totalRounds === 0) return empty;

  const t5 = attributeTiger5(shots, holeScores, byHole);

  const all: SegmentReading[] = SEGMENT_ORDER.map(segment => {
    const owned = shots.filter(s => segmentOf(s, byHole) === segment);
    const sgTotal = sum(owned.map(s => s.calculatedStrokesGained));
    const shape = readLossShape(owned);
    const sgPerRound = sgTotal / totalRounds;
    return {
      segment,
      sgTotal,
      sgPerRound,
      shotCount: owned.length,
      t5Holes: t5.bySegment[segment],
      t5Share: share(t5.bySegment[segment], t5.total),
      shape: shape.shape,
      concentration: shape.concentration,
      disasterRate: shape.disasterRate,
      medianShotSG: shape.medianShotSG,
      shotSGs: shape.shotSGs,
      material: sgPerRound <= -MATERIALITY_SG_PER_ROUND,
      demoted: false,
    };
  });

  const putting = buildPuttingContext(shots, holeScores, totalRounds);
  const approach = buildApproachContext(shots, totalRounds);
  const driving = buildDrivingContext(shots);
  const shortGame = buildShortGameContext(shots, byHole, totalRounds);

  const read = (segment: Segment) => all.find(r => r.segment === segment)!;
  const losing = (segment: Segment) => read(segment).sgPerRound < 0;

  // ── Gate 1 · Upstream first ────────────────────────────────────────────
  // Putting is demoted below driving or approach only when that upstream
  // segment is actually losing strokes. When both are at or above benchmark,
  // putting can lead outright.
  const upstreamLosing = (['Driving', 'Approach'] as Segment[]).filter(
    s => read(s).material,
  );
  if (upstreamLosing.length > 0) {
    const worstUpstream = Math.min(...upstreamLosing.map(s => read(s).sgPerRound));
    (['Putting', 'ShortGame'] as Segment[]).forEach(s => {
      const r = read(s);
      // Only a segment that would otherwise lead gets demoted. One that already
      // ranks below the upstream loss needs no note — it is simply smaller, and
      // saying "ranked below approach" about a healthy putter is misleading.
      if (r.sgPerRound >= worstUpstream) return;
      r.demoted = true;
      r.demotionNote = `Ranked below ${upstreamLosing.join(' and ')} — upstream deficiencies are evaluated first.`;
    });
  }

  // ── Gate 2 · The first-putt check ──────────────────────────────────────
  // Putting badly from 30 feet is not a putting problem. Measured on greens in
  // regulation only; two-sided, because short first putts with three-putts is a
  // genuine lag driver rather than an approach one.
  const girAvg = putting.girFirstPuttAvgFt;
  if (girAvg !== null && girAvg > GATE_TUNING.FIRST_PUTT_STRESS_FT && read('Approach').material) {
    const r = read('Putting');
    r.demoted = true;
    r.demotionNote = `First putts average ${girAvg.toFixed(0)} ft on greens in regulation — at that distance these numbers are what approach play predicts.`;
  }

  // ── Gate 3 · Short game as a scoring opportunity ───────────────────────
  // Route A is the birdie chance and has a game. Route B is a scrambling loss
  // severe enough to outrank upstream — rare, no game, named honestly. Neither
  // is barred: the order sets priority, not permission.
  const sgReading = read('ShortGame');
  if (sgReading.sgPerRound < 0) {
    const girDominant =
      shortGame.girAttemptSgPerRound <= shortGame.scramblingSgPerRound &&
      shortGame.girAttemptShots > 0;
    shortGame.route = girDominant ? 'A' : 'B';
  }

  // ── Rank ───────────────────────────────────────────────────────────────
  // Relative, not gated: if every segment is at or above benchmark the weakest
  // is still where the next stroke comes from. Materiality is a label.
  const rank = (r: SegmentReading) =>
    (r.demoted ? 1 : 0) * 1000 +
    r.sgPerRound +
    SEGMENT_ORDER.indexOf(r.segment) * 1e-6;
  const ranked = [...all].filter(r => r.shotCount > 0).sort((a, b) => rank(a) - rank(b));

  let headline = ranked[0] ?? null;
  const rest = ranked.slice(1);

  // ── Gate 4 · When Tiger 5 and SG disagree ──────────────────────────────
  // SG counts strokes bled across every shot; Tiger 5 counts holes that got
  // wrecked. They come apart when a failure is rare but catastrophic. The
  // divergence is the finding, not a contradiction to resolve — so the segment
  // carrying the scoring damage is promoted alongside the SG leader.
  let t5Promoted: SegmentReading | null = null;
  if (headline) {
    const candidate = all.find(
      r =>
        r !== headline &&
        r.shotCount > 0 &&
        r.t5Holes >= GATE_TUNING.T5_OVERRIDE_MIN_HOLES &&
        r.t5Share >= GATE_TUNING.T5_OVERRIDE_SHARE &&
        r.t5Share > headline!.t5Share,
    );
    if (candidate) t5Promoted = candidate;
  }

  const monitors = rest.filter(r => r !== t5Promoted).slice(0, 2);

  return {
    all,
    headline,
    monitors,
    t5Promoted,
    totalRounds,
    totalT5Holes: t5.total,
    driving,
    approach,
    putting,
    shortGame,
  };
}
