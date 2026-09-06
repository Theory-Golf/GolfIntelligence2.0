/**
 * Golf Intelligence — PlayerPath Driver Specifications
 *
 * The seventeen performance drivers published in the ethos papers, declared as
 * data rather than scattered through calculation code. Every threshold here is
 * transcribed from a `thresholds` block in a published paper and carries its
 * source, so a reader can trace any number on a card back to the framework.
 *
 * Bands are contiguous by construction: a tier is its two edges, so everything
 * between elite and severe is Flag and no value can fall outside a band.
 *
 * The exception is Putting. P1–P4 have published definitions but no threshold
 * blocks yet — the putting paper is still being written. P1, P2 and P4 derive
 * their bounds from the selected benchmark's expected-putts curve and stay
 * marked provisional; P3 is measured against its 50/50 dispersion target.
 */

import type { HoleScore, ProcessedShot } from './types';
import type { BenchmarkSelection } from './benchmarks';
import { lookupExpectedStrokes } from './benchmarks';

// ============================================
// Types
// ============================================

export type DriverCode =
  | 'D1' | 'D2' | 'D3' | 'D4' | 'D5'
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5'
  | 'SG1' | 'SG2' | 'SG3'
  | 'P1' | 'P2' | 'P3' | 'P4';

export type Pillar = 'Driving' | 'Approach' | 'ShortGame' | 'Putting';

export type Tier5Code = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

/**
 * Rating bands. `unrated` covers a pillar with no drivers in the current filter.
 */
export type Tier = 'elite' | 'flag' | 'severe' | 'unrated';

/**
 * Two boundaries, three contiguous bands.
 *
 * Three numbers would describe four bands and leave a gap with no label — which
 * is exactly what the driving and approach papers do (D1 is elite at <=3% and
 * flagged above 5%, saying nothing about 3-5%). Expressing a tier as its two
 * edges makes that gap impossible to write down: everything between elite and
 * severe is Flag.
 */
export interface TierBounds {
  /** At or beyond this, the driver is Elite. */
  elite: number;
  /** Past this, the driver is Severe. Flag is everything in between. */
  severe: number;
}

export interface EngineContext {
  shots: ProcessedShot[];
  /** Shots grouped by `${roundId}-${holeNumber}`, each sorted by shotNumber. */
  byHole: Map<string, ProcessedShot[]>;
  holeScores: HoleScore[];
  benchmark: BenchmarkSelection;
  totalRounds: number;
}

/**
 * The two populations a driver produces.
 *
 * `metricPopulation` is the denominator of the rate — for D1, every tee shot.
 * `impactPopulation` is the subset exhibiting the failure — for D1, only the
 * tee shots that took a penalty. Strokes-gained impact sums the second, not the
 * first: summing the whole band measures what the band costs, not what the
 * driver costs, which is why today's impact numbers are not interpretable.
 */
export interface Qualification {
  metricPopulation: ProcessedShot[];
  impactPopulation: ProcessedShot[];
  metricValue: number;
  detail?: Record<string, number | string>;
}

export interface DriverSpec {
  code: DriverCode;
  pillar: Pillar;
  name: string;
  /** What the metric measures, shown under the driver name. */
  summary: string;
  /** 'lower' means a smaller metric is better (failure rates). */
  polarity: 'lower' | 'higher';
  /**
   * Numeric bounds, or 'derived' for drivers whose thresholds come from the
   * selected benchmark tier, or 'unrated' where nothing has been published.
   */
  tiers: TierBounds | 'derived' | 'unrated';
  tiger5: Tier5Code[];
  /** Count below which the card shows a Low sample badge. Never a filter. */
  lowSampleAt: number;
  /**
   * What `lowSampleAt` counts.
   *
   * The papers treat these as different questions. Event-based drivers (a
   * penalty, an obstruction) carry guaranteed scoring damage, so three to five
   * *occurrences* already constitute a pattern regardless of how many shots
   * they came from. Rate-based skill drivers need roughly twenty qualifying
   * shots before the *rate* is stable. Comparing a rate driver's threshold
   * against occurrences — or an event driver's against the denominator — asks
   * the wrong question entirely.
   */
  lowSampleBasis: 'events' | 'population';
  /**
   * Whether the severe bound is itself severe.
   *
   * Most papers phrase severe as strictly beyond a value ("> 10%"), which is the
   * default. SG1 is the exception at ">= 7 per round", and 7.0 is exactly
   * reachable (21 shots over 3 rounds), so it opts in rather than relying on a
   * rounding fudge that would display the wrong number.
   */
  severeInclusive?: boolean;
  /** True while thresholds await a published paper. */
  provisional?: boolean;
  /** Excluded from ranking; computed for the segment view only. */
  contextual?: boolean;
  source: string;
  qualify(ctx: EngineContext): Qualification | null;
  /** Overrides the standard tier comparison for drivers that aren't simple rates. */
  tierOverride?(q: Qualification, ctx: EngineContext): Tier;
  /** Derives bounds from the benchmark when `tiers` is 'derived'. */
  deriveTiers?(ctx: EngineContext): TierBounds;
}

