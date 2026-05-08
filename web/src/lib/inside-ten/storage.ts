import type { InsideTenSession, InsideTenStore } from './types';
import { scoreToSG, scoreToTier } from './scoring';

const KEY = 'theory.golf:player-path:inside-ten:v1';

function load(): InsideTenStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { version: 1, sessions: [] };
    const parsed = JSON.parse(raw) as InsideTenStore;
    if (parsed.version !== 1) {
      console.warn('[inside-ten] Schema version mismatch — falling back to empty store');
      return { version: 1, sessions: [] };
    }
    return parsed;
  } catch {
    return { version: 1, sessions: [] };
  }
}

function save(store: InsideTenStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Private browsing or quota exceeded — fail silently
  }
}

export function isStorageAvailable(): boolean {
  try {
    const probe = '__tg_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

// Returns sessions sorted most-recent first
export function loadSessions(): InsideTenSession[] {
  return load().sessions.slice().sort((a, b) => b.timestamp - a.timestamp);
}

export function addSession(score: number, date?: string): InsideTenSession {
  const store = load();
  const session: InsideTenSession = {
    id: crypto.randomUUID(),
    date: date ?? new Date().toISOString().slice(0, 10),
    timestamp: Date.now(),
    score,
    sg: Math.round(scoreToSG(score) * 100) / 100,
    tier: scoreToTier(score),
  };
  store.sessions.push(session);
  save(store);
  return session;
}

export function deleteSession(id: string): void {
  const store = load();
  store.sessions = store.sessions.filter(s => s.id !== id);
  save(store);
}

export function clearAll(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
