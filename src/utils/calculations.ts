/**
 * Golf Intelligence — Calculations
 * Based on your shot classification rules
 */

import type { RawShot, ProcessedShot, ShotType, ShotCategory, Tiger5Metrics, RoundSummary, Tiger5Fail, HoleScore, RootCauseMetrics, Tiger5FailDetail, Tiger5FailDetails, RootCauseByFailTypeList, RootCauseByFailType, Tiger5TrendDataPoint, SGSeparator, SGShotCategory, SGRoundData, DrivingMetrics, DriveEndingLocationData, DriveDistanceRange, DrivingAnalysis, DriveEndingLocationType, ProblemDriveMetrics, ApproachMetrics, ApproachDistanceBucket } from '../types/golf';
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
 * Group shots by hole and calculate hole scores
 */
export function getHoleScores(shots: ProcessedShot[]): HoleScore[] {
  const holeMap = new Map<string, ProcessedShot[]>();
  
  shots.forEach(shot => {
    const key = `${shot['Round ID']}-${shot.Hole}`;
    if (!holeMap.has(key)) {
      holeMap.set(key, []);
    }
    holeMap.get(key)!.push(shot);
  });
  
  const holeScores: HoleScore[] = [];
  
  holeMap.forEach((holeShots, _key) => {
    const firstShot = holeShots[0];
    const roundId = firstShot['Round ID'];
    const hole = firstShot.Hole;
    const par = firstShot.holePar;
    // Score is the number of shots taken on this hole (each shot = 1 stroke)
    // The CSV Score column is cumulative for the round, so we count shots instead
    const score = holeShots.length;
    
    holeScores.push({
      roundId,
      hole,
      par,
      score,
      shots: holeShots,
    });
  });
  
  return holeScores;
}

/**
 * Calculate Tiger 5 fails from hole scores and shots
 * 
 * Tiger 5 Fails:
 * 1. 3 Putts: >= 3 putts on a hole
 * 2. Bogey on Par 5: Hole score >= 6 on par 5 holes
 * 3. Double Bogey: Hole score >= par + 2
 * 4. Bogey: Approach < 125 - Approach shot from fairway/rough/sand, starting distance <= 125, 
 *    hole score >= par + 1, shot # is shot 1 on par 3, shot 2 on par 4, shot 2 or 3 on par 5
 * 5. Missed Green (Short Game): Short game shot ending NOT on green
 */
export function calculateTiger5Fails(shots: ProcessedShot[], holeScores: HoleScore[], totalRounds: number): Tiger5Fail {
  let threePutts = 0;
  let threePuttsSG = 0;
  let bogeyOnPar5 = 0;
  let bogeyOnPar5SG = 0;
  let doubleBogey = 0;
  let doubleBogeySG = 0;
  let bogeyApproach = 0;
  let bogeyApproachSG = 0;
  let missedGreen = 0;
  let missedGreenSG = 0;
  let sgOnFailHoles = 0;
  
  // Track holes that had any Tiger 5 fail
  const failHoleKeys = new Set<string>();
  
  // Map to track which fail type each hole had (for SG calculation)
  const failTypeByHole = new Map<string, string[]>();
  
  // Check 3 Putts - count putts on each hole
  shots.forEach(shot => {
    if (shot.shotType === 'Putt') {
      // Count total putts on this hole
      const holeKey = `${shot['Round ID']}-${shot.Hole}`;
      const holeShots = shots.filter(s => s['Round ID'] === shot['Round ID'] && s.Hole === shot.Hole);
      const puttCount = holeShots.filter(s => s.shotType === 'Putt').length;
      
      if (puttCount >= 3 && !failHoleKeys.has(holeKey + '-3putt')) {
        threePutts++;
        // Calculate SG for this hole
        const holeSG = holeShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
        threePuttsSG += holeSG;
        failHoleKeys.add(holeKey + '-3putt');
        failHoleKeys.add(holeKey);
        // Track fail type
        if (!failTypeByHole.has(holeKey)) failTypeByHole.set(holeKey, []);
        failTypeByHole.get(holeKey)!.push('threePutts');
      }
    }
  });
  
  // Check Bogey on Par 5, Double Bogey
  holeScores.forEach(hole => {
    const holeKey = `${hole.roundId}-${hole.hole}`;
    const holeShots = shots.filter(s => s['Round ID'] === hole.roundId && s.Hole === hole.hole);
    const holeSG = holeShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
    
    if (hole.par === 5 && hole.score >= 6) {
      bogeyOnPar5++;
      bogeyOnPar5SG += holeSG;
      failHoleKeys.add(`${hole.roundId}-${hole.hole}-bogeyP5`);
      failHoleKeys.add(`${hole.roundId}-${hole.hole}`);
      if (!failTypeByHole.has(holeKey)) failTypeByHole.set(holeKey, []);
      failTypeByHole.get(holeKey)!.push('bogeyOnPar5');
    }
    if (hole.score >= hole.par + 2) {
      doubleBogey++;
      doubleBogeySG += holeSG;
      failHoleKeys.add(`${hole.roundId}-${hole.hole}-dblBogey`);
      failHoleKeys.add(`${hole.roundId}-${hole.hole}`);
      if (!failTypeByHole.has(holeKey)) failTypeByHole.set(holeKey, []);
      failTypeByHole.get(holeKey)!.push('doubleBogey');
    }
  });
  
  // Check Bogey: Approach < 125
  // Approach from fairway, rough, sand with starting distance <= 125
  // Shot 1 on par 3, shot 2 on par 4, shot 2 or 3 on par 5
  shots.forEach(shot => {
    if (shot.shotType === 'Approach') {
      const startDist = shot['Starting Distance'];
      const startLoc = shot['Starting Lie'];
      const shotNum = shot.Shot;
      const holeKey = `${shot['Round ID']}-${shot.Hole}`;
      const hole = holeScores.find(h => h.roundId === shot['Round ID'] && h.hole === shot.Hole);
      
      if (!hole) return;
      
      const isValidLocation = ['Fairway', 'Rough', 'Sand'].includes(startLoc);
      const isValidDistance = startDist <= 125;
      
      let isValidShotNum = false;
      if (hole.par === 3 && shotNum === 1) isValidShotNum = true;
      if (hole.par === 4 && shotNum === 2) isValidShotNum = true;
      if (hole.par === 5 && (shotNum === 2 || shotNum === 3)) isValidShotNum = true;
      
      // Check if hole score >= par + 1
      const isBogeyOrWorse = hole.score >= hole.par + 1;
      
      if (isValidLocation && isValidDistance && isValidShotNum && isBogeyOrWorse) {
        if (!failHoleKeys.has(holeKey + '-bogeyApproach')) {
          bogeyApproach++;
          // Calculate SG for this hole
          const holeShots = shots.filter(s => s['Round ID'] === shot['Round ID'] && s.Hole === shot.Hole);
          const holeSG = holeShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
          bogeyApproachSG += holeSG;
          failHoleKeys.add(holeKey + '-bogeyApproach');
          failHoleKeys.add(holeKey);
          if (!failTypeByHole.has(holeKey)) failTypeByHole.set(holeKey, []);
          failTypeByHole.get(holeKey)!.push('bogeyApproach');
        }
      }
    }
  });
  
  // Check Missed Green (Short Game)
  shots.forEach(shot => {
    if (shot.shotType === 'Short Game') {
      const endLoc = shot['Ending Lie'];
      if (endLoc !== 'Green') {
        const holeKey = `${shot['Round ID']}-${shot.Hole}`;
        if (!failHoleKeys.has(holeKey + '-missedGreen')) {
          missedGreen++;
          // Calculate SG for this hole
          const holeShots = shots.filter(s => s['Round ID'] === shot['Round ID'] && s.Hole === shot.Hole);
          const holeSG = holeShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
          missedGreenSG += holeSG;
          failHoleKeys.add(holeKey + '-missedGreen');
          failHoleKeys.add(holeKey);
          if (!failTypeByHole.has(holeKey)) failTypeByHole.set(holeKey, []);
          failTypeByHole.get(holeKey)!.push('missedGreen');
        }
      }
    }
  });
  
  // Calculate SG on fail holes
  const failRoundHoles = new Set<string>();
  failHoleKeys.forEach(key => {
    // Extract roundId-hole from key (remove fail type suffix)
    const parts = key.split('-');
    if (parts.length >= 3) {
      const roundId = parts[0];
      const hole = parts[1];
      failRoundHoles.add(`${roundId}-${hole}`);
    }
  });
  
  failRoundHoles.forEach(key => {
    const [roundId, holeStr] = key.split('-');
    const hole = parseInt(holeStr);
    const holeShots = shots.filter(s => s['Round ID'] === roundId && s.Hole === hole);
    const holeSG = holeShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
    sgOnFailHoles += holeSG;
  });
  
  const totalFails = threePutts + bogeyOnPar5 + doubleBogey + bogeyApproach + missedGreen;
  const failsPerRound = totalRounds > 0 ? totalFails / totalRounds : 0;
  
  return {
    threePutts,
    threePuttsSG,
    bogeyOnPar5,
    bogeyOnPar5SG,
    doubleBogey,
    doubleBogeySG,
    bogeyApproach,
    bogeyApproachSG,
    missedGreen,
    missedGreenSG,
    totalFails,
    failsPerRound,
    sgOnFailHoles,
  };
}