// ============================================
// Helpers
// ============================================

/**
 * End distance in yards.
 *
 * Distances are yards EXCEPT when the corresponding lie is Green, where the
 * stored value is feet (types.ts). Every proportional comparison in this file
 * runs through here so both sides of the ratio are the same unit — mixing feet
 * against yards is what made the precision drivers three times too strict.
 */
export function endYards(s: ProcessedShot): number {
  return s.endingLie === 'Green' ? s.endingDistance / 3 : s.endingDistance;
}

/**
 * A percentage, rounded to kill binary-floating-point noise.
 *
 * `(55 / 100) * 100` evaluates to 55.00000000000001, which is enough to push a
 * value sitting exactly on a tier boundary into the wrong band. Rounding to six
 * decimals removes the artefact without touching any real precision.
 */
const rate = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : Math.round((numerator / denominator) * 1e8) / 1e6;

function qualifyRate(
  metricPopulation: ProcessedShot[],
  isFailure: (s: ProcessedShot) => boolean,
  /** 'failure' reports the failure rate; 'success' reports the success rate. */
  report: 'failure' | 'success',
  detail?: Record<string, number | string>,
): Qualification | null {
  if (metricPopulation.length === 0) return null;
  const impactPopulation = metricPopulation.filter(isFailure);
  const failureRate = rate(impactPopulation.length, metricPopulation.length);
  return {
    metricPopulation,
    impactPopulation,
    metricValue: report === 'failure' ? failureRate : 100 - failureRate,
    detail,
  };
}

const teeShots = (ctx: EngineContext) =>
  ctx.shots.filter(s => s.startingLie === 'Tee' && s.holePar >= 4);

/** The shot played immediately after `s` on the same hole, if any. */
function nextShot(ctx: EngineContext, s: ProcessedShot): ProcessedShot | undefined {
  const hole = ctx.byHole.get(`${s.roundId}-${s.holeNumber}`);
  return hole?.find(o => o.shotNumber === s.shotNumber + 1);
}

/** Short game population shared by SG1–SG3: within 50y, not a tee or green start. */
const shortGameShots = (ctx: EngineContext) =>
  ctx.shots.filter(
    s =>
      s.shotType === 'Short Game' &&
      s.startingDistance <= 50 &&
      (s.startingLie === 'Fairway' || s.startingLie === 'Rough' || s.startingLie === 'Sand'),
  );

const puttsBetween = (ctx: EngineContext, minFt: number, maxFt: number) =>
  ctx.shots.filter(
    s => s.shotType === 'Putt' && s.startingDistance >= minFt && s.startingDistance < maxFt,
  );

const isMade = (s: ProcessedShot): boolean => s.endingDistance === 0;

/**
 * Expected putts at a distance for the selected tier, read from the same curve
 * that powers strokes gained.
 */
function expectedPutts(ctx: EngineContext, feet: number): number {
  return lookupExpectedStrokes(ctx.benchmark, feet, 'Green');
}

/**
 * Make-rate bounds derived from the benchmark curve.
 *
 * Inside 15ft three-putts are close to zero, so expected putts decompose as
 * `makeRate * 1 + (1 - makeRate) * 2`, giving `makeRate ~= 2 - expectedPutts`.
 * The elite bound is that benchmark rate; flag and severe sit a proportion
 * below it, since the papers publish no explicit putting bands.
 */
