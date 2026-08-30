import { describe, expect, it } from 'vitest';
import { shot } from './fixtures';
import {
  isGirAttempt,
  readLossShape,
  runSegmentDiagnosis,
  segmentOf,
  type Segment,
} from '../segmentDiagnosis';
import type { BenchmarkSelection } from '../benchmarks';
import type { ProcessedShot } from '../types';

const BENCH: BenchmarkSelection = { gender: 'male', tier: 'eliteCollege' };
const run = (shots: ProcessedShot[]) => runSegmentDiagnosis(shots, BENCH);
const readingFor = (shots: ProcessedShot[], segment: Segment) =>
  run(shots).all.find(r => r.segment === segment)!;

/** A hole's worth of shots, holing out, so getHoleScores sees a real score. */
function hole(
  opts: { round?: string; hole?: number; par?: number },
  ...shots: Array<Partial<ProcessedShot>>
): ProcessedShot[] {
  const { round = 'round-1', hole: h = 1, par = 4 } = opts;
  return shots.map((s, i) =>
    shot({ roundId: round, holeNumber: h, holePar: par, shotNumber: i + 1, ...s }),
  );
}

/** `n` approach shots at a fixed SG, spread over `rounds` distinct rounds. */
function approaches(n: number, rounds: number, sg: number, extra: Partial<ProcessedShot> = {}) {
  return Array.from({ length: n }, (_, i) =>
    shot({
      roundId: `round-${(i % rounds) + 1}`,
      holeNumber: (i % 18) + 1,
      shotType: 'Approach',
      shotNumber: 2,
      calculatedStrokesGained: sg,
      ...extra,
    }),
  );
}

describe('loss shape', () => {
  it('separates a leak from a blow-up carrying the same total loss', () => {
    const leak = Array.from({ length: 20 }, () =>
      shot({ calculatedStrokesGained: -0.09 }),
    );
    const blowup = [
      ...Array.from({ length: 18 }, () => shot({ calculatedStrokesGained: 0.02 })),
      shot({ calculatedStrokesGained: -1.08 }),
      shot({ calculatedStrokesGained: -1.08 }),
    ];

    const leakTotal = leak.reduce((a, s) => a + s.calculatedStrokesGained, 0);
    const blowupTotal = blowup.reduce((a, s) => a + s.calculatedStrokesGained, 0);
    // Same damage, opposite diagnosis — the whole point of the reading.
    expect(Math.abs(leakTotal - blowupTotal)).toBeLessThan(0.4);

    expect(readLossShape(leak).shape).toBe('leak');
    expect(readLossShape(blowup).shape).toBe('blowup');
  });

  it('reports concentration on the same scale for 3 rounds and 30', () => {
    // A fixed count ("the worst two shots") would collapse over a season; a
    // fraction of the sample must not.
    const pattern = (reps: number) =>
      Array.from({ length: reps }, () => [
        ...Array.from({ length: 9 }, () => shot({ calculatedStrokesGained: -0.02 })),
        shot({ calculatedStrokesGained: -1.0 }),
      ]).flat();

    const small = readLossShape(pattern(3)).concentration;
    const large = readLossShape(pattern(30)).concentration;
    expect(Math.abs(small - large)).toBeLessThan(0.05);
  });

  it('counts a disaster rate independent of the rest of the distribution', () => {
    const shots = [
      ...Array.from({ length: 18 }, () => shot({ calculatedStrokesGained: 0 })),
      shot({ calculatedStrokesGained: -0.9 }),
      shot({ calculatedStrokesGained: -0.7 }),
    ];
    expect(readLossShape(shots).disasterRate).toBeCloseTo(0.1, 5);
  });

  it('refuses to guess a shape below the minimum sample', () => {
    expect(readLossShape([shot({ calculatedStrokesGained: -1 })]).shape).toBe('unknown');
  });
});

