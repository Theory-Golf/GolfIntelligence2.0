/**
 * Theory Golf — Practice Activity Library
 * Single source of truth for all PlayerPath practice activities.
 */

export interface ConnectedDriver {
  driver_id: string;
  connection: string;
}

export interface Activity {
  id: string;
  name: string;
  category: 'putting' | 'wedge' | 'approach' | 'short_game' | 'driving';
  type: 'skill_assessment' | 'skill_development';
  description: string;
  connected_drivers: ConnectedDriver[];
}

export type ActivityCategory = Activity['category'];

export interface SegmentOption {
  id: ActivityCategory;
  label: string;
}

/**
 * Game segments in causal-chain order — the sequence the PlayerPath framework
 * uses, where each stage inherits its constraints from the one before it.
 *
 * `short_game` is intentionally absent: no activity carries that category yet.
 * The segment list renders only non-empty groups, so adding one here is all
 * that is needed when short-game activities exist.
 */
export const SEGMENTS: SegmentOption[] = [
  { id: 'driving',  label: 'Driving' },
  { id: 'approach', label: 'Approach' },
  { id: 'wedge',    label: 'Wedge' },
  { id: 'putting',  label: 'Putting' },
];

/**
 * Routes for activities that have a built tool. An activity missing from this
 * map is still in development: it renders greyed out and is never selected as
 * a session's assessment block.
 *
 * The keys double as `drill_type` values in `drill_sessions`, so a practice
 * result joins straight back to its catalog entry.
 */
export const ACTIVITY_ROUTES: Record<string, string> = {
  'round-simulation':  '/player-path/round-simulation',
  'lag-putt-test':     '/player-path/lag-putt-test',
  'inside-ten':        '/player-path/putting/inside-ten',
  'inside-twenty':     '/player-path/putting/inside-twenty',
  'winners-circle':    '/player-path/putting/winners-circle',
  'wedge-standard':    '/player-path/wedge-standard',
  'approach-standard': '/player-path/approach-standard',
  'driver-standard':   '/player-path/driver-standard',
  'line-test':         '/player-path/line-test',
};

/** History views, where a tool has one. */
export const ACTIVITY_HISTORY_ROUTES: Record<string, string> = {
  'inside-ten':     '/player-path/putting/inside-ten/history',
  'inside-twenty':  '/player-path/putting/inside-twenty/history',
  'winners-circle': '/player-path/putting/winners-circle/history',
};

export function isBuilt(activityId: string): boolean {
  return activityId in ACTIVITY_ROUTES;
}

