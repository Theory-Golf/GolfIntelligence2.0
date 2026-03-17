/**
 * Golf Intelligence — Performance Drivers Calculation
 * Identifies the top 5 issues hurting player performance
 */

import type { ProcessedShot, Tiger5Metrics, MentalMetrics, BirdieAndBogeyMetrics, DrivingMetrics, ProblemDriveMetrics, ApproachMetrics, ApproachDistanceBucket, ShortGameMetrics, PuttingMetrics, PuttingDistanceBucket, PerformanceDriver, PerformanceDriverSegment, PerformanceDriverRating, PerformanceDriversResult } from './types';

/**
 * Determine the rating based on SG per round
 */
function getRating(sgPerRound: number): PerformanceDriverRating {
  if (sgPerRound <= -2.0) return 'Critical';
  if (sgPerRound <= -1.0) return 'Significant';
  return 'Moderate';
}

/**
 * Generate a dynamic narrative based on the driver details
 */
function generateNarrative(
  segment: PerformanceDriverSegment,
  subCategory: string,
  sgPerRound: number,
  tiger5RootCauses: number,
  occurrenceCount: number,
  rating: PerformanceDriverRating,
  playerValue?: number,
  benchmark?: number
): string {
  const absSG = Math.abs(sgPerRound).toFixed(2);
  const severityText = rating === 'Critical' ? 'severely impacting' : 
                       rating === 'Significant' ? 'notably affecting' : 'a minor concern worth monitoring';
  const priorityText = rating === 'Critical' ? 'top priority' : 
                       rating === 'Significant' ? 'focused practice here could yield meaningful improvement' : 'keep watch during practice';
  
  let contextAddition = '';
  if (playerValue !== undefined && benchmark !== undefined) {
    if (segment === 'Driving' && subCategory === 'Fairway %') {
      contextAddition = ` You're hitting ${playerValue.toFixed(1)}% of fairways (benchmark: ${benchmark.toFixed(1)}%).`;
    } else if (segment === 'Driving' && subCategory.includes('Penalty')) {
      contextAddition = ` ${occurrenceCount} drives resulted in penalties.`;
    } else if (segment === 'Approach') {
      contextAddition = ` Your proximity averages ${playerValue.toFixed(1)} feet vs ${benchmark.toFixed(1)} feet benchmark.`;
    } else if (segment === 'Short Game') {
      contextAddition = ` You're missing the green ${(100 - playerValue).toFixed(1)}% of the time from this lie.`;
    } else if (segment === 'Putting') {
      contextAddition = ` You're making ${playerValue.toFixed(1)}% of putts in this range (benchmark: ${benchmark.toFixed(1)}%).`;
    }
  }
  
  const t5Text = tiger5RootCauses > 0 
    ? ` This was the root cause of ${tiger5RootCauses} Tiger 5 fails.` 
    : '';
    
  return `This is ${severityText} your scoring. You're losing ${absSG} strokes per round on ${subCategory.toLowerCase()}.${t5Text} Addressing this should be ${priorityText}.${contextAddition}`;
}

/**
 * Calculate Performance Drivers - identifies top 5 issues hurting player performance
 * Uses weighted scoring: 60% SG impact + 40% Tiger 5 root cause frequency
 */