describe('segment attribution', () => {
  it('charges a recovery shot to the segment that produced it', () => {
    const shots = hole(
      {},
      { shotType: 'Drive', startingLie: 'Tee', endingLie: 'Recovery', calculatedStrokesGained: -0.8 },
      { shotType: 'Recovery', startingLie: 'Recovery', calculatedStrokesGained: -0.5 },
      { shotType: 'Putt', startingLie: 'Green', startingDistance: 20, endingDistance: 0 },
    );
    const byHole = new Map([['round-1::1', shots]]);
    expect(segmentOf(shots[1], byHole)).toBe('Driving');
    expect(readingFor(shots, 'Driving').sgTotal).toBeCloseTo(-1.3, 5);
  });

  it('keeps a penalised tee shot in Driving and a penalised approach in Approach', () => {
    const shots = [
      ...hole(
        { hole: 1 },
        { shotType: 'Drive', startingLie: 'Tee', hasPenalty: true, calculatedStrokesGained: -1.4 },
        { shotType: 'Approach', calculatedStrokesGained: 0 },
        { shotType: 'Putt', startingLie: 'Green', startingDistance: 10, endingDistance: 0 },
      ),
      ...hole(
        { hole: 2 },
        { shotType: 'Drive', startingLie: 'Tee', calculatedStrokesGained: 0 },
        { shotType: 'Approach', hasPenalty: true, calculatedStrokesGained: -1.4 },
        { shotType: 'Putt', startingLie: 'Green', startingDistance: 10, endingDistance: 0 },
      ),
    ];
    const d = run(shots);
    expect(d.all.find(r => r.segment === 'Driving')!.sgTotal).toBeCloseTo(-1.4, 5);
    expect(d.all.find(r => r.segment === 'Approach')!.sgTotal).toBeCloseTo(-1.4, 5);
    expect(d.all.find(r => r.segment === 'Putting')!.sgTotal).toBeCloseTo(0, 5);
  });

  it('attributes Tiger 5 holes to a segment rather than a flat penalty bucket', () => {
    // A double bogey driven by a tee-shot penalty is a Tiger 5 hole whose root
    // cause is driving. calculateRootCause would file it under `penalties`.
    const shots = hole(
      { par: 4 },
      { shotType: 'Drive', startingLie: 'Tee', hasPenalty: true, calculatedStrokesGained: -1.6 },
      { shotType: 'Approach', calculatedStrokesGained: -0.1 },
      { shotType: 'Approach', calculatedStrokesGained: -0.1 },
      { shotType: 'Putt', startingLie: 'Green', startingDistance: 15, endingDistance: 2 },
      { shotType: 'Putt', startingLie: 'Green', startingDistance: 2, endingDistance: 0 },
      { shotType: 'Putt', startingLie: 'Green', startingDistance: 1, endingDistance: 0 },
    );
    const d = run(shots);
    expect(d.totalT5Holes).toBe(1);
    expect(d.all.find(r => r.segment === 'Driving')!.t5Holes).toBe(1);
    expect(d.all.find(r => r.segment === 'Putting')!.t5Holes).toBe(0);
  });

  it('orders segments Driving, Approach, Putting, Short Game', () => {
    expect(run([shot({})]).all.map(r => r.segment)).toEqual([
      'Driving',
      'Approach',
      'Putting',
      'ShortGame',
    ]);
  });
});