/**
 * Calculate Root Cause for Tiger 5 fails
 * For each hole with a Tiger 5 fail, identify the shot with the lowest SG value
 * and categorize it as the root cause
 * 
 * Root cause categories:
 * - Penalties: Shot resulted in penalty
 * - Makeable Putts: Putts from 0-12 feet
 * - Lag Putts: Putts from 13+ feet
 * - Driving: Shot type is Drive
 * - Approach: Shot type is Approach
 * - Short Game: Shot type is Short Game
 * - Recovery: Shot type is Recovery
 */
export function calculateRootCause(shots: ProcessedShot[], holeScores: HoleScore[], _tiger5Fails: Tiger5Fail): RootCauseMetrics {
  // Default root cause object
  const defaultRootCause: RootCauseMetrics = {
    totalFailHoles: 0,
    penalties: 0,
    penaltiesSG: 0,
    failHolesWithPenalty: 0,
    makeablePutts: 0,
    makeablePuttsSG: 0,
    lagPutts: 0,
    lagPuttsSG: 0,
    driving: 0,
    drivingSG: 0,
    approach: 0,
    approachSG: 0,
    shortGame: 0,
    shortGameSG: 0,
    recovery: 0,
    recoverySG: 0,
  };

  if (shots.length === 0) {
    return defaultRootCause;
  }

  // Get holes with Tiger 5 fails
  const failHoleKeys = new Set<string>();
  
  // We need to identify fail holes from the tiger5Fails counts
  // Check each hole if it had a Tiger 5 fail
  holeScores.forEach(hole => {
    const holeShots = shots.filter(s => s['Round ID'] === hole.roundId && s.Hole === hole.hole);
    if (holeShots.length === 0) return;
    
    const holeKey = `${hole.roundId}-${hole.hole}`;
    
    // Check if this hole had a Tiger 5 fail based on criteria
    const has3Putts = holeShots.filter(s => s.shotType === 'Putt').length >= 3;
    const hasBogeyOnPar5 = hole.par === 5 && hole.score >= 6;
    const hasDoubleBogey = hole.score >= hole.par + 2;
    const hasBogeyApproach = holeShots.some(s => {
      if (s.shotType !== 'Approach') return false;
      const startDist = s['Starting Distance'];
      const startLoc = s['Starting Lie'];
      const shotNum = s.Shot;
      const isValidLocation = ['Fairway', 'Rough', 'Sand'].includes(startLoc);
      const isValidDistance = startDist <= 125;
      let isValidShotNum = false;
      if (hole.par === 3 && shotNum === 1) isValidShotNum = true;
      if (hole.par === 4 && shotNum === 2) isValidShotNum = true;
      if (hole.par === 5 && (shotNum === 2 || shotNum === 3)) isValidShotNum = true;
      return isValidLocation && isValidDistance && isValidShotNum && hole.score >= hole.par + 1;
    });
    const hasMissedGreen = holeShots.some(s => {
      if (s.shotType !== 'Short Game') return false;
      return s['Ending Lie'] !== 'Green';
    });
    
    const isFailHole = has3Putts || hasBogeyOnPar5 || hasDoubleBogey || hasBogeyApproach || hasMissedGreen;
    
    if (isFailHole) {
      failHoleKeys.add(holeKey);
    }
  });

  // Now for each fail hole, find the shot with lowest SG (the root cause)
  const rootCause: RootCauseMetrics = {
    totalFailHoles: failHoleKeys.size,
    penalties: 0,
    penaltiesSG: 0,
    failHolesWithPenalty: 0,
    makeablePutts: 0,
    makeablePuttsSG: 0,
    lagPutts: 0,
    lagPuttsSG: 0,
    driving: 0,
    drivingSG: 0,
    approach: 0,
    approachSG: 0,
    shortGame: 0,
    shortGameSG: 0,
    recovery: 0,
    recoverySG: 0,
  };

  // Track holes with penalties
  const failHolesWithPenalties = new Set<string>();

  failHoleKeys.forEach(holeKey => {
    const [roundId, holeStr] = holeKey.split('-');
    const hole = parseInt(holeStr);
    const holeShots = shots.filter(s => s['Round ID'] === roundId && s.Hole === hole);
    
    // Check if hole has penalty
    const hasPenalty = holeShots.some(s => s.Penalty === 'Yes');
    if (hasPenalty) {
      failHolesWithPenalties.add(holeKey);
    }
    
    // Find shot with lowest SG (most negative = worst)
    let worstShot: ProcessedShot | null = null;
    let lowestSG = Infinity;
    
    for (const shot of holeShots) {
      if (shot.calculatedStrokesGained < lowestSG) {
        lowestSG = shot.calculatedStrokesGained;
        worstShot = shot;
      }
    }
    
    if (worstShot) {
      // Categorize the root cause
      const startDist = worstShot['Starting Distance'];
      const shotType: ShotType = worstShot.shotType;
      const isPenalty: boolean = worstShot.Penalty === 'Yes';
      const shotSG = worstShot.calculatedStrokesGained;
      
      if (isPenalty) {
        rootCause.penalties++;
        rootCause.penaltiesSG += shotSG;
      } else if (shotType === 'Putt') {
        // Check putt distance
        if (startDist <= 12) {
          rootCause.makeablePutts++;
          rootCause.makeablePuttsSG += shotSG;
        } else {
          rootCause.lagPutts++;
          rootCause.lagPuttsSG += shotSG;
        }
      } else if (shotType === 'Drive') {
        rootCause.driving++;
        rootCause.drivingSG += shotSG;
      } else if (shotType === 'Approach') {
        rootCause.approach++;
        rootCause.approachSG += shotSG;
      } else if (shotType === 'Short Game') {
        rootCause.shortGame++;
        rootCause.shortGameSG += shotSG;
      } else if (shotType === 'Recovery') {
        rootCause.recovery++;
        rootCause.recoverySG += shotSG;
      }
    }
  });

  rootCause.failHolesWithPenalty = failHolesWithPenalties.size;

  return rootCause;
}

/**
 * Filter shots based on Tiger 5 fail type
 * - 3 Putts: only putts
 * - Short Game misses: only short game shots
 * - Bogey <125: only approach and putts
 * - Other fails: all shots
 */
