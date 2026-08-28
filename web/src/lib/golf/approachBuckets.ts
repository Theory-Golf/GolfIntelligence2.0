/**
 * Canonical approach distance buckets, shared by the Approach tab's skill
 * cards, heat map, and shot table so all three reconcile.
 *
 * The ranges mirror classifyShotType(), which is what actually labels a shot
 * an Approach: starting lie of Tee, Fairway, Rough or Sand, and a starting
 * distance of 51-225 yards (<= 50 is Short Game, > 225 is Other). Every
 * approach shot therefore falls in exactly one bucket.
 */
export const APPROACH_DISTANCE_BUCKETS = [
  { label: 'Distance Wedges', description: '51-100 yards', shortRange: '51-100 yds', minDistance: 51, maxDistance: 100 },
  { label: 'Short Approach', description: '101-150 yards', shortRange: '101-150 yds', minDistance: 101, maxDistance: 150 },
  { label: 'Medium Approach', description: '151-200 yards', shortRange: '151-200 yds', minDistance: 151, maxDistance: 200 },
  { label: 'Long Approach', description: '201-225 yards', shortRange: '201-225 yds', minDistance: 201, maxDistance: 225 },
] as const;

export type ApproachTypeLabel = (typeof APPROACH_DISTANCE_BUCKETS)[number]['label'];

/**
 * Bucket label for an approach shot's starting distance.
 * Returns null only as a defensive fallback for distances outside the
 * approach range entirely.
 */
export function getApproachType(startingDistance: number): ApproachTypeLabel | null {
  const bucket = APPROACH_DISTANCE_BUCKETS.find(
    b => startingDistance >= b.minDistance && startingDistance <= b.maxDistance
  );
  return bucket ? bucket.label : null;
}

/** Short "51-100 yds" style range for a bucket label, for use in headings. */
export function getApproachBucketRange(label: string): string {
  return APPROACH_DISTANCE_BUCKETS.find(b => b.label === label)?.shortRange ?? '';
}