export function calculatePerformanceDrivers(
  shots: ProcessedShot[],
  tiger5Metrics: Tiger5Metrics,
  mentalMetrics: MentalMetrics,
  birdieAndBogeyMetrics: BirdieAndBogeyMetrics,
  drivingMetrics: DrivingMetrics,
  problemDriveMetrics: ProblemDriveMetrics,
  approachMetrics: ApproachMetrics,
  approachByDistance: ApproachDistanceBucket[],
  shortGameMetrics: ShortGameMetrics,
  puttingMetrics: PuttingMetrics,
  puttingByDistance: PuttingDistanceBucket[]
): PerformanceDriversResult {
  const roundIds = [...new Set(shots.map(s => s['Round ID']))];
  const totalRounds = roundIds.length;
  
  if (totalRounds === 0 || shots.length === 0) {
    return { drivers: [], totalRounds: 0, calculatedAt: new Date() };
  }
  
  const drivers: PerformanceDriver[] = [];
  const rootCause = tiger5Metrics.rootCause;
  
  const createDriver = (
    segment: PerformanceDriverSegment,
    subCategory: string,
    metricName: string,
    sgImpact: number,
    t5RootCauses: number,
    occurrence: number,
    playerValue?: number,
    benchmark?: number
  ): PerformanceDriver => {
    const sgPerRound = totalRounds > 0 ? sgImpact / totalRounds : 0;
    const rating = getRating(sgPerRound);
    const narrative = generateNarrative(segment, subCategory, sgPerRound, t5RootCauses, occurrence, rating, playerValue, benchmark);
    
    return {
      id: `${segment}-${subCategory}`.toLowerCase().replace(/\s+/g, '-'),
      segment, subCategory, metricName, narrative,
      sgPerRound, totalStrokesLost: sgImpact,
      tiger5RootCauses: t5RootCauses, occurrenceCount: occurrence,
      rating, benchmark, playerValue,
    };
  };
  
  // === DRIVING SEGMENT ===
  const drives = shots.filter(s => s.shotType === 'Drive');
  const drivingSG = drives.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
  if (drivingSG < 0 || rootCause.driving > 0) {
    drivers.push(createDriver('Driving', 'Fairway %', 'Fairway Hit Percentage', drivingSG, rootCause.driving, drives.length, drivingMetrics.fairwayPct, 65));
  }
  if (problemDriveMetrics.obPenalties > 0) {
    drivers.push(createDriver('Driving', 'OB Penalties', 'Out of Bounds Penalties', problemDriveMetrics.obPenaltySG, rootCause.penalties * (problemDriveMetrics.obPenalties / Math.max(1, problemDriveMetrics.totalPenalties)), problemDriveMetrics.obPenalties, problemDriveMetrics.obPenaltyPct, 2));
  }
  if (problemDriveMetrics.totalPenalties > 0) {
    drivers.push(createDriver('Driving', 'Total Penalties', 'Penalty Strokes', problemDriveMetrics.penaltySG, rootCause.penalties, problemDriveMetrics.totalPenalties, problemDriveMetrics.penaltyPct, 3));
  }
  if (problemDriveMetrics.obstructionCount > 0) {
    drivers.push(createDriver('Driving', 'Sand/Recovery', 'Drive in Sand or Recovery', problemDriveMetrics.obstructionSG, 0, problemDriveMetrics.obstructionCount, problemDriveMetrics.obstructionPct, 10));
  }
  
  // === APPROACH SEGMENT ===
  if (approachMetrics.approachSG < 0 || rootCause.approach > 0) {
    const approachShots = shots.filter(s => s.shotType === 'Approach');
    drivers.push(createDriver('Approach', 'Overall', 'Approach Shot Performance', approachMetrics.approachSG, rootCause.approach, approachShots.length, approachMetrics.avgApproachSG, 0));
  }
  approachByDistance.forEach(bucket => {
    if (bucket.strokesGained < 0) {
      drivers.push(createDriver('Approach', bucket.label, `${bucket.label} Approach`, bucket.strokesGained, 0, bucket.totalShots, bucket.avgStrokesGained, 0));
    }
  });
  
  // === SHORT GAME SEGMENT ===
  if (shortGameMetrics.shortGameSG < 0 || rootCause.shortGame > 0) {
    drivers.push(createDriver('Short Game', 'Overall', 'Short Game Performance', shortGameMetrics.shortGameSG, rootCause.shortGame, shortGameMetrics.totalShortGameShots, shortGameMetrics.avgShortGameSG, 0));
  }
  if (shortGameMetrics.totalShortGameFairway > 0) {
    const sgFairway = shots.filter(s => s.shotType === 'Short Game' && s['Starting Lie'] === 'Fairway');
    drivers.push(createDriver('Short Game', 'From Fairway', 'Short Game from Fairway', sgFairway.reduce((sum, s) => sum + s.calculatedStrokesGained, 0), 0, sgFairway.length, shortGameMetrics.within8FeetFairwayPct, 80));
  }
  if (shortGameMetrics.totalShortGameRough > 0) {
    const sgRough = shots.filter(s => s.shotType === 'Short Game' && s['Starting Lie'] === 'Rough');
    drivers.push(createDriver('Short Game', 'From Rough', 'Short Game from Rough', sgRough.reduce((sum, s) => sum + s.calculatedStrokesGained, 0), 0, sgRough.length, shortGameMetrics.within8FeetRoughPct, 60));
  }
  if (shortGameMetrics.totalShortGameSand > 0) {
    const sgSand = shots.filter(s => s.shotType === 'Short Game' && s['Starting Lie'] === 'Sand');
    drivers.push(createDriver('Short Game', 'From Sand', 'Short Game from Sand', sgSand.reduce((sum, s) => sum + s.calculatedStrokesGained, 0), 0, sgSand.length, shortGameMetrics.within8FeetSandPct, 50));
  }
  
  // === PUTTING SEGMENT ===
  if (puttingMetrics.totalSGPutting < 0 || rootCause.makeablePutts > 0 || rootCause.lagPutts > 0) {
    drivers.push(createDriver('Putting', 'Overall', 'Putting Performance', puttingMetrics.totalSGPutting, rootCause.makeablePutts + rootCause.lagPutts, puttingMetrics.totalPutts, puttingMetrics.avgSGPutting, 0));
  }
  if (puttingMetrics.total5to12Ft > 0) {
    drivers.push(createDriver('Putting', 'Makeable (5-12ft)', 'Makeable Putts 5-12 Feet', puttingMetrics.totalSG5to12Ft, rootCause.makeablePutts, puttingMetrics.total5to12Ft, puttingMetrics.total5to12Ft > 0 ? (puttingMetrics.total5to12Ft - Math.abs(puttingMetrics.totalSG5to12Ft)) / puttingMetrics.total5to12Ft * 100 : 0, 40));
  }
  puttingByDistance.forEach(bucket => {
    if (bucket.totalStrokesGained < 0 && bucket.totalPutts > 0) {
      drivers.push(createDriver('Putting', bucket.label, `${bucket.label} Putts`, bucket.totalStrokesGained, 0, bucket.totalPutts, bucket.makePct, 50));
    }
  });
  
  // === MENTAL SEGMENT ===
  if (mentalMetrics.bounceBackPct < 70) {
    drivers.push(createDriver('Mental', 'Bounce Back', 'Bounce Back Percentage', -(70 - mentalMetrics.bounceBackPct) * 0.05 * totalRounds, 0, mentalMetrics.bounceBackTotal, mentalMetrics.bounceBackPct, 70));
  }
  if (mentalMetrics.dropOffPct > 20) {
    drivers.push(createDriver('Mental', 'Drop Off', 'Drop Off After Birdie', -(mentalMetrics.dropOffPct - 20) * 0.05 * totalRounds, 0, mentalMetrics.dropOffTotal, mentalMetrics.dropOffPct, 20));
  }
  if (mentalMetrics.driveAfterT5FailVsBenchmark < -0.2) {
    drivers.push(createDriver('Mental', 'Post-T5 Drive', 'Drive After Tiger 5 Fail', mentalMetrics.driveAfterT5FailSG, 0, mentalMetrics.driveAfterT5FailCount, mentalMetrics.driveAfterT5FailVsBenchmark, 0));
  }
  
  // === SCORING SEGMENT ===
  const overallBogey = birdieAndBogeyMetrics.bogeyRates.find(b => b.par === 0);
  if (overallBogey && overallBogey.bogeyRate > 30) {
    drivers.push(createDriver('Scoring', 'Bogey Rate', 'Bogey Rate', -(overallBogey.bogeyRate - 30) * 0.1 * totalRounds, 0, overallBogey.totalHoles, overallBogey.bogeyRate, 30));
  }
  if (overallBogey && overallBogey.doubleBogeyPlusRate > 10) {
    drivers.push(createDriver('Scoring', 'Double Bogey+', 'Double Bogey+ Rate', -(overallBogey.doubleBogeyPlusRate - 10) * 0.15 * totalRounds, 0, overallBogey.totalHoles, overallBogey.doubleBogeyPlusRate, 10));
  }
  
  // === CALCULATE WEIGHTED SCORES AND SORT ===
  const maxSGImpact = Math.max(...drivers.map(d => Math.abs(d.sgPerRound)), 1);
  const maxT5Root = Math.max(...drivers.map(d => d.tiger5RootCauses), 1);
  
  drivers.forEach(driver => {
    const sgFactor = driver.sgPerRound / maxSGImpact;
    const t5Factor = driver.tiger5RootCauses / maxT5Root;
    (driver as any)._score = (0.6 * sgFactor) + (0.4 * t5Factor);
  });
  
  drivers.sort((a, b) => (a as any)._score - (b as any)._score);
  const top5 = drivers.slice(0, 5);
  top5.forEach(d => delete (d as any)._score);
  
  return { drivers: top5, totalRounds, calculatedAt: new Date() };
}