function filterShotsForFailType(failType: string, holeShots: ProcessedShot[]): ProcessedShot[] {
  switch (failType) {
    case '3 Putts':
      // Only putts
      return holeShots.filter(s => s.shotType === 'Putt');
    case 'Missed Green':
      // Only short game shots
      return holeShots.filter(s => s.shotType === 'Short Game');
    case 'Bogey: Approach <125':
      // Only approach and putts
      return holeShots.filter(s => s.shotType === 'Approach' || s.shotType === 'Putt');
    default:
      // All shots
      return holeShots;
  }
}

/**
 * Calculate Tiger 5 fail details - grouped by fail type, sorted by date ascending
 */
export function calculateTiger5FailDetails(shots: ProcessedShot[], holeScores: HoleScore[]): Tiger5FailDetails {
  const details: Tiger5FailDetails = {
    threePutts: [],
    bogeyOnPar5: [],
    doubleBogey: [],
    bogeyApproach: [],
    missedGreen: [],
  };

  holeScores.forEach(hole => {
    const holeShots = shots.filter(s => s['Round ID'] === hole.roundId && s.Hole === hole.hole);
    if (holeShots.length === 0) return;
    
    const firstShot = holeShots[0];
    const date = firstShot.Date;
    const course = firstShot.Course;
    
    // Check each fail type
    const puttCount = holeShots.filter(s => s.shotType === 'Putt').length;
    if (puttCount >= 3) {
      details.threePutts.push({
        date,
        course,
        hole: hole.hole,
        par: hole.par,
        score: hole.score,
        failType: '3 Putts',
        shots: filterShotsForFailType('3 Putts', holeShots),
      });
    }
    
    if (hole.par === 5 && hole.score >= 6) {
      details.bogeyOnPar5.push({
        date,
        course,
        hole: hole.hole,
        par: hole.par,
        score: hole.score,
        failType: 'Bogey on Par 5',
        shots: filterShotsForFailType('Bogey on Par 5', holeShots),
      });
    }
    
    if (hole.score >= hole.par + 2) {
      details.doubleBogey.push({
        date,
        course,
        hole: hole.hole,
        par: hole.par,
        score: hole.score,
        failType: 'Double Bogey',
        shots: filterShotsForFailType('Double Bogey', holeShots),
      });
    }
    
    // Check Bogey: Approach <125
    const hasBogeyApproach = holeShots.some(s => {
      if (s.shotType !== 'Approach') return false;
      const startDist = s['Starting Distance'];
      const startLoc = s['Starting Lie'];
      const shotNum = s.Shot;
      const isValidLocation = ['Fairway', 'Rough', 'Sand'].includes(startLoc);
      const isValidDistance = startDist <= 125;
      let isValidShotNum = false;
      if (hole.par === 3 && shotNum === 1) isValidShotNum = true;
      if (hole.par === 4 && shotNum === 2) isValidShotNum = true;
      if (hole.par === 5 && (shotNum === 2 || shotNum === 3)) isValidShotNum = true;
      return isValidLocation && isValidDistance && isValidShotNum && hole.score >= hole.par + 1;
    });
    
    if (hasBogeyApproach) {
      details.bogeyApproach.push({
        date,
        course,
        hole: hole.hole,
        par: hole.par,
        score: hole.score,
        failType: 'Bogey: Approach <125',
        shots: filterShotsForFailType('Bogey: Approach <125', holeShots),
      });
    }
    
    // Check Missed Green
    const hasMissedGreen = holeShots.some(s => {
      if (s.shotType !== 'Short Game') return false;
      return s['Ending Lie'] !== 'Green';
    });
    
    if (hasMissedGreen) {
      details.missedGreen.push({
        date,
        course,
        hole: hole.hole,
        par: hole.par,
        score: hole.score,
        failType: 'Missed Green',
        shots: filterShotsForFailType('Missed Green', holeShots),
      });
    }
  });
  
  // Sort each category by date ascending (oldest first)
  const sortByDate = (a: Tiger5FailDetail, b: Tiger5FailDetail) => 
    new Date(a.date).getTime() - new Date(b.date).getTime();
  
  details.threePutts.sort(sortByDate);
  details.bogeyOnPar5.sort(sortByDate);
  details.doubleBogey.sort(sortByDate);
  details.bogeyApproach.sort(sortByDate);
  details.missedGreen.sort(sortByDate);
  
  return details;
}

/**
 * Calculate Tiger 5 trend data - grouped by round
 * Returns data for each round with fail counts and total score
 */
export function calculateTiger5Trend(shots: ProcessedShot[], holeScores: HoleScore[]): Tiger5TrendDataPoint[] {
  // Get unique rounds
  const roundIds = [...new Set(shots.map(s => s['Round ID']))];
  const trendData: Tiger5TrendDataPoint[] = [];

  roundIds.forEach(roundId => {
    const roundShots = shots.filter(s => s['Round ID'] === roundId);
    const roundHoleScores = holeScores.filter(h => h.roundId === roundId);
    
    if (roundShots.length === 0 || roundHoleScores.length === 0) return;
    
    const firstShot = roundShots[0];
    const date = firstShot.Date;
    const course = firstShot.Course;
    
    // Calculate total score for the round
    const totalScore = roundHoleScores.reduce((sum, h) => sum + h.score, 0);
    
    // Count fails by type for this round
    let threePutts = 0;
    let bogeyOnPar5 = 0;
    let doubleBogey = 0;
    let bogeyApproach = 0;
    let missedGreen = 0;
    
    roundHoleScores.forEach(hole => {
      const holeShots = roundShots.filter(s => s.Hole === hole.hole);
      const puttCount = holeShots.filter(s => s.shotType === 'Putt').length;
      
      if (puttCount >= 3) threePutts++;
      if (hole.par === 5 && hole.score >= 6) bogeyOnPar5++;
      if (hole.score >= hole.par + 2) doubleBogey++;
      
      // Check bogey approach
      const hasBogeyApproach = holeShots.some(s => {
        if (s.shotType !== 'Approach') return false;
        const startDist = s['Starting Distance'];
        const startLoc = s['Starting Lie'];
        const shotNum = s.Shot;
        const isValidLocation = ['Fairway', 'Rough', 'Sand'].includes(startLoc);
        const isValidDistance = startDist <= 125;
        let isValidShotNum = false;
        if (hole.par === 3 && shotNum === 1) isValidShotNum = true;
        if (hole.par === 4 && shotNum === 2) isValidShotNum = true;
        if (hole.par === 5 && (shotNum === 2 || shotNum === 3)) isValidShotNum = true;
        return isValidLocation && isValidDistance && isValidShotNum && hole.score >= hole.par + 1;
      });
      if (hasBogeyApproach) bogeyApproach++;
      
      // Check missed green
      const hasMissedGreen = holeShots.some(s => {
        if (s.shotType !== 'Short Game') return false;
        return s['Ending Lie'] !== 'Green';
      });
      if (hasMissedGreen) missedGreen++;
    });
    
    trendData.push({
      roundId,
      date,
      course,
      threePutts,
      bogeyOnPar5,
      doubleBogey,
      bogeyApproach,
      missedGreen,
      totalScore,
    });
  });

  // Sort by date ascending
  trendData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return trendData;
}

/**
 * Calculate root cause breakdown by fail type
 * For each fail type, identify the root cause (lowest SG shot) and categorize it
 */
