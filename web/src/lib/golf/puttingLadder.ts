/**
 * Shared engine for the ladder putting drills (Inside Ten, Inside Twenty).
 *
 * Both drills are the same shape: six groups of three putts at prescribed
 * distances, one ball per putt, no retries. The only differences are the
 * distances and the tier thresholds. Everything about *playing* the ladder --
 * where you are, what has been made, what a group totalled -- is derived from
 * the ordered list of putt results, which keeps logging and undo trivially
 * consistent (the same approach Winners Circle uses).
 *
 * Sessions logged putt-by-putt carry a PuttLog[], which is what makes a
 * distance-level practice summary possible. Sessions saved before
 * putt-by-putt logging existed (and quick-entry sessions) carry only a total
 * score, so every consumer must treat the putt log as optional.
 */

/** One group of the ladder: three prescribed distances, in playing order. */
export interface LadderGroup {
  /** 1-based group number as shown to the player. */
  group: number;
  /** Distances in feet, in the order they are putted. */
  putts: number[];
}

/** One logged putt. This is the unit a distance-level summary aggregates. */
export interface PuttLog {
  /** 1-based group number. */
  group: number;
  /** 1-based position within the group. */
  putt: number;
  distanceFt: number;
  made: boolean;
}

/** One group's outcome. Partial while the group is still being played. */
export interface GroupResult {
  group: number;
  distances: number[];
  /** Results logged so far, in order. Length < distances.length mid-group. */
  results: boolean[];
  made: number;
  attempted: number;
  complete: boolean;
}

/** Make rate at a single distance, rolled up over any set of putts. */
export interface DistanceStat {
  distanceFt: number;
  attempted: number;
  made: number;
  /** 0–1. Zero when nothing was attempted. */
  makeRate: number;
}

/** Everything the play screen needs, derived from the results logged so far. */
export interface LadderState {
  /** Total putts in the ladder (18 for both drills today). */
  totalPutts: number;
  /** Putts logged so far. */
  attempted: number;
  makes: number;
  complete: boolean;
  /** 0-based index of the group being played; equals group count when done. */
  currentGroupIndex: number;
  /** 0-based position of the next putt within the current group. */
  currentPuttInGroup: number;
  /** Distance of the next putt, or null once the ladder is complete. */
  currentDistanceFt: number | null;
  /** Every group, with results filled in as far as play has reached. */
  groups: GroupResult[];
  /** True when the last logged putt completed a group. */
  atGroupBoundary: boolean;
}

/** Total putts prescribed by a ladder. */
export function totalPutts(groups: LadderGroup[]): number {
  return groups.reduce((n, g) => n + g.putts.length, 0);
}

/** The ladder as a flat list of slots, in playing order. */
export function flattenLadder(groups: LadderGroup[]): Omit<PuttLog, 'made'>[] {
  return groups.flatMap((g) =>
    g.putts.map((distanceFt, i) => ({ group: g.group, putt: i + 1, distanceFt })),
  );
}

/** Pair an ordered list of make/miss results with the slots they were hit from. */
export function buildPuttLog(groups: LadderGroup[], results: boolean[]): PuttLog[] {
  const slots = flattenLadder(groups);
  return results
    .slice(0, slots.length)
    .map((made, i) => ({ ...slots[i], made }));
}

export function deriveLadderState(groups: LadderGroup[], results: boolean[]): LadderState {
  const total = totalPutts(groups);
  const attempted = Math.min(results.length, total);
  let consumed = 0;

  const groupResults: GroupResult[] = groups.map((g) => {
    const slice = results.slice(consumed, consumed + g.putts.length);
    consumed += g.putts.length;
    return {
      group: g.group,
      distances: g.putts,
      results: slice,
      made: slice.filter(Boolean).length,
      attempted: slice.length,
      complete: slice.length === g.putts.length,
    };
  });

  const nextIndex = groupResults.findIndex((g) => !g.complete);
  const currentGroupIndex = nextIndex === -1 ? groups.length : nextIndex;
  const currentPuttInGroup = nextIndex === -1 ? 0 : groupResults[nextIndex].attempted;

  return {
    totalPutts: total,
    attempted,
    makes: results.slice(0, total).filter(Boolean).length,
    complete: attempted >= total,
    currentGroupIndex,
    currentPuttInGroup,
    currentDistanceFt:
      nextIndex === -1 ? null : groups[nextIndex].putts[currentPuttInGroup],
    groups: groupResults,
    atGroupBoundary: attempted > 0 && currentPuttInGroup === 0,
  };
}

/**
 * Roll a putt log up by distance, ascending. Feed it one session's putts for a
 * session breakdown, or every session's putts concatenated for a practice
 * summary across a player's history.
 */
export function summarizeByDistance(putts: PuttLog[]): DistanceStat[] {
  const byDistance = new Map<number, { attempted: number; made: number }>();
  for (const p of putts) {
    const entry = byDistance.get(p.distanceFt) ?? { attempted: 0, made: 0 };
    entry.attempted += 1;
    if (p.made) entry.made += 1;
    byDistance.set(p.distanceFt, entry);
  }
  return [...byDistance.entries()]
    .map(([distanceFt, { attempted, made }]) => ({
      distanceFt,
      attempted,
      made,
      makeRate: attempted > 0 ? made / attempted : 0,
    }))
    .sort((a, b) => a.distanceFt - b.distanceFt);
}

/** Roll a stored putt log back up into per-group results. */
export function summarizeByGroup(putts: PuttLog[]): GroupResult[] {
  const byGroup = new Map<number, PuttLog[]>();
  for (const p of putts) {
    const list = byGroup.get(p.group) ?? [];
    list.push(p);
    byGroup.set(p.group, list);
  }
  return [...byGroup.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([group, list]) => {
      const ordered = [...list].sort((a, b) => a.putt - b.putt);
      return {
        group,
        distances: ordered.map((p) => p.distanceFt),
        results: ordered.map((p) => p.made),
        made: ordered.filter((p) => p.made).length,
        attempted: ordered.length,
        complete: true,
      };
    });
}