function deriveMakeRateTiers(ctx: EngineContext, midpointFt: number): TierBounds {
  const benchmarkMakeRate = Math.max(0, (2 - expectedPutts(ctx, midpointFt)) * 100);
  return { elite: benchmarkMakeRate, severe: benchmarkMakeRate * 0.6 };
}

// ============================================
// Driving — driving-performance-drivers
// ============================================

const DRIVING: DriverSpec[] = [
  {
    code: 'D1',
    pillar: 'Driving',
    name: 'Tee Shot Penalty Rate',
    summary: 'All tee shots, par 4 and 5. Rate resulting in a penalty stroke.',
    polarity: 'lower',
    tiers: { elite: 3, severe: 10 },
    tiger5: ['T1', 'T2'],
    lowSampleAt: 3,
    lowSampleBasis: 'events',
    source: 'driving-performance-drivers · D1',
    qualify: ctx => qualifyRate(teeShots(ctx), s => s.hasPenalty, 'failure'),
  },
  {
    code: 'D2',
    pillar: 'Driving',
    name: 'Distance Deficiency',
    summary: 'Fairway tee shots. Share that still lost value against the benchmark.',
    polarity: 'lower',
    tiers: { elite: 10, severe: 35 },
    tiger5: ['T1', 'T2'],
    lowSampleAt: 20,
    lowSampleBasis: 'population',
    source: 'driving-performance-drivers · D2',
    qualify: ctx => {
      const pop = teeShots(ctx).filter(s => s.endingLie === 'Fairway');
      const nonDriver = pop.filter(
        s => s.calculatedStrokesGained < 0 && s.clubCategory === 'Non-driver',
      ).length;
      const negative = pop.filter(s => s.calculatedStrokesGained < 0).length;
      // The paper's two mutually exclusive tags: a high non-driver share points
      // at club selection, otherwise the deficit is physical.
      const nonDriverShare = rate(nonDriver, negative);
      return qualifyRate(pop, s => s.calculatedStrokesGained < 0, 'failure', {
        tag: nonDriverShare > 15 ? 'Driver Underuse Suspected' : 'True Distance Deficit',
        nonDriverShare: Number(nonDriverShare.toFixed(1)),
      });
    },
  },
  {
    code: 'D3',
    pillar: 'Driving',
    name: 'Recovery Rate',
    summary: 'Tee shots, penalties excluded. Rate finishing in a recovery lie.',
    polarity: 'lower',
    tiers: { elite: 3, severe: 15 },
    tiger5: ['T1', 'T2'],
    lowSampleAt: 20,
    lowSampleBasis: 'population',
    source: 'driving-performance-drivers · D3',
    qualify: ctx => {
      const pop = teeShots(ctx).filter(s => !s.hasPenalty);
      const recoveries = pop.filter(s => s.endingLie === 'Recovery');
      const nonDriverShare = rate(
        recoveries.filter(s => s.clubCategory === 'Non-driver').length,
        recoveries.length,
      );
      return qualifyRate(pop, s => s.endingLie === 'Recovery', 'failure', {
        tag:
          nonDriverShare > 15
            ? 'Conservative Club Not Reducing Risk'
            : 'Dispersion Problem',
      });
    },
  },
  {
    code: 'D4',
    pillar: 'Driving',
    name: 'Rough Penalty on Long Second Shots',
    summary: 'Fires only when fairway accuracy and long rough second shots compound.',
    polarity: 'lower',
    // Two-condition trigger with severity by dominant band, not a rate against
    // bounds — see tierOverride. The paper publishes no elite level.
    tiers: { elite: 0, severe: 50 },
    tiger5: ['T1', 'T2'],
    lowSampleAt: 20,
    lowSampleBasis: 'population',
    source: 'driving-performance-drivers · D4',
    qualify: ctx => {
      const drives = teeShots(ctx).filter(
        s => !s.hasPenalty && s.endingLie !== 'Recovery',
      );
      if (drives.length === 0) return null;

      const fairwayRate = rate(drives.filter(s => s.endingLie === 'Fairway').length, drives.length);

      const roughSeconds = ctx.shots.filter(
        s => s.shotNumber === 2 && s.startingLie === 'Rough',
      );
      if (roughSeconds.length === 0) return null;

      const longRough = roughSeconds.filter(s => s.startingDistance > 150);
      const longShare = rate(longRough.length, roughSeconds.length);

      // Both conditions must hold simultaneously; a long hitter who misses
      // fairways but stays under 150y does not trigger D4, and neither does an
      // accurate short hitter.
      if (fairwayRate >= 40 || longShare <= 50) return null;

      const beyond175 = longRough.filter(s => s.startingDistance > 175).length;
      return {
        metricPopulation: roughSeconds,
        impactPopulation: longRough,
        metricValue: longShare,
        detail: {
          fairwayRate: Number(fairwayRate.toFixed(1)),
          dominantBand: beyond175 > longRough.length / 2 ? 'beyond 175y' : '150-175y',
        },
      };
    },
    tierOverride: q => (q.detail?.dominantBand === 'beyond 175y' ? 'severe' : 'flag'),
  },
  {
    code: 'D5',
    pillar: 'Driving',
    name: 'Sand Rate, Scoring Zone',
    summary: 'Tee shots leaving a second shot in sand between 60 and 120 yards.',
    polarity: 'lower',
    tiers: { elite: 2, severe: 8 },
    tiger5: ['T1', 'T2'],
    lowSampleAt: 3,
    lowSampleBasis: 'events',
    source: 'driving-performance-drivers · D5',
    qualify: ctx =>
      qualifyRate(
        teeShots(ctx),
        s => {
          const next = nextShot(ctx, s);
          return (
            !!next &&
            next.startingLie === 'Sand' &&
            next.startingDistance >= 60 &&
            next.startingDistance <= 120
          );
        },
        'failure',
      ),
  },
];

