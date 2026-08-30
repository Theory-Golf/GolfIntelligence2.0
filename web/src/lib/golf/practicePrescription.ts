/**
 * Golf Intelligence — Practice Prescription
 *
 * Answers PlayerPath's second question: which game do you go play. Takes a
 * segment diagnosis and returns at most two cards, each naming a game that is
 * already built, how to configure it, and what to aim at.
 *
 * The routing is driven by measured signal — segment, then distance band or
 * putting zone, then failure mode — rather than by the `connected_drivers`
 * field on the activity catalog. That field is keyed to a superseded driver
 * taxonomy (see the comment on it in data/practiceActivities.ts), and a flat
 * game-to-driver list cannot express the band-level and loss-shape reasoning
 * these decisions turn on.
 */

import { ACTIVITY_ROUTES, activityById, isBuilt } from '../../data/practiceActivities';
import { APPROACH_TUNING, GATE_TUNING } from './segmentDiagnosis';
import type {
  ApproachContext,
  DrivingContext,
  PuttingContext,
  Segment,
  SegmentDiagnosisResult,
  SegmentReading,
  ShortGameContext,
} from './segmentDiagnosis';

export interface Prescription {
  activityId: string;
  name: string;
  route: string;
  segment: Segment;
  /** How to set the game up — shape mode, which band, which yardages. */
  config: string | null;
  /** One line tying the game to the finding. */
  why: string;
  /** What "better" looks like when they play it. */
  target: string | null;
  /** Card 2 when the headline is healthy elsewhere — upkeep, not a weakness. */
  maintenance: boolean;
  /** Set when the finding is real but no built game tests it. */
  coachLed?: boolean;
}

/** A finding with no game behind it still has to be reportable. */
export interface CoachLedFinding {
  segment: Segment;
  why: string;
}

export interface PracticePlan {
  cards: Prescription[];
  coachLed: CoachLedFinding | null;
}

// ============================================
// Helpers
// ============================================

function card(
  activityId: string,
  segment: Segment,
  parts: { why: string; config?: string | null; target?: string | null; maintenance?: boolean },
): Prescription | null {
  const activity = activityById(activityId);
  const route = ACTIVITY_ROUTES[activityId];
  // A prescription must never deep-link to a game that is still in development.
  if (!activity || !route || !isBuilt(activityId)) return null;
  return {
    activityId,
    name: activity.name,
    route,
    segment,
    config: parts.config ?? null,
    why: parts.why,
    target: parts.target ?? null,
    maintenance: parts.maintenance ?? false,
  };
}

const yards = (min: number, max: number) => `${min}–${max} y`;

/** The tightest reversed miss share worth stating as a goal. */
const MISS_BIAS_FLOOR_PCT = 20;

/** The yardage buckets actually losing strokes, for a game that takes custom ranges. */
function losingBands(approach: ApproachContext, minY: number, maxY: number): string {
  const bleeding = approach.bands
    .filter(b => b.shots > 0 && b.sgPerRound < 0 && b.maxY > minY && b.minY <= maxY)
    .sort((a, b) => a.sgPerRound - b.sgPerRound)
    .slice(0, 2)
    .map(b => yards(b.minY, b.maxY));
  return bleeding.length > 0 ? bleeding.join(' and ') : yards(minY, maxY);
}

// ============================================
// Driving
// ============================================

/**
 * One game, so the differentiation is configuration.
 *
 * Shape mode reads opposite to intuition. A slow leak means a baseline driving
 * skill already exists and the player is ready for the added interference of a
 * called shape; a blow-up means there is no baseline yet, so the interference
 * comes off and the work is simply getting drives inside a corridor.
 */
function prescribeDriving(
  reading: SegmentReading,
  driving: DrivingContext,
): Prescription | null {
  const blowup = reading.shape === 'blowup';
  const nonDriver = driving.nonDriverLossShare >= GATE_TUNING.NON_DRIVER_LOSS_SHARE;

  let config: string;
  let why: string;
  let target: string;

  if (nonDriver) {
    config = 'Play it without the driver';
    why = `${Math.round(driving.nonDriverLossShare * 100)}% of your driving loss comes from non-driver clubs off the tee — the bail-out club is not reducing risk.`;
    target = 'Hold the bail-out club to the same corridor you hold the driver to.';
  } else if (blowup) {
    config = 'Shape mode OFF — width only';
    why = 'Your typical drive is fine; a small number are wrecking holes. Strip the interference and work the corridor.';
    target = 'Pass is 5 of 13 at your tier. No shape called.';
  } else {
    config = 'Shape mode ON — Draw / Fade called each shot';
    why = 'You are losing a little on most drives, which means the baseline is there. Add interference to push it.';
    target = 'Pass is 5 of 13, Elite 8, at your tier.';
  }

  if (driving.oneWayMiss) {
    const side = driving.oneWayMiss.toLowerCase();
    const missPct = Math.round(
      driving.oneWayMiss === 'Left' ? driving.missLeftPct : driving.missRightPct,
    );
    // The goal is not "miss less" — it is to flip the distribution. Floored,
    // because a 100% one-way miss reverses to "under 0%", which is not a target
    // a player can aim at. At that extreme the ask is simply to break the
    // pattern, and MISS_BIAS_FLOOR_PCT is the smallest share worth naming.
    const goal = Math.max(100 - missPct, MISS_BIAS_FLOOR_PCT);
    target += ` Your miss is ${side} ${missPct}% of the time on course; aim to reverse it — under ${goal}% ${side} in the session.`;
  }

  return card('driver-standard', 'Driving', { config, why, target });
}