describe('ranking and gates', () => {
  it('names a headline even when every segment is above benchmark', () => {
    const shots = [
      ...approaches(20, 4, 0.05),
      ...Array.from({ length: 20 }, (_, i) =>
        shot({
          roundId: `round-${(i % 4) + 1}`,
          holeNumber: (i % 18) + 1,
          shotType: 'Drive',
          startingLie: 'Tee',
          calculatedStrokesGained: 0.01,
        }),
      ),
    ];
    const d = run(shots);
    expect(d.headline).not.toBeNull();
    expect(d.headline!.segment).toBe('Driving');
    // Named, but labelled as an edge rather than a leak.
    expect(d.headline!.material).toBe(false);
  });

  it('lets Putting lead when driving and approach are at or above benchmark', () => {
    const shots = [
      ...approaches(20, 4, 0.02),
      ...Array.from({ length: 40 }, (_, i) =>
        shot({
          roundId: `round-${(i % 4) + 1}`,
          holeNumber: (i % 18) + 1,
          shotType: 'Putt',
          startingLie: 'Green',
          startingDistance: 8,
          endingDistance: i % 2 === 0 ? 0 : 2,
          shotNumber: 3,
          calculatedStrokesGained: -0.2,
        }),
      ),
    ];
    const d = run(shots);
    expect(d.headline!.segment).toBe('Putting');
    expect(d.headline!.demoted).toBe(false);
  });

  it('demotes Putting when it would otherwise outrank a losing upstream segment', () => {
    // Putting bleeds more than approach, but approach is material — so the
    // putting number is evaluated second, not first.
    const shots = [
      ...approaches(40, 4, -0.06),
      ...Array.from({ length: 40 }, (_, i) =>
        shot({
          roundId: `round-${(i % 4) + 1}`,
          holeNumber: (i % 18) + 1,
          shotType: 'Putt',
          startingLie: 'Green',
          startingDistance: 8,
          endingDistance: 0,
          shotNumber: 3,
          calculatedStrokesGained: -0.2,
        }),
      ),
    ];
    const d = run(shots);
    const putting = d.all.find(r => r.segment === 'Putting')!;
    const approach = d.all.find(r => r.segment === 'Approach')!;
    expect(putting.sgPerRound).toBeLessThan(approach.sgPerRound);
    expect(putting.demoted).toBe(true);
    expect(d.headline!.segment).toBe('Approach');
  });

  it('leaves a healthy downstream segment unmarked rather than calling it demoted', () => {
    const shots = [
      ...approaches(40, 4, -0.3),
      ...Array.from({ length: 24 }, (_, i) =>
        shot({
          roundId: `round-${(i % 4) + 1}`,
          holeNumber: (i % 18) + 1,
          shotType: 'Putt',
          startingLie: 'Green',
          startingDistance: 8,
          endingDistance: 0,
          shotNumber: 3,
          calculatedStrokesGained: 0.01,
        }),
      ),
    ];
    const putting = run(shots).all.find(r => r.segment === 'Putting')!;
    expect(putting.demoted).toBe(false);
    expect(putting.demotionNote).toBeUndefined();
  });

  describe('Gate 2 — the first-putt check', () => {
    /**
     * Holes whose first putt sits at `ft`, reached in regulation.
     *
     * Approach carries a material loss so Gate 2 is reachable at all, while the
     * putting loss stays smaller than it so Gate 1 cannot demote first. That
     * isolates the gate under test: only first-putt distance can move putting.
     */
    const girHoles = (ft: number, threePutt: boolean) =>
      Array.from({ length: 12 }, (_, i) =>
        hole(
          { round: `round-${(i % 4) + 1}`, hole: (i % 18) + 1, par: 4 },
          { shotType: 'Drive', startingLie: 'Tee', calculatedStrokesGained: 0 },
          { shotType: 'Approach', calculatedStrokesGained: -0.5 },
          {
            shotType: 'Putt',
            startingLie: 'Green',
            startingDistance: ft,
            endingDistance: 3,
            calculatedStrokesGained: -0.05,
          },
          ...(threePutt
            ? [
                {
                  shotType: 'Putt' as const,
                  startingLie: 'Green' as const,
                  startingDistance: 3,
                  endingDistance: 1,
                  calculatedStrokesGained: -0.05,
                },
              ]
            : []),
          {
            shotType: 'Putt' as const,
            startingLie: 'Green' as const,
            startingDistance: 1,
            endingDistance: 0,
          },
        ),
      ).flat();

    it('demotes Putting when GIR first putts average beyond 30 ft', () => {
      const d = run(girHoles(34, true));
      const putting = d.all.find(r => r.segment === 'Putting')!;
      expect(d.putting.girFirstPuttAvgFt).toBeGreaterThan(30);
      expect(putting.demoted).toBe(true);
      expect(putting.demotionNote).toMatch(/first putts average/i);
    });

    it('leaves Putting alone when GIR first putts are short', () => {
      const d = run(girHoles(18, true));
      expect(d.putting.girFirstPuttAvgFt).toBeLessThan(30);
      expect(d.all.find(r => r.segment === 'Putting')!.demoted).toBe(false);
    });

    it('measures first-putt distance on greens in regulation only', () => {
      // A chip-on leaves a short first putt at stroke par, which must not be
      // allowed to drag the average down.
      const shots = hole(
        { par: 4 },
        { shotType: 'Drive', startingLie: 'Tee' },
        { shotType: 'Approach', endingLie: 'Rough', endingDistance: 20 },
        { shotType: 'Short Game', startingLie: 'Rough', startingDistance: 20, endingLie: 'Green', endingDistance: 3 },
        { shotType: 'Putt', startingLie: 'Green', startingDistance: 3, endingDistance: 0 },
      );
      const d = run(shots);
      expect(d.putting.girFirstPuttCount).toBe(0);
      expect(d.putting.girFirstPuttAvgFt).toBeNull();
    });
  });

  describe('Gate 3 — short game', () => {
    it('recognises a GIR-attempt short game shot', () => {
      expect(isGirAttempt(shot({ shotType: 'Short Game', holePar: 5, shotNumber: 3 }))).toBe(true);
      expect(isGirAttempt(shot({ shotType: 'Short Game', holePar: 4, shotNumber: 3 }))).toBe(false);
    });

    it('routes a loss on GIR-attempt shots to Route A', () => {
      const shots = Array.from({ length: 12 }, (_, i) =>
        shot({
          roundId: `round-${(i % 4) + 1}`,
          holeNumber: (i % 18) + 1,
          holePar: 5,
          shotNumber: 3,
          shotType: 'Short Game',
          startingLie: 'Fairway',
          startingDistance: 40,
          calculatedStrokesGained: -0.4,
        }),
      );
      const d = run(shots);
      expect(d.shortGame.route).toBe('A');
      expect(d.headline!.segment).toBe('ShortGame');
    });

    it('still lets a severe scrambling loss lead, as Route B', () => {
      // No segment is locked out — the gates are a higher bar, not a wall.
      const shots = Array.from({ length: 12 }, (_, i) =>
        shot({
          roundId: `round-${(i % 4) + 1}`,
          holeNumber: (i % 18) + 1,
          holePar: 4,
          shotNumber: 3,
          shotType: 'Short Game',
          startingLie: 'Rough',
          startingDistance: 20,
          calculatedStrokesGained: -0.5,
        }),
      );
      const d = run(shots);
      expect(d.shortGame.route).toBe('B');
      expect(d.headline!.segment).toBe('ShortGame');
    });
  });

  describe('Gate 4 — Tiger 5 against SG', () => {
    /** A driving blow-up hole: penalty off the tee, double bogey. */
    const wreckedHole = (round: string, h: number) =>
      hole(
        { round, hole: h, par: 4 },
        { shotType: 'Drive', startingLie: 'Tee', hasPenalty: true, calculatedStrokesGained: -1.5 },
        { shotType: 'Approach', calculatedStrokesGained: 0 },
        { shotType: 'Approach', calculatedStrokesGained: 0 },
        { shotType: 'Putt', startingLie: 'Green', startingDistance: 12, endingDistance: 1 },
        { shotType: 'Putt', startingLie: 'Green', startingDistance: 1, endingDistance: 0 },
        { shotType: 'Putt', startingLie: 'Green', startingDistance: 1, endingDistance: 0 },
      );

    /**
     * Filler shots on holes of their own. Each (round, hole) slot holds exactly
     * one shot, so getHoleScores never sees a pile-up it would read as a
     * blown-up hole and count as a phantom Tiger 5 failure.
     */
    const spread = (n: number, firstHole: number, overrides: Partial<ProcessedShot>) =>
      Array.from({ length: n }, (_, i) =>
        shot({
          roundId: `round-${(i % 6) + 1}`,
          holeNumber: firstHole + Math.floor(i / 6),
          ...overrides,
        }),
      );

    /**
     * The scenario the gate exists for: driving loses fewer strokes than
     * approach overall because the failure is rare, but every time it fires it
     * destroys the hole. Approach bleeds more and never blows a hole up.
     */
    const divergent = (wreckedCount: number) => [
      ...spread(36, 7, {
        shotType: 'Approach',
        shotNumber: 2,
        calculatedStrokesGained: -0.25,
      }),
      ...spread(36 - wreckedCount, 13, {
        shotType: 'Drive',
        startingLie: 'Tee',
        calculatedStrokesGained: 0.02,
      }),
      ...Array.from({ length: wreckedCount }, (_, i) =>
        wreckedHole(`round-${(i % 6) + 1}`, (i % 6) + 1),
      ).flat(),
    ];

    it('promotes a segment carrying the scoring damage but not the SG loss', () => {
      const d = run(divergent(6));
      const driving = d.all.find(r => r.segment === 'Driving')!;
      const approach = d.all.find(r => r.segment === 'Approach')!;

      // Approach is the bigger bleed; driving is the bigger wrecker.
      expect(approach.sgPerRound).toBeLessThan(driving.sgPerRound);
      expect(driving.t5Share).toBe(1);

      expect(d.headline!.segment).toBe('Approach');
      expect(d.t5Promoted).not.toBeNull();
      expect(d.t5Promoted!.segment).toBe('Driving');
      // The loss-shape reading names the same phenomenon independently.
      expect(driving.shape).toBe('blowup');
      expect(approach.shape).toBe('leak');
    });

    it('does not fire on a 100% share built from too few holes', () => {
      const d = run(divergent(2));
      expect(d.all.find(r => r.segment === 'Driving')!.t5Share).toBe(1);
      expect(d.totalT5Holes).toBe(2);
      expect(d.t5Promoted).toBeNull();
    });
  });
});

describe('empty and thin inputs', () => {
  it('returns a null headline with no shots', () => {
    const d = run([]);
    expect(d.headline).toBeNull();
    expect(d.totalRounds).toBe(0);
    expect(d.monitors).toEqual([]);
  });

  it('still produces a reading from a single round', () => {
    const d = run(approaches(14, 1, -0.4));
    expect(d.totalRounds).toBe(1);
    expect(d.headline!.segment).toBe('Approach');
  });
});
