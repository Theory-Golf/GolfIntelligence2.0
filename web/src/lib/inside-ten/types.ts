export type Tier = 'elite' | 'tour' | 'competitive' | 'developing';

export interface InsideTenSession {
  id: string;
  date: string;       // ISO 8601, YYYY-MM-DD
  timestamp: number;  // Date.now() at save — used for sorting
  score: number;      // 0–18
  sg: number;         // stored to 2 decimal places
  tier: Tier;
}

export interface InsideTenStore {
  version: 1;
  sessions: InsideTenSession[];
}