// ============================================
// Approach
// ============================================

/**
 * Distance band first, then failure mode — and both bands split the same way.
 * Missing the green is a start-line problem and goes to the Line Test; hitting
 * it and finishing far is a distance-control problem and goes to the Standard.
 *
 * Both games take custom yardages, so every card names the buckets that are
 * actually bleeding. "Play the Line Test" without naming 150–175 is not
 * actionable — the player will set it up around yardages that are already fine.
 */
function prescribeApproach(
  reading: SegmentReading,
  approach: ApproachContext,
  driving: DrivingContext,
): Prescription | null {
  const worst = approach.worstBand;
  const insideWedge = worst !== null && worst.maxY <= APPROACH_TUNING.WEDGE_MAX_Y;
  const directional =
    approach.missesGreen || reading.shape === 'blowup' || driving.oneWayMiss !== null;

  if (insideWedge) {
    if (directional) {
      return card('line-test', 'Approach', {
        config: `Wedges band · ${yards(75, 125)}`,
        why: `Inside ${APPROACH_TUNING.WEDGE_MAX_Y} yards you are missing greens rather than finishing far from the hole — that is start line, not distance control.`,
        target: 'Clear your current dispersion tier in the Wedges band.',
      });
    }
    return card('wedge-standard', 'Approach', {
      config: 'Full wedge set',
      why: `Your loss sits inside ${APPROACH_TUNING.WEDGE_MAX_Y} yards and you are hitting greens — the gap is distance control, not direction.`,
      target: 'Beat your current level rating; the targets tighten as you improve.',
    });
  }

  const bands = losingBands(approach, APPROACH_TUNING.WEDGE_MAX_Y, 225);

  if (directional) {
    const bandName = worst && worst.minY >= 175 ? 'Long Irons' : 'Mid Irons';
    const reason = approach.missesGreen
      ? `You are missing greens from ${bands}`
      : reading.shape === 'blowup'
        ? `Your typical approach is fine, but a few big misses from ${bands} are doing the damage`
        : `Your miss is one-way ${driving.oneWayMiss?.toLowerCase() ?? ''} from ${bands}`.trim();
    return card('line-test', 'Approach', {
      config: `${bandName} band · load ${bands}`,
      why: `${reason} — work the start line on the yardages that are actually costing you.`,
      target: 'Clear your current dispersion tier in that band.',
    });
  }

  return card('approach-standard', 'Approach', {
    config: `Narrow the yardages to ${bands}`,
    why: `You are hitting greens but finishing far away — only ${Math.round(approach.within20FtPct)}% of approaches end inside 20 feet. Work proximity on ${bands}.`,
    target: 'Pass at your current tier, then let the rings tighten.',
  });
}

// ============================================
// Putting
// ============================================

function prescribePutting(
  reading: SegmentReading,
  putting: PuttingContext,
): Prescription[] {
  const zone = putting.worstZone;
  if (!zone) return [];

  if (zone.id === 'lag') {
    const bias =
      zone.longMissShare === null
        ? ''
        : zone.longMissShare >= 0.6
          ? ' Your lag misses run long.'
          : zone.longMissShare <= 0.4
            ? ' Your lag misses run short.'
            : '';
    const lag = card('lag-putt-test', 'Putting', {
      config: 'Outside 20 feet',
      why: `Lag putting is costing you ${Math.abs(zone.sgPerRound).toFixed(2)} strokes a round.${bias}`,
      target: 'Finish inside 5 feet. Scratch is around 2.0; tour is −5.5.',
    });
    return lag ? [lag] : [];
  }

  if (zone.id === 'conversion') {
    const inside20 = card('inside-twenty', 'Putting', {
      config: '18 putts, 5 to 19 feet',
      why: `The 13–20 foot conversion zone is costing you ${Math.abs(zone.sgPerRound).toFixed(2)} strokes a round.`,
      target: '9 of 18 clears tour baseline; 11 is elite.',
    });
    return inside20 ? [inside20] : [];
  }

  const cards: Prescription[] = [];
  const insideTen = card('inside-ten', 'Putting', {
    config: '18 putts, six ladders from 3 to 10 feet',
    why: `The make zone inside 12 feet is costing you ${Math.abs(zone.sgPerRound).toFixed(2)} strokes a round.`,
    target: '12 of 18 is tour baseline; 13 or better is elite.',
  });
  if (insideTen) cards.push(insideTen);

  // Winners Circle earns its place when the damage is at the short end, or when
  // one miss a round is doing it — survival scoring is what punishes that.
  if (putting.shortMakeZone || reading.shape === 'blowup') {
    const wc = card('winners-circle', 'Putting', {
      config: 'Five tees from 4 feet, moving back',
      why: putting.shortMakeZone
        ? 'Most of that loss is inside 6 feet, where a survival format punishes the single miss.'
        : 'One short miss a round is doing the damage — this format makes every miss cost.',
      target: '20 makes clears the Standard.',
    });
    if (wc) cards.push(wc);
  }
  return cards;
}

