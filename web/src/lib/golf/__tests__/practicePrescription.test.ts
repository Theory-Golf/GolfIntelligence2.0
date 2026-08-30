import { describe, expect, it } from 'vitest';
import { shot } from './fixtures';
import { runSegmentDiagnosis } from '../segmentDiagnosis';
import { buildPracticePlan } from '../practicePrescription';
import { ACTIVITY_ROUTES, isBuilt } from '../../../data/practiceActivities';
import type { BenchmarkSelection } from '../benchmarks';
import type { ProcessedShot } from '../types';

const BENCH: BenchmarkSelection = { gender: 'male', tier: 'eliteCollege' };
const plan = (shots: ProcessedShot[]) => buildPracticePlan(runSegmentDiagnosis(shots, BENCH));

/** Shots on holes of their own, so no fixture reads as a blown-up hole. */
function spread(n: number, firstHole: number, overrides: Partial<ProcessedShot>) {
  return Array.from({ length: n }, (_, i) =>
    shot({
      roundId: `round-${(i % 6) + 1}`,
      holeNumber: firstHole + Math.floor(i / 6),
      ...overrides,
    }),
  );
}

const drives = (n: number, overrides: Partial<ProcessedShot>) =>
  spread(n, 1, { shotType: 'Drive', startingLie: 'Tee', ...overrides });

const approach = (n: number, overrides: Partial<ProcessedShot>) =>
  spread(n, 1, { shotType: 'Approach', shotNumber: 2, startingLie: 'Fairway', ...overrides });

const putts = (n: number, overrides: Partial<ProcessedShot>) =>
  spread(n, 1, { shotType: 'Putt', startingLie: 'Green', shotNumber: 3, ...overrides });

describe('driving', () => {
  it('turns shape mode ON for a leak — the baseline is already there', () => {
    const { cards } = plan(drives(36, { calculatedStrokesGained: -0.3 }));
    expect(cards[0].activityId).toBe('driver-standard');
    expect(cards[0].config).toMatch(/Shape mode ON/);
  });

  it('turns shape mode OFF for a blow-up — strip the interference', () => {
    const shots = [
      ...drives(30, { calculatedStrokesGained: 0.02 }),
      ...spread(6, 6, {
        shotType: 'Drive',
        startingLie: 'Tee',
        hasPenalty: true,
        calculatedStrokesGained: -1.6,
      }),
    ];
    const { cards } = plan(shots);
    expect(cards[0].activityId).toBe('driver-standard');
    expect(cards[0].config).toMatch(/Shape mode OFF/);
  });

  it('sends the player out without the driver when the bail-out club is the loss', () => {
    const { cards } = plan(
      drives(36, { clubCategory: 'Non-driver', calculatedStrokesGained: -0.3 }),
    );
    expect(cards[0].config).toMatch(/without the driver/i);
    expect(cards[0].why).toMatch(/bail-out club/i);
  });

  it('asks a one-way miss to be reversed, not merely reduced', () => {
    const shots = [
      ...spread(27, 1, {
        shotType: 'Drive',
        startingLie: 'Tee',
        missDirection: 'Left',
        calculatedStrokesGained: -0.3,
      }),
      ...spread(9, 6, {
        shotType: 'Drive',
        startingLie: 'Tee',
        missDirection: 'Right',
        calculatedStrokesGained: -0.3,
      }),
    ];
    const { cards } = plan(shots);
    expect(cards[0].target).toMatch(/reverse it/i);
    expect(cards[0].target).toMatch(/under 25% left/i);
  });

  it('says nothing about a two-way miss', () => {
    const shots = [
      ...spread(18, 1, {
        shotType: 'Drive',
        startingLie: 'Tee',
        missDirection: 'Left',
        calculatedStrokesGained: -0.3,
      }),
      ...spread(18, 4, {
        shotType: 'Drive',
        startingLie: 'Tee',
        missDirection: 'Right',
        calculatedStrokesGained: -0.3,
      }),
    ];
    expect(plan(shots).cards[0].target).not.toMatch(/reverse/i);
  });
});

