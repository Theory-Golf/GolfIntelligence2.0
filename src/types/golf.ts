/**
 * Golf Intelligence — Data Types
 */

// Raw shot data from Google Sheet
export interface RawShot {
  Player: string;
  'Round ID': string;
  Date: string;
  Course: string;
  'Weather Difficulty': string;
  'Course Difficulty': string;
  Tournament: string;
  Benchmark: string;
  Shot: number;
  Hole: number;
  Score: number;
  'Starting Distance': number;
  'Starting Location': string;
  'Ending Distance': number;
  'Ending Location': string;
  Penalty: string;
  'Starting SG': number;
  'Ending SG': number;
  'Strokes Gained': number;
}

// Shot type classification
export type ShotType = 'Drive' | 'Approach' | 'Recovery' | 'Short Game' | 'Putt';

// Processed shot data with computed fields
export interface ProcessedShot extends RawShot {
  shotType: ShotType;
  holePar: number;
  scoreToPar: number; // Will need round-level data to calculate
}

// Shot category for aggregation
export interface ShotCategory {
  type: ShotType;
  totalShots: number;
  strokesGained: number;
  avgStrokesGained: number;
}

// Round-level summary
export interface RoundSummary {
  roundId: string;
  date: string;
  course: string;
  totalShots: number;
  strokesGained: number;
  avgStrokesGained: number;
  fairwaysHit: number;
  fairwaysTotal: number;
  gir: number;
  girTotal: number;
  penalties: number;
}

// Tiger 5 summary metrics
export interface Tiger5Metrics {
  totalStrokesGained: number;
  avgStrokesGained: number;
  totalRounds: number;
  totalShots: number;
  scoringAvg: number;
  fairwayPct: number;
  girPct: number;
  byCategory: ShotCategory[];
}

// Tab configuration
export interface Tab {
  id: string;
  label: string;
  path: string;
}

export const TABS: Tab[] = [
  { id: 'tiger5', label: 'Tiger 5', path: '/' },
  { id: 'scoring', label: 'Scoring', path: '/scoring' },
  { id: 'sg', label: 'Strokes Gained', path: '/strokes-gained' },
  { id: 'driving', label: 'Driving', path: '/driving' },
  { id: 'approach', label: 'Approach', path: '/approach' },
  { id: 'shortgame', label: 'Short Game', path: '/short-game' },
  { id: 'putting', label: 'Putting', path: '/putting' },
  { id: 'path', label: 'Player Path', path: '/player-path' },
  { id: 'coaching', label: 'Coaching', path: '/coaching' },
];