export function calculateRootCauseByFailType(shots: ProcessedShot[], holeScores: HoleScore[], totalFails: number): RootCauseByFailTypeList {
  const defaultRootCause: RootCauseByFailType = {
    failType: '',
    totalCount: 0,
    makeablePutts: 0,
    makeablePuttsSG: 0,
    lagPutts: 0,
    lagPuttsSG: 0,
    driving: 0,
    drivingSG: 0,
    approach: 0,
    approachSG: 0,
    shortGame: 0,
    shortGameSG: 0,
    recovery: 0,
    recoverySG: 0,
    penalties: 0,
    penaltiesSG: 0,
  };

  const result: RootCauseByFailTypeList = {
    threePutts: { ...defaultRootCause, failType: '3 Putts' },
    bogeyOnPar5: { ...defaultRootCause, failType: 'Bogey on Par 5' },
    doubleBogey: { ...defaultRootCause, failType: 'Double Bogey' },
    bogeyApproach: { ...defaultRootCause, failType: 'Bogey: Approach <125' },
    missedGreen: { ...defaultRootCause, failType: 'Missed Green' },
  };

  // Track starting lie for missed green
  const missedGreenByLie: Map<string, { count: number; sgTotal: number }> = new Map();

  holeScores.forEach(hole => {
    const holeShots = shots.filter(s => s['Round ID'] === hole.roundId && s.Hole === hole.hole);
    if (holeShots.length === 0) return;
    
    // Find the worst shot (lowest SG) - this is the root cause
    let worstShot: ProcessedShot | null = null;
    let lowestSG = Infinity;
    
    for (const shot of holeShots) {
      if (shot.calculatedStrokesGained < lowestSG) {
        lowestSG = shot.calculatedStrokesGained;
        worstShot = shot;
      }
    }
    
    if (!worstShot) return;
    
    const startDist = worstShot['Starting Distance'];
    const shotType = worstShot.shotType;
    const startLie = worstShot['Starting Lie'];
    const isPenalty = worstShot.Penalty === 'Yes';
    const shotSG = worstShot.calculatedStrokesGained;
    
    // Determine which fail type this hole is
    const puttCount = holeShots.filter(s => s.shotType === 'Putt').length;
    const is3Putts = puttCount >= 3;
    const isBogeyOnPar5 = hole.par === 5 && hole.score >= 6;
    const isDoubleBogey = hole.score >= hole.par + 2;
    const hasBogeyApproach = holeShots.some(s => {
      if (s.shotType !== 'Approach') return false;
      const sDist = s['Starting Distance'];
      const sLoc = s['Starting Lie'];
      const sNum = s.Shot;
      const isValidLocation = ['Fairway', 'Rough', 'Sand'].includes(sLoc);
      const isValidDistance = sDist <= 125;
      let isValidShotNum = false;
      if (hole.par === 3 && sNum === 1) isValidShotNum = true;
      if (hole.par === 4 && sNum === 2) isValidShotNum = true;
      if (hole.par === 5 && (sNum === 2 || sNum === 3)) isValidShotNum = true;
      return isValidLocation && isValidDistance && isValidShotNum && hole.score >= hole.par + 1;
    });
    const hasMissedGreen = holeShots.some(s => {
      if (s.shotType !== 'Short Game') return false;
      return s['Ending Lie'] !== 'Green';
    });
    
    // Categorize root cause
    const categorizeRootCause = (target: RootCauseByFailType) => {
      if (isPenalty) {
        target.penalties++;
        target.penaltiesSG += shotSG;
      } else if (shotType === 'Putt') {
        if (startDist <= 12) {
          target.makeablePutts++;
          target.makeablePuttsSG += shotSG;
        } else {
          target.lagPutts++;
          target.lagPuttsSG += shotSG;
        }
      } else if (shotType === 'Drive') {
        target.driving++;
        target.drivingSG += shotSG;
      } else if (shotType === 'Approach') {
        target.approach++;
        target.approachSG += shotSG;
      } else if (shotType === 'Short Game') {
        target.shortGame++;
        target.shortGameSG += shotSG;
        // Track by starting lie for missed green
        if (target.failType === 'Missed Green') {
          const current = missedGreenByLie.get(startLie) || { count: 0, sgTotal: 0 };
          missedGreenByLie.set(startLie, { count: current.count + 1, sgTotal: current.sgTotal + shotSG });
        }
      } else if (shotType === 'Recovery') {
        target.recovery++;
        target.recoverySG += shotSG;
      }
    };
    
    if (is3Putts) {
      categorizeRootCause(result.threePutts);
      result.threePutts.totalCount++;
    }
    if (isBogeyOnPar5) {
      categorizeRootCause(result.bogeyOnPar5);
      result.bogeyOnPar5.totalCount++;
    }
    if (isDoubleBogey) {
      categorizeRootCause(result.doubleBogey);
      result.doubleBogey.totalCount++;
    }
    if (hasBogeyApproach) {
      categorizeRootCause(result.bogeyApproach);
      result.bogeyApproach.totalCount++;
    }
    if (hasMissedGreen) {
      categorizeRootCause(result.missedGreen);
      result.missedGreen.totalCount++;
    }
  });
  
  // Add starting lie breakdown for missed green
  if (result.missedGreen.totalCount > 0) {
    const byStartingLie: { lie: string; count: number; percentageOfFailType: number; percentageOfTotal: number; sgTotal: number }[] = [];
    missedGreenByLie.forEach((value, lie) => {
      byStartingLie.push({
        lie,
        count: value.count,
        percentageOfFailType: (value.count / result.missedGreen.totalCount) * 100,
        percentageOfTotal: totalFails > 0 ? (value.count / totalFails) * 100 : 0,
        sgTotal: value.sgTotal,
      });
    });
    // Sort by count descending
    byStartingLie.sort((a, b) => b.count - a.count);
    result.missedGreen.byStartingLie = byStartingLie;
  }
  
  return result;
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
    // Pass penalty flag: shot.Penalty === 'Yes' means this shot resulted in a penalty
    const isPenalty = shot.Penalty === 'Yes';
    const calculatedSG = calculateStrokesGained(
      benchmark,
      shot['Starting Distance'],
      shot['Starting Lie'],
      shot['Ending Distance'],
      shot['Ending Lie'],
      isPenalty
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
  // Default fail object
  const defaultTiger5Fails: Tiger5Fail = {
    threePutts: 0,
    threePuttsSG: 0,
    bogeyOnPar5: 0,
    bogeyOnPar5SG: 0,
    doubleBogey: 0,
    doubleBogeySG: 0,
    bogeyApproach: 0,
    bogeyApproachSG: 0,
    missedGreen: 0,
    missedGreenSG: 0,
    totalFails: 0,
    failsPerRound: 0,
    sgOnFailHoles: 0,
  };
  
  if (shots.length === 0) {
    const defaultRootCause: RootCauseMetrics = {
      totalFailHoles: 0,
      penalties: 0,
      penaltiesSG: 0,
      failHolesWithPenalty: 0,
      makeablePutts: 0,
      makeablePuttsSG: 0,
      lagPutts: 0,
      lagPuttsSG: 0,
      driving: 0,
      drivingSG: 0,
      approach: 0,
      approachSG: 0,
      shortGame: 0,
      shortGameSG: 0,
      recovery: 0,
      recoverySG: 0,
    };
    const defaultFailDetails: Tiger5FailDetails = {
      threePutts: [],
      bogeyOnPar5: [],
      doubleBogey: [],
      bogeyApproach: [],
      missedGreen: [],
    };
    const defaultRootCauseByFailType: RootCauseByFailTypeList = {
      threePutts: { failType: '3 Putts', totalCount: 0, makeablePutts: 0, makeablePuttsSG: 0, lagPutts: 0, lagPuttsSG: 0, driving: 0, drivingSG: 0, approach: 0, approachSG: 0, shortGame: 0, shortGameSG: 0, recovery: 0, recoverySG: 0, penalties: 0, penaltiesSG: 0 },
      bogeyOnPar5: { failType: 'Bogey on Par 5', totalCount: 0, makeablePutts: 0, makeablePuttsSG: 0, lagPutts: 0, lagPuttsSG: 0, driving: 0, drivingSG: 0, approach: 0, approachSG: 0, shortGame: 0, shortGameSG: 0, recovery: 0, recoverySG: 0, penalties: 0, penaltiesSG: 0 },
      doubleBogey: { failType: 'Double Bogey', totalCount: 0, makeablePutts: 0, makeablePuttsSG: 0, lagPutts: 0, lagPuttsSG: 0, driving: 0, drivingSG: 0, approach: 0, approachSG: 0, shortGame: 0, shortGameSG: 0, recovery: 0, recoverySG: 0, penalties: 0, penaltiesSG: 0 },
      bogeyApproach: { failType: 'Bogey: Approach <125', totalCount: 0, makeablePutts: 0, makeablePuttsSG: 0, lagPutts: 0, lagPuttsSG: 0, driving: 0, drivingSG: 0, approach: 0, approachSG: 0, shortGame: 0, shortGameSG: 0, recovery: 0, recoverySG: 0, penalties: 0, penaltiesSG: 0 },
      missedGreen: { failType: 'Missed Green', totalCount: 0, makeablePutts: 0, makeablePuttsSG: 0, lagPutts: 0, lagPuttsSG: 0, driving: 0, drivingSG: 0, approach: 0, approachSG: 0, shortGame: 0, shortGameSG: 0, recovery: 0, recoverySG: 0, penalties: 0, penaltiesSG: 0 },
    };
    const defaultSGSeparators: SGSeparator[] = [];
    return {
      totalStrokesGained: 0,
      avgStrokesGained: 0,
      totalRounds: 0,
      totalShots: 0,
      scoringAvg: 0,
      fairwayPct: 0,
      girPct: 0,
      byCategory: [],
      tiger5Fails: defaultTiger5Fails,
      rootCause: defaultRootCause,
      failDetails: defaultFailDetails,
      rootCauseByFailType: defaultRootCauseByFailType,
      tiger5Trend: [],
      lowestRound: 0,
      highestRound: 0,
      avgScore: 0,
      sgSeparators: defaultSGSeparators,
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
  
  // Calculate hole scores for Tiger 5 fails
  const holeScores = getHoleScores(shots);
  const tiger5Fails = calculateTiger5Fails(shots, holeScores, totalRounds);
  const rootCause = calculateRootCause(shots, holeScores, tiger5Fails);
  const failDetails = calculateTiger5FailDetails(shots, holeScores);
  const rootCauseByFailType = calculateRootCauseByFailType(shots, holeScores, tiger5Fails.totalFails);
  const tiger5Trend = calculateTiger5Trend(shots, holeScores);
  
  // Calculate SG Separators
  const sgSeparators = calculateSGSeparators(shots);
  
  // Calculate round scores (total strokes per round)
  const roundScores = new Map<string, number>();
  const roundSG = new Map<string, number>();
  
  shots.forEach(shot => {
    const roundId = shot['Round ID'];
    if (!roundScores.has(roundId)) {
      roundScores.set(roundId, 0);
      roundSG.set(roundId, 0);
    }
    // Get the last shot's score for this round to get total score
  });
  
  // Get score per round (using the last shot's Score value for each hole, then summing)
  roundIds.forEach(roundId => {
    const roundShots = shots.filter(s => s['Round ID'] === roundId);
    // Find max score (total score for the round)
    let maxScore = 0;
    roundShots.forEach(s => {
      if (s.Score > maxScore) maxScore = s.Score;
    });
    roundScores.set(roundId, maxScore);
    
    // Calculate SG per round
    const sg = roundShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
    roundSG.set(roundId, sg);
  });
  
  const scores = Array.from(roundScores.values());
  
  const lowestRound = scores.length > 0 ? Math.min(...scores) : 0;
  const highestRound = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  // Note: avgSGPerRound is calculated in the component from metrics.totalStrokesGained / totalRounds
  
  return {
    totalStrokesGained,
    avgStrokesGained,
    totalRounds,
    totalShots,
    scoringAvg: avgScore,
    fairwayPct,
    girPct,
    byCategory,
    tiger5Fails,
    rootCause,
    failDetails,
    rootCauseByFailType,
    tiger5Trend,
    lowestRound,
    highestRound,
    avgScore,
    sgSeparators,
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

/**
 * Calculate Strokes Gained Separators by distance buckets
 * 
 * SG Driving - All Drive shots
 * SG Short shots 0-35 yards - Starting distance 0-35 yards
 * SG Short Approach 100-150 - Starting distance 100-150 yards  
 * SG Distance Wedges 50-100 - Starting distance 50-100 yards
 * SG Putting 5-12 feet - Putts from 5-12 feet (60-144 inches)
 */
export function calculateSGSeparators(shots: ProcessedShot[]): SGSeparator[] {
  // SG Driving - All Drive shots
  const drivingShots = shots.filter(s => s.shotType === 'Drive');
  const drivingSG = drivingShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
  
  // SG Short shots 0-35 yards - Shot type Short Game + Starting distance 0-35 yards
  const shortShots0to35 = shots.filter(s => {
    if (s.shotType !== 'Short Game') return false;
    const startDist = s['Starting Distance'];
    return startDist >= 0 && startDist <= 35;
  });
  const shortShots0to35SG = shortShots0to35.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
  
  // SG Short Approach 100-150 - Shot type Approach + Starting distance 100-150 yards
  const shortApproach100to150 = shots.filter(s => {
    if (s.shotType !== 'Approach') return false;
    const startDist = s['Starting Distance'];
    return startDist >= 100 && startDist <= 150;
  });
  const shortApproach100to150SG = shortApproach100to150.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
  
  // SG Distance Wedges 50-100 - Shot type Approach + Starting distance 50-100 yards
  const distanceWedges50to100 = shots.filter(s => {
    if (s.shotType !== 'Approach') return false;
    const startDist = s['Starting Distance'];
    return startDist >= 50 && startDist <= 100;
  });
  const distanceWedges50to100SG = distanceWedges50to100.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
  
  // SG Putting 5-12 feet - Putts from 5-12 feet
  const putting5to12 = shots.filter(s => {
    if (s.shotType !== 'Putt') return false;
    const startDist = s['Starting Distance'];
    return startDist >= 5 && startDist <= 12;
  });
  const putting5to12SG = putting5to12.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
  
  const separators: SGSeparator[] = [
    {
      label: 'Driving',
      description: 'All drives',
      totalShots: drivingShots.length,
      strokesGained: drivingSG,
      avgStrokesGained: drivingShots.length > 0 ? drivingSG / drivingShots.length : 0,
    },
    {
      label: 'Short Shots',
      description: '0-35 yards',
      totalShots: shortShots0to35.length,
      strokesGained: shortShots0to35SG,
      avgStrokesGained: shortShots0to35.length > 0 ? shortShots0to35SG / shortShots0to35.length : 0,
    },
    {
      label: 'Short Approach',
      description: '100-150 yards',
      totalShots: shortApproach100to150.length,
      strokesGained: shortApproach100to150SG,
      avgStrokesGained: shortApproach100to150.length > 0 ? shortApproach100to150SG / shortApproach100to150.length : 0,
    },
    {
      label: 'Distance Wedges',
      description: '50-100 yards',
      totalShots: distanceWedges50to100.length,
      strokesGained: distanceWedges50to100SG,
      avgStrokesGained: distanceWedges50to100.length > 0 ? distanceWedges50to100SG / distanceWedges50to100.length : 0,
    },
    {
      label: 'Putting',
      description: '5-12 feet',
      totalShots: putting5to12.length,
      strokesGained: putting5to12SG,
      avgStrokesGained: putting5to12.length > 0 ? putting5to12SG / putting5to12.length : 0,
    },
  ];
  
  return separators;
}

/**
 * Calculate moving average for a series of values
 * @param values - Array of numeric values
 * @param window - Window size for moving average
 * @returns Array with moving average values (null for first window-1 elements)
 */
export function calculateMovingAverage(values: number[], window: number): (number | null)[] {
  if (values.length === 0 || window <= 0) {
    return [];
  }
  
  const result: (number | null)[] = [];
  
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      // Not enough data points for a full window
      result.push(null);
    } else {
      // Calculate average of last 'window' values
      let sum = 0;
      for (let j = 0; j < window; j++) {
        sum += values[i - j];
      }
      result.push(sum / window);
    }
  }
  
  return result;
}

/**
 * Map shot category string to internal shot types
 */
function getShotTypesForCategory(category: SGShotCategory): ShotType[] {
  switch (category) {
    case 'Driving':
      return ['Drive'];
    case 'Approach':
      return ['Approach'];
    case 'Short Game':
      return ['Short Game'];
    case 'Putting':
      return ['Putt'];
    default:
      return [];
  }
}

/**
 * Check if a shot is Out of Bounds (OB)
 * OB: Ending lie and distance is the same as starting lie and distance AND shot has a penalty
 */
export function isOutOfBounds(shot: ProcessedShot): boolean {
  if (shot.Penalty !== 'Yes') {
    return false;
  }
  return shot['Starting Lie'] === shot['Ending Lie'] && 
         shot['Starting Distance'] === shot['Ending Distance'];
}

/**
 * Calculate 75th percentile of an array of numbers
 */
function calculate75thPercentile(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.75) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate driving metrics from processed shots
 * - Penalty Rate: Total penalties / Total drives (as percentage)
 * - OB penalties count as 2 strokes for the rate display, but count as 1 for the ratio
 */
export function calculateDrivingMetrics(shots: ProcessedShot[]): DrivingMetrics {
  // Filter to only drives
  const drives = shots.filter(s => s.shotType === 'Drive');
  
  if (drives.length === 0) {
    return {
      totalDrives: 0,
      fairwaysHit: 0,
      fairwayPct: 0,
      drivingSG: 0,
      avgDrivingSG: 0,
      drivingDistance75th: 0,
      totalPenalties: 0,
      obPenalties: 0,
      otherPenalties: 0,
      penaltyRate: 0,
      sgPenalties: 0,
      fairwayPctDriver: 0,
      fairwayPctNonDriver: 0,
      positiveSGPct: 0,
    };
  }
  
  // Calculate fairways (drives that ended in Fairway)
  const fairwaysHit = drives.filter(d => d['Ending Lie'] === 'Fairway').length;
  const fairwayPct = (fairwaysHit / drives.length) * 100;
  
  // Calculate fairway % by driver type
  // Driver: Did not hit driver = No (or empty/undefined)
  // Non-Driver: Did not hit driver = Yes
  const driverDrives = drives.filter(d => d['Did not Hit Driver'] !== 'Yes');
  const nonDriverDrives = drives.filter(d => d['Did not Hit Driver'] === 'Yes');
  
  const driverFairways = driverDrives.filter(d => d['Ending Lie'] === 'Fairway').length;
  const nonDriverFairways = nonDriverDrives.filter(d => d['Ending Lie'] === 'Fairway').length;
  
  const fairwayPctDriver = driverDrives.length > 0 ? (driverFairways / driverDrives.length) * 100 : 0;
  const fairwayPctNonDriver = nonDriverDrives.length > 0 ? (nonDriverFairways / nonDriverDrives.length) * 100 : 0;
  
  // Calculate driving SG
  const drivingSG = drives.reduce((sum, d) => sum + d.calculatedStrokesGained, 0);
  const avgDrivingSG = drivingSG / drives.length;
  
  // Calculate 75th percentile of driving distances
  // For each drive, calculate the absolute difference between starting and ending distance
  const drivingDistances = drives
    .map(d => Math.abs(d['Starting Distance'] - d['Ending Distance']))
    .filter(d => d > 0); // Filter out drives where distance didn't change (likely penalties)
  const drivingDistance75th = calculate75thPercentile(drivingDistances);
  
  // Calculate penalties
  let totalPenalties = 0;
  let obPenalties = 0;
  let otherPenalties = 0;
  let sgPenalties = 0; // Total SG for drives with a penalty shot
  
  drives.forEach(drive => {
    if (drive.Penalty === 'Yes') {
      totalPenalties++;
      sgPenalties += drive.calculatedStrokesGained;
      if (isOutOfBounds(drive)) {
        obPenalties++;
      } else {
        otherPenalties++;
      }
    }
  });
  
  // Penalty rate: (OB penalties × 2 + Other penalties × 1) / Total drives (as percentage)
  const weightedPenalties = (obPenalties * 2) + (otherPenalties * 1);
  const penaltyRate = (weightedPenalties / drives.length) * 100;
  
  // Calculate % of drives with SG > 0
  const positiveDrives = drives.filter(d => d.calculatedStrokesGained > 0).length;
  const positiveSGPct = (positiveDrives / drives.length) * 100;

  return {
    totalDrives: drives.length,
    fairwaysHit,
    fairwayPct,
    drivingSG,
    avgDrivingSG,
    drivingDistance75th,
    totalPenalties,
    obPenalties,
    otherPenalties,
    penaltyRate,
    sgPenalties,
    fairwayPctDriver,
    fairwayPctNonDriver,
    positiveSGPct,
  };
}

/**
 * Get strokes gained data by round for a specific shot category
 * @param shots - Processed shots
 * @param category - Shot category (Driving, Approach, Short Game, Putting)
 * @returns Array of round-level SG data sorted by date
 */
export function getRoundSGByShotType(shots: ProcessedShot[], category: SGShotCategory): SGRoundData[] {
  const shotTypes = getShotTypesForCategory(category);
  
  // Filter shots by category
  const filteredShots = shots.filter(s => shotTypes.includes(s.shotType));
  
  // Group by round
  const roundMap = new Map<string, ProcessedShot[]>();
  
  filteredShots.forEach(shot => {
    const roundId = shot['Round ID'];
    if (!roundMap.has(roundId)) {
      roundMap.set(roundId, []);
    }
    roundMap.get(roundId)!.push(shot);
  });
  
  // Convert to array and sort by date
  const roundData: SGRoundData[] = [];
  
  roundMap.forEach((roundShots, roundId) => {
    if (roundShots.length === 0) return;
    
    const firstShot = roundShots[0];
    const totalSG = roundShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
    
    roundData.push({
      roundId,
      roundNumber: 0, // Will be assigned after sorting
      date: firstShot.Date,
      course: firstShot.Course,
      strokesGained: totalSG,
      shotCount: roundShots.length,
      avgStrokesGained: totalSG / roundShots.length,
    });
  });
  
  // Sort by date ascending
  roundData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Assign round numbers
  roundData.forEach((data, index) => {
    data.roundNumber = index + 1;
  });
  
  return roundData;
}

/**
 * Normalize ending lie to standard categories
 * Maps various possible ending lie values to our defined categories
 */
function normalizeEndingLie(endingLie: string): DriveEndingLocationType {
  const lie = endingLie?.trim() || '';
  
  if (lie === 'Fairway') return 'Fairway';
  if (lie === 'Rough') return 'Rough';
  if (lie === 'Sand') return 'Sand';
  if (lie === 'Green') return 'Green';
  if (lie === 'Tee') return 'Other';
  if (lie === 'Recovery') return 'Other';
  
  // Check for OB (Out of Bounds)
  if (lie.toLowerCase().includes('out') || lie.toLowerCase().includes('ob')) {
    return 'Out of Bounds';
  }
  
  // Check for water/hazard
  if (lie.toLowerCase().includes('water') || lie.toLowerCase().includes('hazard') || lie.toLowerCase().includes('penalty')) {
    return 'Water';
  }
  
  return 'Other';
}

/**
 * Calculate drive ending location breakdown
 * Returns data for donut chart showing percentage of drives by ending location
 */
export function calculateDriveEndingLocations(shots: ProcessedShot[]): DriveEndingLocationData[] {
  const drives = shots.filter(s => s.shotType === 'Drive');
  
  if (drives.length === 0) {
    return [];
  }
  
  // Count drives by ending location
  const locationCounts = new Map<DriveEndingLocationType, { count: number; sgTotal: number }>();
  
  drives.forEach(drive => {
    const normalizedLocation = normalizeEndingLie(drive['Ending Lie']);
    const current = locationCounts.get(normalizedLocation) || { count: 0, sgTotal: 0 };
    locationCounts.set(normalizedLocation, {
      count: current.count + 1,
      sgTotal: current.sgTotal + drive.calculatedStrokesGained
    });
  });
  
  // Convert to array with percentages
  const result: DriveEndingLocationData[] = [];
  
  locationCounts.forEach((data, location) => {
    result.push({
      location,
      count: data.count,
      percentage: (data.count / drives.length) * 100,
      strokesGained: data.sgTotal,
      avgStrokesGained: data.count > 0 ? data.sgTotal / data.count : 0,
    });
  });
  
  // Sort by count descending
  result.sort((a, b) => b.count - a.count);
  
  return result;
}

/**
 * Calculate drive distance analysis by distance ranges
 * Returns data for bar/line chart showing SG and score differential by distance
 */
export function calculateDriveDistanceAnalysis(shots: ProcessedShot[]): DriveDistanceRange[] {
  const drives = shots.filter(s => s.shotType === 'Drive');
  
  if (drives.length === 0) {
    return [];
  }
  
  // Define distance ranges (in yards)
  const distanceRanges = [
    { label: '< 200', minDistance: 0, maxDistance: 200 },
    { label: '200-225', minDistance: 200, maxDistance: 225 },
    { label: '225-250', minDistance: 225, maxDistance: 250 },
    { label: '250-275', minDistance: 250, maxDistance: 275 },
    { label: '275-300', minDistance: 275, maxDistance: 300 },
    { label: '300+', minDistance: 300, maxDistance: 9999 },
  ];
  
  // Calculate drive distance for each drive
  const drivesWithDistance = drives.map(drive => {
    const distance = Math.abs(drive['Starting Distance'] - drive['Ending Distance']);
    return {
      ...drive,
      driveDistance: distance
    };
  });
  
  // Calculate metrics for each distance range
  const result: DriveDistanceRange[] = distanceRanges.map(range => {
    const rangeDrives = drivesWithDistance.filter(
      d => d.driveDistance > range.minDistance && d.driveDistance <= range.maxDistance
    );
    
    const count = rangeDrives.length;
    const sgTotal = count > 0 ? rangeDrives.reduce((sum, d) => sum + d.calculatedStrokesGained, 0) : 0;
    
    // Calculate score differential for this range
    // Score differential = average score on holes with drives in this range vs par
    // For simplicity, we'll use SG as a proxy (negative SG = worse than benchmark)
    // Higher positive SG = better performance
    const avgSG = count > 0 ? sgTotal / count : 0;
    
    return {
      label: range.label,
      minDistance: range.minDistance,
      maxDistance: range.maxDistance,
      count,
      percentage: (count / drives.length) * 100,
      strokesGained: sgTotal,
      avgStrokesGained: avgSG,
      // Score differential is approximated from SG (positive SG = better than average = lower score)
      // Using negative of SG since lower scores are better
      scoreDifferential: -avgSG,
    };
  });
  
  // Filter out ranges with no data
  return result.filter(r => r.count > 0);
}

/**
 * Calculate complete driving analysis
 */
export function calculateDrivingAnalysis(shots: ProcessedShot[]): DrivingAnalysis {
  return {
    endingLocations: calculateDriveEndingLocations(shots),
    distanceRanges: calculateDriveDistanceAnalysis(shots),
  };
}

/**
 * Calculate Problem Drive metrics - penalties and obstruction breakdown
 * - Penalties: Total, OB, Standard (non-OB)
 * - Obstruction: drives ending in Sand or Recovery
 */
export function calculateProblemDriveMetrics(shots: ProcessedShot[]): ProblemDriveMetrics {
  // Default return if no shots
  const defaultMetrics: ProblemDriveMetrics = {
    totalDrives: 0,
    totalPenalties: 0,
    obPenalties: 0,
    standardPenalties: 0,
    penaltyPct: 0,
    penaltySG: 0,
    obPenaltyPct: 0,
    obPenaltySG: 0,
    standardPenaltyPct: 0,
    standardPenaltySG: 0,
    obstructionCount: 0,
    obstructionPct: 0,
    obstructionSG: 0,
    sandCount: 0,
    sandPct: 0,
    sandSG: 0,
    recoveryCount: 0,
    recoveryPct: 0,
    recoverySG: 0,
  };

  // Get all drives
  const drives = shots.filter(s => s.shotType === 'Drive');

  if (drives.length === 0) {
    return defaultMetrics;
  }

  // Initialize counters
  let totalPenalties = 0;
  let obPenalties = 0;
  let standardPenalties = 0;
  let penaltySG = 0;
  let obPenaltySG = 0;
  let standardPenaltySG = 0;

  let sandCount = 0;
  let sandSG = 0;
  let recoveryCount = 0;
  let recoverySG = 0;

  // Process each drive
  drives.forEach(drive => {
    // Check for penalties
    if (drive.Penalty === 'Yes') {
      totalPenalties++;
      penaltySG += drive.calculatedStrokesGained;

      // Check if OB
      if (isOutOfBounds(drive)) {
        obPenalties++;
        obPenaltySG += drive.calculatedStrokesGained;
      } else {
        standardPenalties++;
        standardPenaltySG += drive.calculatedStrokesGained;
      }
    }

    // Check for Sand
    if (drive['Ending Lie'] === 'Sand') {
      sandCount++;
      sandSG += drive.calculatedStrokesGained;
    }

    // Check for Recovery (drive ending in recovery lie)
    if (drive['Ending Lie'] === 'Recovery') {
      recoveryCount++;
      recoverySG += drive.calculatedStrokesGained;
    }
  });

  // Calculate obstruction (sand + recovery)
  const obstructionCount = sandCount + recoveryCount;
  const obstructionSG = sandSG + recoverySG;

  // Calculate percentages
  const penaltyPct = (totalPenalties / drives.length) * 100;
  const obPenaltyPct = (obPenalties / drives.length) * 100;
  const standardPenaltyPct = (standardPenalties / drives.length) * 100;
  const obstructionPct = (obstructionCount / drives.length) * 100;
  const sandPct = (sandCount / drives.length) * 100;
  const recoveryPct = (recoveryCount / drives.length) * 100;

  return {
    totalDrives: drives.length,
    totalPenalties,
    obPenalties,
    standardPenalties,
    penaltyPct,
    penaltySG,
    obPenaltyPct,
    obPenaltySG,
    standardPenaltyPct,
    standardPenaltySG,
    obstructionCount,
    obstructionPct,
    obstructionSG,
    sandCount,
    sandPct,
    sandSG,
    recoveryCount,
    recoveryPct,
    recoverySG,
  };
}

/**
 * Calculate Approach metrics
 * - Total SG Approach
 * - Green Hit % = % of Approach shots with ending lie = Green
 * - Proximity < 150 = average proximity of approach shots <= 150 yards
 */
export function calculateApproachMetrics(shots: ProcessedShot[]): ApproachMetrics {
  // Filter to only approach shots
  const approaches = shots.filter(s => s.shotType === 'Approach');
  
  if (approaches.length === 0) {
    return {
      totalApproaches: 0,
      approachSG: 0,
      avgApproachSG: 0,
      positiveSGPct: 0,
      positiveSGCount: 0,
      greenHitPct: 0,
      greenHits: 0,
      greenHitPctFairway: 0,
      greenHitsFairway: 0,
      totalApproachesFairway: 0,
      greenHitPctRough: 0,
      greenHitsRough: 0,
      totalApproachesRough: 0,
      proximityUnder150: 0,
      proximityUnder150Count: 0,
      proximityUnder150OnGreen: 0,
      proximityUnder150OnGreenCount: 0,
      within20FeetPct: 0,
      within20FeetCount: 0,
      approachesOver150: 0,
      approachesUnder150: 0,
      greenHitPctOver150: 0,
      greenHitPctUnder150: 0,
    };
  }
  
  // Total SG - Approach
  const approachSG = approaches.reduce((sum, s) => sum + s.calculatedStrokesGained, 0);
  const avgApproachSG = approachSG / approaches.length;
  
  // % of approaches with SG > 0
  const positiveSGCount = approaches.filter(s => s.calculatedStrokesGained > 0).length;
  const positiveSGPct = (positiveSGCount / approaches.length) * 100;
  
  // Green Hit % - approaches ending on Green
  const greenHits = approaches.filter(s => s['Ending Lie'] === 'Green').length;
  const greenHitPct = (greenHits / approaches.length) * 100;
  
  // Green Hit % by starting lie (Fairway, Rough)
  const approachesFairway = approaches.filter(s => s['Starting Lie'] === 'Fairway');
  const approachesRough = approaches.filter(s => s['Starting Lie'] === 'Rough');
  
  const greenHitsFairway = approachesFairway.filter(s => s['Ending Lie'] === 'Green').length;
  const greenHitsRough = approachesRough.filter(s => s['Ending Lie'] === 'Green').length;
  
  const totalApproachesFairway = approachesFairway.length;
  const totalApproachesRough = approachesRough.length;
  
  const greenHitPctFairway = totalApproachesFairway > 0 
    ? (greenHitsFairway / totalApproachesFairway) * 100 
    : 0;
  
  const greenHitPctRough = totalApproachesRough > 0 
    ? (greenHitsRough / totalApproachesRough) * 100 
    : 0;
  
  // Proximity < 150 - average proximity for approaches <= 150 yards
  // Proximity = ending distance from hole (Ending Distance)
  // Note: For shots NOT on green, ending distance is in YARDS and needs to be converted to FEET (x3)
  // For shots on green, ending distance is already in FEET
  const approachesUnder150 = approaches.filter(s => s['Starting Distance'] <= 150);
  const approachesOver150 = approaches.filter(s => s['Starting Distance'] > 150);
  
  const proximityUnder150Count = approachesUnder150.length;
  // Convert yards to feet for shots not on green
  const proximityUnder150 = proximityUnder150Count > 0 
    ? approachesUnder150.reduce((sum, s) => {
        const endingDist = s['Ending Distance'];
        // If not on green, distance is in yards - convert to feet
        const distInFeet = s['Ending Lie'] === 'Green' ? endingDist : endingDist * 3;
        return sum + distInFeet;
      }, 0) / proximityUnder150Count 
    : 0;
  
  // Proximity < 150 on Green - average proximity for approaches <= 150 yards that ended on green
  const approachesUnder150OnGreen = approachesUnder150.filter(s => s['Ending Lie'] === 'Green');
  const proximityUnder150OnGreenCount = approachesUnder150OnGreen.length;
  // For green shots, ending distance is already in feet
  const proximityUnder150OnGreen = proximityUnder150OnGreenCount > 0 
    ? approachesUnder150OnGreen.reduce((sum, s) => sum + s['Ending Distance'], 0) / proximityUnder150OnGreenCount 
    : 0;
  
  // Within 20 feet - % of approaches ending on the green within 20 feet of the hole
  // Only include shots that end on the green (already in feet)
  const within20FeetOnGreen = approaches.filter(s => s['Ending Lie'] === 'Green' && s['Ending Distance'] <= 20);
  const within20FeetCount = within20FeetOnGreen.length;
  const within20FeetPct = (within20FeetCount / approaches.length) * 100;
  
  // Green hit % by distance
  const greenHitsUnder150 = approachesUnder150.filter(s => s['Ending Lie'] === 'Green').length;
  const greenHitsOver150 = approachesOver150.filter(s => s['Ending Lie'] === 'Green').length;
  
  const greenHitPctUnder150 = approachesUnder150.length > 0 
    ? (greenHitsUnder150 / approachesUnder150.length) * 100 
    : 0;
  
  const greenHitPctOver150 = approachesOver150.length > 0 
    ? (greenHitsOver150 / approachesOver150.length) * 100 
    : 0;
  
  return {
    totalApproaches: approaches.length,
    approachSG,
    avgApproachSG,
    positiveSGPct,
    positiveSGCount,
    greenHitPct,
    greenHits,
    greenHitPctFairway,
    greenHitsFairway,
    totalApproachesFairway,
    greenHitPctRough,
    greenHitsRough,
    totalApproachesRough,
    proximityUnder150,
    proximityUnder150Count,
    proximityUnder150OnGreen,
    proximityUnder150OnGreenCount,
    within20FeetPct,
    within20FeetCount,
    approachesOver150: approachesOver150.length,
    approachesUnder150: approachesUnder150.length,
    greenHitPctOver150,
    greenHitPctUnder150,
  };
}

/**
 * Calculate Approach by Distance metrics
 * - Filter to approach shots from Tee and Fairway only
 * - Group by distance buckets
 * - Calculate SG, Green %, and Proximity for each bucket
 * 
 * Distance buckets:
 * - 51-100 yards: Distance Wedges
 * - 101-150 yards: Short Approach
 * - 151-200 yards: Medium Approach
 * - 201-225 yards: Long Approach
 */
export function calculateApproachByDistance(shots: ProcessedShot[]): ApproachDistanceBucket[] {
  // Filter to approach shots from Tee and Fairway only
  const approachShots = shots.filter(s => 
    s.shotType === 'Approach' && 
    (s['Starting Lie'] === 'Tee' || s['Starting Lie'] === 'Fairway')
  );
  
  // Define distance buckets
  const buckets = [
    { label: 'Distance Wedges', description: '51-100 yards', minDistance: 51, maxDistance: 100 },
    { label: 'Short Approach', description: '101-150 yards', minDistance: 101, maxDistance: 150 },
    { label: 'Medium Approach', description: '151-200 yards', minDistance: 151, maxDistance: 200 },
    { label: 'Long Approach', description: '201-225 yards', minDistance: 201, maxDistance: 225 },
  ];
  
  // Calculate metrics for each bucket
  const results: ApproachDistanceBucket[] = buckets.map(bucket => {
    const bucketShots = approachShots.filter(s => 
      s['Starting Distance'] >= bucket.minDistance && 
      s['Starting Distance'] <= bucket.maxDistance
    );
    
    const totalShots = bucketShots.length;
    
    // Calculate SG
    const strokesGained = totalShots > 0 
      ? bucketShots.reduce((sum, s) => sum + s.calculatedStrokesGained, 0)
      : 0;
    const avgStrokesGained = totalShots > 0 ? strokesGained / totalShots : 0;
    
    // Calculate Green Hit %
    const greenHits = bucketShots.filter(s => s['Ending Lie'] === 'Green').length;
    const greenHitPct = totalShots > 0 ? (greenHits / totalShots) * 100 : 0;
    
    // Calculate Proximity
    // Shots on green: ending distance is already in feet
    // Shots not on green: ending distance is in yards, convert to feet (×3)
    const proximity = totalShots > 0 
      ? bucketShots.reduce((sum, s) => {
          const endingDist = s['Ending Distance'];
          // If not on green, distance is in yards - convert to feet
          const distInFeet = s['Ending Lie'] === 'Green' ? endingDist : endingDist * 3;
          return sum + distInFeet;
        }, 0) / totalShots
      : 0;
    
    // Proximity on green only
    const greenShots = bucketShots.filter(s => s['Ending Lie'] === 'Green');
    const proximityOnGreen = greenShots.length > 0 
      ? greenShots.reduce((sum, s) => sum + s['Ending Distance'], 0) / greenShots.length
      : 0;
    
    return {
      label: bucket.label,
      description: bucket.description,
      minDistance: bucket.minDistance,
      maxDistance: bucket.maxDistance,
      totalShots,
      strokesGained,
      avgStrokesGained,
      greenHits,
      greenHitPct,
      proximity,
      proximityOnGreen,
    };
  });
  
  // Filter out buckets with no shots
  return results.filter(b => b.totalShots > 0);
}