describe('approach', () => {
  it('routes a directional wedge miss to the Line Test wedges band', () => {
    // Inside 125 and missing greens: start line, not distance control.
    const { cards } = plan(
      approach(36, {
        startingDistance: 90,
        endingLie: 'Rough',
        endingDistance: 18,
        calculatedStrokesGained: -0.3,
      }),
    );
    expect(cards[0].activityId).toBe('line-test');
    expect(cards[0].config).toMatch(/Wedges band/);
  });

  it('routes a wedge proximity problem to the Wedge Standard', () => {
    // Inside 125, hitting greens, finishing far.
    const { cards } = plan(
      approach(36, {
        startingDistance: 90,
        endingLie: 'Green',
        endingDistance: 34,
        calculatedStrokesGained: -0.3,
      }),
    );
    expect(cards[0].activityId).toBe('wedge-standard');
    expect(cards[0].why).toMatch(/distance control/i);
  });

  it('routes a full-swing green-missing problem to the Line Test, naming the yardages', () => {
    const { cards } = plan(
      approach(36, {
        startingDistance: 175,
        endingLie: 'Rough',
        endingDistance: 20,
        calculatedStrokesGained: -0.3,
      }),
    );
    expect(cards[0].activityId).toBe('line-test');
    // A card that does not name the losing bucket is not actionable — the
    // player will set the game up around yardages that are already fine.
    expect(cards[0].config).toMatch(/151–200 y/);
  });

  it('routes a full-swing proximity leak to the Approach Standard', () => {
    const { cards } = plan(
      approach(36, {
        startingDistance: 175,
        endingLie: 'Green',
        endingDistance: 42,
        calculatedStrokesGained: -0.3,
      }),
    );
    expect(cards[0].activityId).toBe('approach-standard');
    expect(cards[0].config).toMatch(/151–200 y/);
  });
});

describe('putting', () => {
  const puttingLoss = (startingDistance: number, extra: Partial<ProcessedShot> = {}) =>
    plan(putts(36, { startingDistance, endingDistance: 2, calculatedStrokesGained: -0.3, ...extra }));

  it('sends the make zone to Inside Ten', () => {
    const { cards } = puttingLoss(9);
    expect(cards.map(c => c.activityId)).toContain('inside-ten');
  });

  it('adds Winners Circle when the loss sits at the short end', () => {
    const { cards } = puttingLoss(5);
    expect(cards.map(c => c.activityId)).toEqual(['inside-ten', 'winners-circle']);
  });

  it('sends the conversion zone to Inside Twenty', () => {
    expect(puttingLoss(16).cards[0].activityId).toBe('inside-twenty');
  });

  it('sends lag to the Lag Putt Test and names the speed bias', () => {
    const { cards } = puttingLoss(38, { puttLongShort: 'Short' });
    expect(cards[0].activityId).toBe('lag-putt-test');
    expect(cards[0].why).toMatch(/run short/i);
  });
});

describe('short game', () => {
  it('routes a GIR-attempt loss to the Wedge Standard', () => {
    const { cards, coachLed } = plan(
      spread(24, 1, {
        shotType: 'Short Game',
        holePar: 5,
        shotNumber: 3,
        startingLie: 'Fairway',
        startingDistance: 40,
        calculatedStrokesGained: -0.4,
      }),
    );
    expect(cards[0].activityId).toBe('wedge-standard');
    expect(coachLed).toBeNull();
  });

  it('names a severe scrambling loss rather than substituting a game', () => {
    // Wedge Standard is a 55-135y full-swing carry test. It does not test this.
    const { cards, coachLed } = plan(
      spread(24, 1, {
        shotType: 'Short Game',
        holePar: 4,
        shotNumber: 3,
        startingLie: 'Rough',
        startingDistance: 20,
        calculatedStrokesGained: -0.4,
      }),
    );
    expect(coachLed).not.toBeNull();
    expect(coachLed!.segment).toBe('ShortGame');
    expect(cards.every(c => c.activityId !== 'wedge-standard')).toBe(true);
  });
});