// ============================================
// Approach — approach-performance-drivers
// ============================================

const APPROACH_SKILL_LIES = ['Tee', 'Fairway'];
const APPROACH_RISK_LIES = ['Tee', 'Fairway', 'Rough', 'Sand'];

const APPROACH: DriverSpec[] = [
  {
    code: 'A1',
    pillar: 'Approach',
    name: 'Long Approach GIR',
    summary: '150–200 yards from tee or fairway. Strict putting surface, fringe excluded.',
    polarity: 'higher',
    tiers: { elite: 55, severe: 25 },
    tiger5: ['T1', 'T2'],
    lowSampleAt: 20,
    lowSampleBasis: 'population',
    source: 'approach-performance-drivers · A1',
    qualify: ctx => {
      const pop = ctx.shots.filter(
        s =>
          s.shotType === 'Approach' &&
          APPROACH_SKILL_LIES.includes(s.startingLie) &&
          s.startingDistance >= 150 &&
          s.startingDistance <= 200,
      );
      const band1 = pop.filter(s => s.startingDistance < 175);
      return qualifyRate(pop, s => s.endingLie !== 'Green', 'success', {
        band1Gir: Number(rate(band1.filter(s => s.endingLie === 'Green').length, band1.length).toFixed(1)),
        band1Shots: band1.length,
      });
    },
  },
  {
    code: 'A2',
    pillar: 'Approach',
    name: 'Short Approach Scoring Position',
    summary: '50–150 yards. On the green inside 20ft, or off it within 6 yards of the pin.',
    polarity: 'higher',
    tiers: { elite: 55, severe: 25 },
    tiger5: ['T3', 'T1', 'T2', 'T4'],
    lowSampleAt: 20,
    lowSampleBasis: 'population',
    source: 'approach-performance-drivers · A2',
    qualify: ctx => {
      // Sand is excluded from the starting population: its scoring variance is
      // largely independent of proximity and would distort the measure.
      const pop = ctx.shots.filter(
        s =>
          s.shotType === 'Approach' &&
          ['Tee', 'Fairway', 'Rough'].includes(s.startingLie) &&
          s.startingDistance >= 50 &&
          s.startingDistance <= 150,
      );
      const inPosition = (s: ProcessedShot) =>
        s.endingLie === 'Green' ? s.endingDistance <= 20 : endYards(s) <= 6;
      // Approaches finishing beyond 40ft are the paper's three-putt exposure flag.
      const beyond40 = pop.filter(s => s.endingLie === 'Green' && s.endingDistance > 40).length;
      return qualifyRate(pop, s => !inPosition(s), 'success', {
        threePuttExposure: beyond40,
      });
    },
  },
  {
    code: 'A3',
    pillar: 'Approach',
    name: 'Approach Precision Rate',
    summary: '50–200 yards. Finishes within 20% of the distance it started from.',
    polarity: 'higher',
    tiers: { elite: 55, severe: 25 },
    tiger5: ['T1', 'T2', 'T4'],
    lowSampleAt: 20,
    lowSampleBasis: 'population',
    source: 'approach-performance-drivers · A3',
    qualify: ctx => {
      const pop = ctx.shots.filter(
        s =>
          s.shotType === 'Approach' &&
          APPROACH_SKILL_LIES.includes(s.startingLie) &&
          s.startingDistance >= 50 &&
          s.startingDistance <= 200,
      );
      // A dimensionless ratio: end distance over start distance, both in yards.
      // A shot finishing on the green is stored in feet, so endYards converts it
      // first — comparing a feet value against a yards value would make the bar
      // three times tighter than intended.
      return qualifyRate(pop, s => endYards(s) > 0.2 * s.startingDistance, 'success');
    },
  },
  {
    code: 'A4',
    pillar: 'Approach',
    name: 'Approach Penalty Rate',
    summary: '50–230 yards, all playable lies. Rate resulting in a penalty stroke.',
    polarity: 'lower',
    tiers: { elite: 2, severe: 8 },
    tiger5: ['T2', 'T1', 'T4'],
    lowSampleAt: 3,
    lowSampleBasis: 'events',
    source: 'approach-performance-drivers · A4',
    qualify: ctx => {
      const pop = ctx.shots.filter(
        s =>
          s.shotType === 'Approach' &&
          APPROACH_RISK_LIES.includes(s.startingLie) &&
          s.startingDistance >= 50 &&
          s.startingDistance <= 230,
      );
      const penalties = pop.filter(s => s.hasPenalty);
      // Tee and fairway penalties read as execution; rough and sand as decision.
      const fromTrouble = penalties.filter(s =>
        ['Rough', 'Sand'].includes(s.startingLie),
      ).length;
      return qualifyRate(pop, s => s.hasPenalty, 'failure', {
        tag: fromTrouble > penalties.length / 2 ? 'Decision-making' : 'Execution',
      });
    },
  },
  {
    code: 'A5',
    pillar: 'Approach',
    name: 'Approach Obstruction Rate',
    summary: 'Non-penalty misses severe enough to functionally destroy the hole.',
    polarity: 'lower',
    tiers: { elite: 4, severe: 10 },
    tiger5: ['T1', 'T2', 'T4'],
    lowSampleAt: 3,
    lowSampleBasis: 'events',
    source: 'approach-performance-drivers · A5',
    qualify: ctx => {
      const pop = ctx.shots.filter(
        s =>
          s.shotType === 'Approach' &&
          APPROACH_RISK_LIES.includes(s.startingLie) &&
          s.startingDistance >= 50 &&
          s.startingDistance <= 230 &&
          !s.hasPenalty,
      );
      // Same yards-over-yards ratio as A3, at 25%.
      return qualifyRate(
        pop,
        s => s.endingLie === 'Recovery' || endYards(s) > 0.25 * s.startingDistance,
        'failure',
      );
    },
  },
];