export function activityById(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

export const ACTIVITIES: Activity[] = [
  // ── PUTTING ──────────────────────────────────────────────────────────

  {
    id: 'round-simulation',
    name: 'Round Simulation',
    category: 'putting',
    type: 'skill_assessment',
    description:
      'Simulates a full round of putting across varied distances and break types. Tracks make rate, proximity, and speed outcomes across the full distance spectrum — generating a complete putting performance profile.',
    connected_drivers: [
      {
        driver_id: 'M1',
        connection:
          'Identifies SG by distance bucket — reveals exactly which range is costing strokes',
      },
      {
        driver_id: 'M2',
        connection: 'Surfaces the primary loss bucket to direct practice',
      },
      {
        driver_id: 'L1',
        connection:
          'Flags poor lag rate on longer distance putts in the simulation',
      },
    ],
  },

  {
    id: 'speed-test',
    name: 'Speed Test',
    category: 'putting',
    type: 'skill_assessment',
    description:
      'Scored assessment of speed control across multiple distances. Player hits a set number of putts per distance band and records how many finish within an acceptable proximity window. Generates a speed dispersion band score.',
    connected_drivers: [
      {
        driver_id: 'L2',
        connection:
          'Directly measures speed dispersion band — max long + max short',
      },
      {
        driver_id: 'L3',
        connection:
          'Reveals long/short centering bias across distance bands',
      },
      {
        driver_id: 'L1',
        connection:
          'Tracks what percentage of lag putts fail to finish inside 5 feet',
      },
    ],
  },

  {
    id: 'start-line-drill',
    name: 'Start Line Drill',
    category: 'putting',
    type: 'skill_development',
    description:
      'Isolated skill work focused on face angle at impact. Player sets a gate or alignment rod and rolls putts through a narrow target to train consistent face control. No score — repetition and feedback only.',
    connected_drivers: [
      {
        driver_id: 'M1',
        connection:
          'Improves face control on makeable putts (0–12 ft) where start line is critical to make rate',
      },
      {
        driver_id: 'M2',
        connection:
          'Targets the primary loss bucket if it falls in the 5–12 ft range where face angle dominates',
      },
    ],
  },

  {
    id: 'gate-drill',
    name: 'Gate Drill',
    category: 'putting',
    type: 'skill_development',
    description:
      "Player places two tees just wider than the putter head and rolls putts through the gate from 4–8 feet. Builds path consistency and face awareness through immediate physical feedback. Adapted from Luke Donald's practice routine.",
    connected_drivers: [
      {
        driver_id: 'M1',
        connection:
          'Targets the 5–8 ft SG bucket — the highest-leverage makeable putt range',
      },
      {
        driver_id: 'M2',
        connection:
          'Addresses the primary loss bucket when it falls in the 4–8 ft zone',
      },
    ],
  },

  {
    id: 'mid-range-challenge',
    name: 'Mid Range Challenge',
    category: 'putting',
    type: 'skill_assessment',
    description:
      '5 putts each from 10, 12, 15, 17, and 20 feet — 25 total. Goal is to make 9 or more. Tracks make rate progression across the mid-range distance band under light competitive pressure.',
    connected_drivers: [
      {
        driver_id: 'M1',
        connection:
          'Assesses SG across the 9–20 ft buckets — flags underperformance vs thresholds',
      },
      {
        driver_id: 'M2',
        connection:
          'Identifies the primary loss bucket within the mid-range band',
      },
      {
        driver_id: 'L1',
        connection:
          'Longer attempts (17–20 ft) double as lag putt proximity checks',
      },
    ],
  },

  {
    id: 'lag-putt-test',
    name: 'Lag Putt Test',
    category: 'putting',
    type: 'skill_assessment',
    description:
      'Inspired by the Swedish Golf Team protocol. Player hits a set number of putts from outside 20 feet and tracks proximity of each first putt. Scored on how consistently they finish inside a 5-foot circle.',
    connected_drivers: [
      {
        driver_id: 'L1',
        connection:
          'Directly scores poor lag rate — % of putts finishing outside 5 feet',
      },
      {
        driver_id: 'L2',
        connection:
          'Captures speed dispersion band from the recorded end distances',
      },
      {
        driver_id: 'L3',
        connection:
          'Tracks centering rate — whether misses trend long or short',
      },
    ],
  },

  {
    id: 'inside-ten',
    name: 'Inside Ten',
    category: 'putting',
    type: 'skill_assessment',
    description:
      '18 putts across six ladders from 3 to 10 feet — the par-save and birdie-conversion range. Logged putt by putt with a recap after every ladder, and Strokes Gained tracked across the makeable band.',
    connected_drivers: [
      {
        driver_id: 'M1',
        connection:
          'Scores make rate across the 3–10 ft makeable band where putting SG is won or lost',
      },
      {
        driver_id: 'M2',
        connection:
          'SG-by-ladder breakdown surfaces the primary loss bucket inside ten feet',
      },
    ],
  },

  {
    id: 'inside-twenty',
    name: 'Inside Twenty',
    category: 'putting',
    type: 'skill_assessment',
    description:
      'Eighteen putts across six ladders from 5 to 19 feet — the mid-range conversion zone. Logged putt by putt so every make and miss carries the distance it came from, with tier-based tracking across the range where rounds are won or lost.',
    connected_drivers: [
      {
        driver_id: 'M1',
        connection:
          'Benchmarks make rate across the 5–19 ft mid-range band against tier thresholds',
      },
      {
        driver_id: 'M2',
        connection:
          'Per-ladder tiering identifies the primary loss bucket in the conversion zone',
      },
      {
        driver_id: 'L1',
        connection:
          'Longer ladders (15–19 ft) double as lag putt proximity checks',
      },
    ],
  },

  {
    id: 'winners-circle',
    name: 'Winners Circle',
    category: 'putting',
    type: 'skill_assessment',
    description:
      'Survival putting assessment. Five tees circle the hole at 4 feet — every make keeps a tee in play, every miss removes it for good. Surviving tees move back 1 foot per round until none remain. Total makes is the score; 20 clears the Standard. Credit: John Graham, via the Spin Axis podcast.',
    connected_drivers: [
      {
        driver_id: 'M1',
        connection:
          'Measures make rate through the 4–9 ft band where par saves are decided',
      },
      {
        driver_id: 'M2',
        connection:
          'Escalating cost of each miss surfaces the distance where conversion breaks down',
      },
    ],
  },

  // ── WEDGE ─────────────────────────────────────────────────────────

  {
    id: 'wedge-combine',
    name: 'Wedge Combine',
    category: 'wedge',
    type: 'skill_assessment',
    description:
      'Trackman-powered benchmark assessment: player hits a set number of shots at fixed distances within the 50–100 yard range. Scored on proximity, carry accuracy, and dispersion. Results are comparable across sessions to track improvement over time.',
    connected_drivers: [
      {
        driver_id: 'A1',
        connection:
          'Measures GIR rate in the 50–100y band — flags below 90% threshold',
      },
      {
        driver_id: 'A2',
        connection:
          'Scores proximity rate — flags if less than 40% of shots finish inside 15 feet',
      },
      {
        driver_id: 'A4',
        connection:
          'Identifies if 50–100y is the distance band black hole absorbing most approach SG losses',
      },
    ],
  },

  {
    id: 'wedge-standard',
    name: 'Wedge Standard',
    category: 'wedge',
    type: 'skill_assessment',
    description:
      "An adaptive Trackman assessment that adjusts difficulty based on the player's current skill level. Targets shift as performance improves, ensuring the scoring challenge stays meaningful regardless of where the player is in their development. The standard rises with you.",
    connected_drivers: [
      {
        driver_id: 'A1',
        connection:
          "Continuously benchmarks GIR rate at the player's true skill ceiling, not a fixed bar",
      },
      {
        driver_id: 'A2',
        connection:
          'Proximity targets adapt — prevents players from gaming a static standard',
      },
      {
        driver_id: 'A4',
        connection:
          'Adaptive difficulty exposes the distance band black hole more reliably than fixed tests',
      },
    ],
  },

  {
    id: 'spin-loft-drill',
    name: 'Spin Loft Drill',
    category: 'wedge',
    type: 'skill_development',
    description:
      'Isolated skill work using Trackman to train dynamic loft and angle of attack. Player works on delivery conditions to optimize spin and control. Focused on building the ball-striking fundamentals that produce repeatable wedge distances.',
    connected_drivers: [
      {
        driver_id: 'A2',
        connection:
          'Improving spin loft control directly improves proximity outcomes in the 50–100y scoring zone',
      },
      {
        driver_id: 'A3',
        connection:
          'Targets the lie-based performance gap — rough often worsens spin loft delivery',
      },
    ],
  },

  {
    id: 'club-speed-drill',
    name: 'Club Speed Drill',
    category: 'wedge',
    type: 'skill_development',
    description:
      "Structured practice using Trackman to map club speed to carry distance across the wedge set. Player builds an accurate internal distance model for each club — the foundation of reliable distance control.",
    connected_drivers: [
      {
        driver_id: 'A1',
        connection:
          'Eliminates distance miscalculation as a cause of GIR misses in the 50–100y band',
      },
      {
        driver_id: 'A2',
        connection:
          "Directly improves proximity by calibrating the player's distance model",
      },
      {
        driver_id: 'A4',
        connection:
          'Reduces the chance of 50–100y being a scoring black hole due to distance errors',
      },
    ],
  },

  // ── APPROACH ─────────────────────────────────────────────────────────

  {
    id: 'approach-combine',
    name: 'Approach Combine',
    category: 'approach',
    type: 'skill_assessment',
    description:
      'Trackman-powered benchmark assessment across the 100–200 yard range. Player hits shots at multiple fixed distance targets and is scored on GIR rate, proximity, and dispersion by band. Results are comparable across sessions to track improvement over time.',
    connected_drivers: [
      {
        driver_id: 'A1',
        connection:
          'Measures GIR rate per distance band (100–150y, 150–200y) against thresholds',
      },
      {
        driver_id: 'A2',
        connection:
          'Scores proximity rate in scoring zones — flags underperformance vs targets',
      },
      {
        driver_id: 'A4',
        connection:
          'Identifies the distance band black hole accounting for the greatest share of approach SG losses',
      },
    ],
  },

  {
    id: 'line-test',
    name: 'Line Test',
    category: 'approach',
    type: 'skill_assessment',
    description:
      'Player sets alignment aids to establish a clear target line and works on consistently starting the ball on that line from approach distances. Builds directional discipline and reduces dispersion from 100–200 yards.',
    connected_drivers: [
      {
        driver_id: 'A1',
        connection:
          'Reduces directional misses — directly improves GIR rate across approach bands',
      },
      {
        driver_id: 'A2',
        connection:
          'Tighter dispersion means more shots finishing in proximity target windows',
      },
      {
        driver_id: 'A3',
        connection:
          'Lie-based gap often worsened by direction error — line work helps from rough as well',
      },
    ],
  },

  {
    id: 'face-to-path-drill',
    name: 'Face to Path Drill',
    category: 'approach',
    type: 'skill_development',
    description:
      'Isolated skill work on club face alignment relative to swing path at impact. Using Trackman data, the player identifies their face-to-path relationship and works to bring it within a playable range — reducing dispersion and shot shape variation.',
    connected_drivers: [
      {
        driver_id: 'A1',
        connection:
          'Face-to-path misalignment is a primary cause of GIR misses — correcting it raises GIR rate',
      },
      {
        driver_id: 'A3',
        connection:
          'Rough shots punish face-to-path errors more severely — improvement reduces the lie-based gap',
      },
      {
        driver_id: 'A4',
        connection:
          'If one distance band is a black hole, face-to-path issues often explain the dispersion causing it',
      },
    ],
  },

  {
    id: 'approach-standard',
    name: 'Approach Standard',
    category: 'approach',
    type: 'skill_assessment',
    description:
      'A periodized assessment for full iron and hybrid shots from 125–210 yards. Five tiers anchored to PGA Tour proximity data. Binary scoring — Inside or Outside. Difficulty adjusts automatically as you improve.',
    connected_drivers: [
      {
        driver_id: 'A1',
        connection:
          'Benchmarks GIR rate per distance band against tier-anchored proximity rings',
      },
      {
        driver_id: 'A2',
        connection:
          'Scores proximity rate in approach scoring zones; tier system tightens rings as proximity improves',
      },
      {
        driver_id: 'A4',
        connection:
          'Stratified random yardages expose the distance band black hole reliably across sessions',
      },
    ],
  },

  // ── DRIVING ──────────────────────────────────────────────────────────

  {
    id: 'driver-standard',
    name: 'Driver Standard',
    category: 'driving',
    type: 'skill_assessment',
    description:
      'A periodized practice protocol for off-the-tee accuracy. Five tiers anchored to PGA Tour fairway widths and USGA scratch standards. Binary scoring — every shot is Hit or Miss. Optional shape mode adds randomized Draw / Fade calls for contextual-interference training.',
    connected_drivers: [],
  },
];

/**
 * Returns activities that connect to at least one of the provided driver IDs.
 * Used by the intelligence layer to surface relevant practice for a player's flagged drivers.
 */
export function getActivitiesForDrivers(flaggedDriverIds: string[]): Activity[] {
  if (!flaggedDriverIds || flaggedDriverIds.length === 0) return [];
  const ids = new Set(flaggedDriverIds);
  return ACTIVITIES.filter((activity) =>
    activity.connected_drivers.some((cd) => ids.has(cd.driver_id))
  );
}
