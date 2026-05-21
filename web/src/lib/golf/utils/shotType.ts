import type { Lie, ShotSegment } from '../db/types';

export function getShotSegment(
  startingLie: Lie,
  startingDistance: number,
  holePar: number,
): ShotSegment {
  if (startingLie === 'Green') return 'Putt';
  if (startingLie === 'Recovery') return 'Recovery';
  if (startingDistance < 50) return 'ShortGame';
  if (startingLie === 'Tee' && (holePar === 4 || holePar === 5)) return 'Drive';
  if (startingDistance >= 235) return 'Other';
  return 'Approach';
}
