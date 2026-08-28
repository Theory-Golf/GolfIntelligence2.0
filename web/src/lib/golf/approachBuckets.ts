/**
 * Canonical approach distance buckets, shared by the Approach tab's skill
 * cards, heat map, and shot table so all three reconcile.
 *
 * The ranges cover every shot getShotSegment() classifies as an Approach
 * (50 <= startingDistance < 235), so no approach shot falls outside a bucket.
 */
export const APPROACH_DISTANCE_BUCKETS = [
  { label: 'Distance Wedges', description: '50-100 yards', shortRange: '50-100 yds', minDistance: 50, maxDistance: 100 },
  { label: 'Short Approach', description: '101-150 yards', shortRange: '101-150 yds', minDistance: 101, maxDistance: 150 },
  { label: 'Medium Approach', description: '151-200 yards', shortRange: '151-200 yds', minDistance: 151, maxDistance: 200 },
  { label: 'Long Approach', description: '201+ yards', shortRange: '201+ yds', minDistance: 201, maxDistance: 234 },
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

/** Short "50-100 yds" style range for a bucket label, for use in headings. */
export function getApproachBucketRange(label: string): string {
  return APPROACH_DISTANCE_BUCKETS.find(b => b.label === label)?.shortRange ?? '';
}