// ============================================
// Short Game — short-game-performance-drivers
// ============================================

const SHORT_GAME: DriverSpec[] = [
  {
    code: 'SG1',
    pillar: 'ShortGame',
    name: 'Frequency & Routing Signal',
    summary: 'Short game volume per round, and how much of it follows a missed green.',
    polarity: 'lower',
    tiers: { elite: 2, severe: 7 },
    // The paper's severe level is ">= 7 per round", not "> 7".
    severeInclusive: true,
    tiger5: [],
    lowSampleAt: 0,
    lowSampleBasis: 'population',
    // Volume, not execution: it says whether short game is even worth practising
    // right now. It contextualises SG2 and SG3 without gating them, so it is
    // reported in the segment view but never competes for a ranked slot.
    contextual: true,
    source: 'short-game-performance-drivers · SG1',
    qualify: ctx => {
      const pop = shortGameShots(ctx);
      if (pop.length === 0) return null;
      const afterMissedGreen = pop.filter(s => {
        const hole = ctx.byHole.get(`${s.roundId}-${s.holeNumber}`);
        const prev = hole?.find(o => o.shotNumber === s.shotNumber - 1);
        return (
          !!prev &&
          prev.shotType === 'Approach' &&
          prev.startingDistance >= 50 &&
          prev.endingLie !== 'Green'
        );
      }).length;
      return {
        metricPopulation: pop,
        impactPopulation: [],
        metricValue: pop.length / Math.max(1, ctx.totalRounds),
        detail: { routedFromMissedGreen: Number(rate(afterMissedGreen, pop.length).toFixed(1)) },
      };
    },
  },
  {
    code: 'SG2',
    pillar: 'ShortGame',
    name: 'Second Attempt Conversion',
    summary: 'Once a second short game shot was needed, how often trouble stopped there.',
    polarity: 'higher',
    tiers: { elite: 90, severe: 70 },
    tiger5: ['T5'],
    lowSampleAt: 10,
    lowSampleBasis: 'population',
    source: 'short-game-performance-drivers · SG2',
    qualify: ctx => {
      const byHoleKey = new Map<string, ProcessedShot[]>();
      shortGameShots(ctx).forEach(s => {
        const key = `${s.roundId}-${s.holeNumber}`;
        byHoleKey.set(key, [...(byHoleKey.get(key) ?? []), s]);
      });

      const qualifyingHoles = [...byHoleKey.entries()].filter(([, sgShots]) => sgShots.length >= 2);
      if (qualifyingHoles.length === 0) return null;

      const metricPopulation: ProcessedShot[] = [];
      const impactPopulation: ProcessedShot[] = [];
      let converted = 0;

      qualifyingHoles.forEach(([key, sgShots]) => {
        const ordered = [...sgShots].sort((a, b) => a.shotNumber - b.shotNumber);
        const second = ordered[1];
        const score = ctx.holeScores.find(
          h => `${h.roundId}-${h.hole}` === key,
        )?.score;
        if (score === undefined) return;

        metricPopulation.push(second);
        // Strokes left after the second attempt: holed out, or a single putt.
        const strokesRemaining = score - second.shotNumber;
        if (strokesRemaining <= 1) converted += 1;
        else impactPopulation.push(...ordered);
      });

      if (metricPopulation.length === 0) return null;
      return {
        metricPopulation,
        impactPopulation,
        metricValue: rate(converted, metricPopulation.length),
      };
    },
  },
  {
    code: 'SG3',
    pillar: 'ShortGame',
    name: 'Fairway Precision Rate',
    summary: 'The no-excuse shot: a clean fairway lie inside 25 yards, finishing within 5ft.',
    polarity: 'higher',
    tiers: { elite: 75, severe: 50 },
    tiger5: ['T5'],
    lowSampleAt: 10,
    lowSampleBasis: 'population',
    source: 'short-game-performance-drivers · SG3',
    qualify: ctx => {
      const pop = ctx.shots.filter(
        s =>
          s.shotType === 'Short Game' &&
          s.startingLie === 'Fairway' &&
          s.startingDistance <= 25 &&
          s.shotNumber > s.holePar - 2,
      );
      return qualifyRate(
        pop,
        s => !(s.endingLie === 'Green' && s.endingDistance <= 5),
        'success',
      );
    },
  },
];