// ============================================
// Short game
// ============================================

/**
 * Two routes, per Gate 3. Route A is a loss on shots that were themselves
 * attempts at a green — approach shots wearing a short-game costume, and they
 * have a game. Route B is ordinary scrambling severe enough to lead: rare, and
 * there is no built game that tests it, so it is named rather than papered over
 * with Wedge Standard, which is a 55–135 y full-swing carry test.
 */
function prescribeShortGame(
  shortGame: ShortGameContext,
  approachMaterial: boolean,
): { card: Prescription | null; coachLed: CoachLedFinding | null } {
  if (shortGame.routedFromMissedGreen >= 0.6 && approachMaterial) {
    return {
      card: null,
      coachLed: {
        segment: 'ShortGame',
        why: `${Math.round(shortGame.routedFromMissedGreen * 100)}% of your short game shots follow a missed green. This volume is manufactured upstream — fix the approach and most of these shots stop happening.`,
      },
    };
  }

  if (shortGame.route === 'A') {
    return {
      card: card('wedge-standard', 'ShortGame', {
        config: 'Full wedge set',
        why: `You are losing strokes on short game shots that were attempts at the green — live birdie chances. These are approach shots by another name.`,
        target: 'Beat your current level rating.',
      }),
      coachLed: null,
    };
  }

  return {
    card: null,
    coachLed: {
      segment: 'ShortGame',
      why: 'This is a genuine around-the-green weakness, not something manufactured upstream. There is no built game that tests it — work it with your coach.',
    },
  };
}

// ============================================
// Plan
// ============================================

function prescribeFor(
  reading: SegmentReading,
  d: SegmentDiagnosisResult,
): { cards: Prescription[]; coachLed: CoachLedFinding | null } {
  switch (reading.segment) {
    case 'Driving': {
      const c = prescribeDriving(reading, d.driving);
      return { cards: c ? [c] : [], coachLed: null };
    }
    case 'Approach': {
      const c = prescribeApproach(reading, d.approach, d.driving);
      return { cards: c ? [c] : [], coachLed: null };
    }
    case 'Putting': {
      // Gate 2: when the distance is manufactured upstream, the putting numbers
      // are what approach play predicts — so prescribe the approach game.
      if (reading.demoted && d.putting.girFirstPuttAvgFt !== null) {
        const c = prescribeApproach(d.all.find(r => r.segment === 'Approach')!, d.approach, d.driving);
        return { cards: c ? [c] : [], coachLed: null };
      }
      return { cards: prescribePutting(reading, d.putting), coachLed: null };
    }
    case 'ShortGame': {
      const { card: c, coachLed } = prescribeShortGame(
        d.shortGame,
        d.all.find(r => r.segment === 'Approach')!.material,
      );
      return { cards: c ? [c] : [], coachLed };
    }
  }
}

/**
 * The player's plan: at most two cards.
 *
 * Card 2 always carries a putting game when the headline is not putting. A
 * second game gives the player something to do when they have the time, and
 * putting is the cheapest skill to keep sharp — it is framed as upkeep, not as
 * a weakness they do not have.
 */
export function buildPracticePlan(d: SegmentDiagnosisResult): PracticePlan {
  if (!d.headline) return { cards: [], coachLed: null };

  // Gate 4: the segment carrying the scoring damage leads the plan, because
  // removing one destructive shot a round is usually a faster win than lifting
  // a leak spread across a large population.
  const lead = d.t5Promoted ?? d.headline;
  const second = d.t5Promoted ? d.headline : null;

  const primary = prescribeFor(lead, d);
  const cards = [...primary.cards];
  let coachLed = primary.coachLed;

  if (second) {
    const secondary = prescribeFor(second, d);
    cards.push(...secondary.cards);
    coachLed = coachLed ?? secondary.coachLed;
  }

  if (cards.length < 2 && lead.segment !== 'Putting') {
    const puttingReading = d.all.find(r => r.segment === 'Putting');
    if (puttingReading && puttingReading.shotCount > 0) {
      const upkeep = prescribePutting(puttingReading, d.putting)[0];
      if (upkeep && !cards.some(c => c.activityId === upkeep.activityId)) {
        cards.push({
          ...upkeep,
          maintenance: !puttingReading.material,
          why: puttingReading.material
            ? upkeep.why
            : `Putting is not your problem right now — ${d.putting.worstZone?.label.toLowerCase() ?? 'this'} is simply your weakest zone, so this is upkeep if you have the time.`,
        });
      }
    }
  }

  return { cards: cards.slice(0, 2), coachLed };
}
