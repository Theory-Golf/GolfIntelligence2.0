import type { RoundInsert } from './db/types';
import type { HoleEntry } from './roundSession';

// A round in progress lives only on the device until the player presses
// "Submit round" on the review screen; this is its localStorage record.
export interface RoundDraft {
  version: 1;
  round: RoundInsert;
  courseName: string;
  holePars: Record<number, number>;
  holes: HoleEntry[];
  updatedAt: string;
}

function draftKey(roundId: string): string {
  return `tg_round_draft_${roundId}`;
}

export function readDraft(roundId: string): RoundDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(draftKey(roundId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoundDraft;
    if (!parsed || parsed.version !== 1 || !parsed.round) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft(roundId: string, draft: RoundDraft): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(draftKey(roundId), JSON.stringify(draft));
    return true;
  } catch {
    // Storage full or unavailable — the round is still playable in-memory.
    return false;
  }
}

export function removeDraft(roundId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(draftKey(roundId));
  } catch {
    // ignore
  }
}