// ============================================
// Putting — definitions published, thresholds pending
// ============================================

const PUTTING: DriverSpec[] = [
  {
    code: 'P1',
    pillar: 'Putting',
    name: 'Short Make Rate',
    summary: '5–10 feet. The most costly per-stroke putting failure in competitive golf.',
    polarity: 'higher',
    tiers: 'derived',
    tiger5: ['T3'],
    lowSampleAt: 20,
    lowSampleBasis: 'population',
    provisional: true,
    source: 'Derived from the benchmark putt curve; awaiting the putting paper',
    deriveTiers: ctx => deriveMakeRateTiers(ctx, 7.5),
    qualify: ctx => qualifyRate(puttsBetween(ctx, 5, 10), s => !isMade(s), 'success'),
  },
  {
    code: 'P2',
    pillar: 'Putting',
    name: 'Mid Make Rate',
    summary: '10–15 feet. The upper boundary of the high-make-priority zone.',
    polarity: 'higher',
    tiers: 'derived',
    tiger5: ['T3'],
    lowSampleAt: 20,
    lowSampleBasis: 'population',
    provisional: true,
    source: 'Derived from the benchmark putt curve; awaiting the putting paper',
    deriveTiers: ctx => deriveMakeRateTiers(ctx, 12.5),
    qualify: ctx => qualifyRate(puttsBetween(ctx, 10, 15), s => !isMade(s), 'success'),
  },
  {
    code: 'P3',
    pillar: 'Putting',
    name: 'Speed Window: Lag',
    summary:
      '15–40 feet. Misses should split evenly long and short — balanced dispersion is what good speed control looks like, and it maximises make probability.',
    polarity: 'lower',
    // Distance from a 50/50 split, in percentage points. The bounds are
    // anchored rather than picked: under a true 50/50 the sampling spread at
    // roughly 25 lag putts is about 10 points, so a small deviation is not
    // distinguishable from perfect control, while 20 points is a clear bias.
    tiers: { elite: 5, severe: 20 },
    tiger5: ['T3'],
    lowSampleAt: 20,
    lowSampleBasis: 'population',
    source: 'Definition published; bounds set against a 50/50 dispersion target',
    qualify: ctx => {
      const pop = puttsBetween(ctx, 15, 40).filter(s => !isMade(s));
      if (pop.length === 0) return null;
      const short = pop.filter(s => s.puttLongShort === 'Short').length;
      const long = pop.filter(s => s.puttLongShort === 'Long').length;
      const classified = short + long;
      if (classified === 0) return null;
      const shortShare = rate(short, classified);
      return {
        metricPopulation: pop,
        impactPopulation: pop.filter(s => s.calculatedStrokesGained < 0),
        // Deviation from a balanced 50/50 dispersion, in percentage points.
        // Symmetric: a long bias and a short bias of the same size rate the
        // same, but the card names the direction because the fix differs.
        metricValue: Math.abs(shortShare - 50),
        detail: {
          shortShare: Number(shortShare.toFixed(1)),
          classified,
          bias: shortShare > 50 ? 'short' : 'long',
        },
      };
    },
  },
  {
    code: 'P4',
    pillar: 'Putting',
    name: 'Speed Window: Long Lag',
    summary: '40 feet and beyond. Three-putt rate, the clearest distance-control failure.',
    polarity: 'lower',
    tiers: 'derived',
    tiger5: ['T3'],
    lowSampleAt: 10,
    lowSampleBasis: 'population',
    provisional: true,
    source: 'Derived from the benchmark putt curve; awaiting the putting paper',
    deriveTiers: ctx => {
      // Beyond 40ft makes are close to zero, so expected putts decompose as
      // `2 + threePuttRate`, giving the benchmark rate directly.
      const benchmark = Math.max(0, (expectedPutts(ctx, 40) - 2) * 100);
      return { elite: benchmark, severe: benchmark * 2 };
    },
    qualify: ctx => {
      const longPutts = puttsBetween(ctx, 40, Number.MAX_SAFE_INTEGER);
      if (longPutts.length === 0) return null;
      const threePutted = new Set(
        ctx.holeScores
          .filter(h => h.shots.filter(s => s.shotType === 'Putt').length >= 3)
          .map(h => `${h.roundId}-${h.hole}`),
      );
      return qualifyRate(
        longPutts,
        s => threePutted.has(`${s.roundId}-${s.holeNumber}`),
        'failure',
      );
    },
  },
];

export const DRIVER_SPECS: DriverSpec[] = [...DRIVING, ...APPROACH, ...SHORT_GAME, ...PUTTING];

export const SPECS_BY_CODE: Record<DriverCode, DriverSpec> = Object.fromEntries(
  DRIVER_SPECS.map(spec => [spec.code, spec]),
) as Record<DriverCode, DriverSpec>;

export const PILLAR_LABELS: Record<Pillar, string> = {
  Driving: 'Driving',
  Approach: 'Approach',
  ShortGame: 'Short Game',
  Putting: 'Putting',
};

/** Segment identity colours are fixed by the brand system and never re-tinted. */
export const PILLAR_COLORS: Record<Pillar, string> = {
  Driving: 'var(--seg-drive)',
  Approach: 'var(--seg-approach)',
  ShortGame: 'var(--seg-shortgame)',
  Putting: 'var(--c1)',
};
