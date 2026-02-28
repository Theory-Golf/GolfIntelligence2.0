/**
 * Golf Intelligence — Calculations
 * Based on your shot classification rules
 */

import type { RawShot, ProcessedShot, ShotType, ShotCategory, Tiger5Metrics, RoundSummary } from '../types/golf';
import type { BenchmarkType } from '../data/benchmarks';
import { calculateStrokesGained } from '../data/benchmarks';

/**
 * Calculate Hole Par based on starting distance of first shot
 * - 0-225 yards = Par 3
 * - 226-495 yards = Par 4
 * - 495+ yards = Par 5
 */
export function calculateHolePar(startingDistance: number): number {
  if (startingDistance <= 225) return 3;
  if (startingDistance <= 495) return 4;
  return 5;
}

/**
 * Classify shot type based on your rules:
 * - Drive: Starting Location = Tee AND Hole Par = 4 or 5
 * - Approach: Starting Location = Fairway, Sand, Rough OR tee with distance <=225 but >=50
 * - Recovery: Starting location = Recovery
 * - Short Game: Starting distance <= 50 yards, starting location is not recovery
 * - Putt: Starting location = Green
 */
export function classifyShotType(shot: RawShot, holePar: number): ShotType {
  const { 'Starting Lie': startLoc, 'Starting Distance': startDist } = shot;
  
  // Putt: Starting location = Green
  if (startLoc === 'Green') {
    return 'Putt';
  }
  
  // Recovery: Starting location = Recovery
  if (startLoc === 'Recovery') {
    return 'Recovery';
  }
  
  // Short Game: Starting distance <= 50 yards, starting location is not recovery
  if (startDist <= 50 && startLoc !== 'Recovery') {
    return 'Short Game';
  }
  
  // Drive: Starting Location = Tee AND Hole Par = 4 or 5
  if (startLoc === 'Tee' && (holePar === 4 || holePar === 5)) {
    return 'Drive';
  }
  
  // Approach: 
  // - Starting Location = Fairway, Sand, Rough
  // - OR tee with distance <=225 but >=50
  const isApproachLocation = ['Fairway', 'Sand', 'Rough'].includes(startLoc);
  const isTeeApproach = startLoc === 'Tee' && startDist <= 225 && startDist >= 50;
  
  if (isApproachLocation || isTeeApproach) {
    return 'Approach';
  }
  
  // Default fallback - treat as Approach
  return 'Approach';
}

/**
 * Process raw shots into enhanced shots with computed fields
 */
export function processShots(rawShots: RawShot[], benchmark: BenchmarkType = 'pgaTour'): ProcessedShot[] {
  // Group shots by round and hole to find first shots
  const firstShotsByHole = new Map<string, RawShot>();
  
  rawShots.forEach(shot => {
    const key = `${shot['Round ID']}-${shot.Hole}`;
    if (!firstShotsByHole.has(key)) {
      firstShotsByHole.set(key, shot);
    }
  });
  
  // Calculate hole pars from first shots
  const holePars = new Map<string, number>();
  firstShotsByHole.forEach((shot, key) => {
    holePars.set(key, calculateHolePar(shot['Starting Distance']));
  });
  
  // Process each shot
  return rawShots.map(shot => {
    const roundHoleKey = `${shot['Round ID']}-${shot.Hole}`;
    const holePar = holePars.get(roundHoleKey) || 4;
    
    // Calculate SG using benchmark
    const calculatedSG = calculateStrokesGained(
      benchmark,
      shot['Starting Distance'],
      shot['Starting Lie'],
      shot['Ending Distance'],
      shot['Ending Lie']
    );
    
    return {
      ...shot,
      holePar,
      shotType: classifyShotType(shot, holePar),
      scoreToPar: 0, // Will be calculated at round level
      calculatedStrokesGained: calculatedSG,
    };
  });
}

/**
 * Calculate Tiger 5 metrics from processed shots
 */