describe('the plan as a whole', () => {
  it('always carries a putting game, framed as upkeep when putting is healthy', () => {
    const shots = [
      ...approach(36, {
        startingDistance: 175,
        endingLie: 'Green',
        endingDistance: 42,
        calculatedStrokesGained: -0.3,
      }),
      // On holes of their own: stacking putts onto one hole would read as a
      // four-putt and hand Putting a Tiger 5 share it has not earned.
      ...spread(24, 10, {
        shotType: 'Putt',
        startingLie: 'Green',
        shotNumber: 3,
        startingDistance: 9,
        endingDistance: 0,
        calculatedStrokesGained: 0.01,
      }),
    ];
    const { cards } = plan(shots);
    expect(cards).toHaveLength(2);
    expect(cards[0].segment).toBe('Approach');
    expect(cards[1].segment).toBe('Putting');
    expect(cards[1].maintenance).toBe(true);
    expect(cards[1].why).toMatch(/not your problem/i);
  });

  it('leads with the Tiger 5 segment when Gate 4 fires', () => {
    const wrecked = (round: string, h: number) =>
      [
        { shotType: 'Drive' as const, startingLie: 'Tee' as const, hasPenalty: true, calculatedStrokesGained: -1.5 },
        { shotType: 'Approach' as const, calculatedStrokesGained: 0 },
        { shotType: 'Approach' as const, calculatedStrokesGained: 0 },
        { shotType: 'Putt' as const, startingLie: 'Green' as const, startingDistance: 12, endingDistance: 1 },
        { shotType: 'Putt' as const, startingLie: 'Green' as const, startingDistance: 1, endingDistance: 0 },
        { shotType: 'Putt' as const, startingLie: 'Green' as const, startingDistance: 1, endingDistance: 0 },
      ].map((s, i) => shot({ roundId: round, holeNumber: h, holePar: 4, shotNumber: i + 1, ...s }));

    const shots = [
      ...spread(36, 7, {
        shotType: 'Approach',
        shotNumber: 2,
        startingLie: 'Fairway',
        startingDistance: 175,
        endingLie: 'Green',
        endingDistance: 42,
        calculatedStrokesGained: -0.25,
      }),
      ...spread(30, 13, { shotType: 'Drive', startingLie: 'Tee', calculatedStrokesGained: 0.02 }),
      ...Array.from({ length: 6 }, (_, i) => wrecked(`round-${i + 1}`, i + 1)).flat(),
    ];

    const d = runSegmentDiagnosis(shots, BENCH);
    expect(d.headline!.segment).toBe('Approach');
    expect(d.t5Promoted!.segment).toBe('Driving');

    // The segment wrecking holes leads the plan; the SG leader takes card 2.
    const { cards } = buildPracticePlan(d);
    expect(cards[0].segment).toBe('Driving');
    expect(cards[1].segment).toBe('Approach');
  });

  it('prescribes the approach game when Gate 2 sets putting aside', () => {
    const girHole = (round: string, h: number) =>
      [
        { shotType: 'Drive' as const, startingLie: 'Tee' as const, calculatedStrokesGained: -0.1 },
        {
          shotType: 'Approach' as const,
          startingLie: 'Fairway' as const,
          startingDistance: 175,
          endingLie: 'Green' as const,
          endingDistance: 34,
          calculatedStrokesGained: -0.45,
        },
        { shotType: 'Putt' as const, startingLie: 'Green' as const, startingDistance: 34, endingDistance: 3, calculatedStrokesGained: -0.2 },
        { shotType: 'Putt' as const, startingLie: 'Green' as const, startingDistance: 3, endingDistance: 1, calculatedStrokesGained: -0.5 },
        { shotType: 'Putt' as const, startingLie: 'Green' as const, startingDistance: 1, endingDistance: 0 },
      ].map((s, i) => shot({ roundId: round, holeNumber: h, holePar: 4, shotNumber: i + 1, ...s }));

    const shots = Array.from({ length: 18 }, (_, i) =>
      girHole(`round-${(i % 6) + 1}`, (i % 18) + 1),
    ).flat();

    const d = runSegmentDiagnosis(shots, BENCH);
    expect(d.putting.girFirstPuttAvgFt).toBeGreaterThan(30);
    expect(d.all.find(r => r.segment === 'Putting')!.demoted).toBe(true);
    expect(buildPracticePlan(d).cards[0].segment).toBe('Approach');
  });

  it('never links to a game that is still in development', () => {
    const scenarios = [
      drives(36, { calculatedStrokesGained: -0.3 }),
      approach(36, { startingDistance: 90, endingLie: 'Green', endingDistance: 34, calculatedStrokesGained: -0.3 }),
      approach(36, { startingDistance: 175, endingLie: 'Rough', endingDistance: 20, calculatedStrokesGained: -0.3 }),
      putts(36, { startingDistance: 5, endingDistance: 2, calculatedStrokesGained: -0.3 }),
      putts(36, { startingDistance: 38, endingDistance: 4, calculatedStrokesGained: -0.3 }),
    ];
    scenarios.forEach(shots => {
      plan(shots).cards.forEach(c => {
        expect(isBuilt(c.activityId)).toBe(true);
        expect(c.route).toBe(ACTIVITY_ROUTES[c.activityId]);
      });
    });
  });

  it('returns an empty plan with no shots', () => {
    expect(plan([])).toEqual({ cards: [], coachLed: null });
  });
});

describe('miss-bias targets stay achievable', () => {
  it('floors the reversed share rather than asking for under 0%', () => {
    const shots = spread(36, 1, {
      shotType: 'Drive',
      startingLie: 'Tee',
      missDirection: 'Right',
      calculatedStrokesGained: -0.3,
    });
    const target = plan(shots).cards[0].target!;
    expect(target).toMatch(/right 100% of the time/);
    expect(target).not.toMatch(/under 0%/);
    expect(target).toMatch(/under 20% right/);
  });
});