export function calculateTiger5Metrics(shots: ProcessedShot[]): Tiger5Metrics {
  if (shots.length === 0) {
    return {
      totalStrokesGained: 0,
      avgStrokesGained: 0,
      totalRounds: 0,
      totalShots: 0,
      scoringAvg: 0,
      fairwayPct: 0,
      girPct: 0,
      byCategory: [],
    };
  }
  
  // Use calculated SG from benchmark (not raw data SG)
  const totalStrokesGained = shots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
  const totalShots = shots.length;
  const avgStrokesGained = totalStrokesGained / totalShots;
  
  // Get unique rounds
  const roundIds = [...new Set(shots.map(s => s['Round ID']))];
  const totalRounds = roundIds.length;
  
  // Calculate fairways (only for par 4 and 5 holes - drives that ended in fairway)
  let fairwaysHit = 0;
  let fairwaysTotal = 0;
  
  // Calculate GIR (Green in Regulation - approach from fairway/rough that ended on green)
  let gir = 0;
  let girTotal = 0;
  
  shots.forEach(shot => {
    // Fairway tracking: Drive (shot 1 on par 4/5) that ended in Fairway
    if (shot.shotType === 'Drive' && shot.holePar >= 4) {
      fairwaysTotal++;
      if (shot['Ending Lie'] === 'Fairway') {
        fairwaysHit++;
      }
    }
    
    // GIR tracking: Approach shot that ended on green
    if (shot.shotType === 'Approach') {
      girTotal++;
      if (shot['Ending Lie'] === 'Green') {
        gir++;
      }
    }
  });
  
  const fairwayPct = fairwaysTotal > 0 ? (fairwaysHit / fairwaysTotal) * 100 : 0;
  const girPct = girTotal > 0 ? (gir / girTotal) * 100 : 0;
  
  // Calculate by category
  const categories = ['Drive', 'Approach', 'Short Game', 'Putt', 'Recovery'] as ShotType[];
  const byCategory: ShotCategory[] = categories.map(type => {
    const categoryShots = shots.filter(s => s.shotType === type);
    const catTotal = categoryShots.length;
    // Use calculated SG from benchmark
    const catSG = categoryShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
    
    return {
      type,
      totalShots: catTotal,
      strokesGained: catSG,
      avgStrokesGained: catTotal > 0 ? catSG / catTotal : 0,
    };
  });
  
  // Note: scoringAvg requires knowing actual scores vs par - would need more data
  const scoringAvg = 0; // Placeholder
  
  return {
    totalStrokesGained,
    avgStrokesGained,
    totalRounds,
    totalShots,
    scoringAvg,
    fairwayPct,
    girPct,
    byCategory,
  };
}

/**
 * Get round summaries
 */
export function getRoundSummaries(shots: ProcessedShot[]): RoundSummary[] {
  const roundMap = new Map<string, ProcessedShot[]>();
  
  shots.forEach(shot => {
    const roundId = shot['Round ID'];
    if (!roundMap.has(roundId)) {
      roundMap.set(roundId, []);
    }
    roundMap.get(roundId)!.push(shot);
  });
  
  const summaries: RoundSummary[] = [];
  
  roundMap.forEach((roundShots, roundId) => {
    const firstShot = roundShots[0];
    // Use calculated SG from benchmark
    const totalSG = roundShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
    
    // Count fairways
    const drives = roundShots.filter(s => s.shotType === 'Drive' && s.holePar >= 4);
    const fairwaysHit = drives.filter(s => s['Ending Lie'] === 'Fairway').length;
    
    // Count GIR
    const approaches = roundShots.filter(s => s.shotType === 'Approach');
    const gir = approaches.filter(s => s['Ending Lie'] === 'Green').length;
    
    // Count penalties
    const penalties = roundShots.filter(s => s.Penalty === 'Yes').length;
    
    summaries.push({
      roundId,
      date: firstShot.Date,
      course: firstShot.Course,
      totalShots: roundShots.length,
      strokesGained: totalSG,
      avgStrokesGained: totalSG / roundShots.length,
      fairwaysHit,
      fairwaysTotal: drives.length,
      gir,
      girTotal: approaches.length,
      penalties,
    });
  });
  
  // Sort by date
  summaries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return summaries;
}
