import { LS_PRACTICE_CURRENT_SESSION, LS_PRACTICE_SESSIONS } from '@/lib/constants';
import type { WeekConfig, Session, SessionRecord, HistoryEntry, PlannerExport } from './types';

const KEY_PREFIX = 'tg_practice_';

// The one-time upload reads completed sessions by their full key, so the two
// must agree. Fail loudly at import time rather than silently missing rows.
if (KEY_PREFIX + 'sessions' !== LS_PRACTICE_SESSIONS) {
  throw new Error(
    `Practice session storage key drifted: "${KEY_PREFIX}sessions" vs "${LS_PRACTICE_SESSIONS}"`,
  );
}
// The resume bar on game pages checks this key to know a session is running.
if (KEY_PREFIX + 'currentSession' !== LS_PRACTICE_CURRENT_SESSION) {
  throw new Error(
    `Current-session storage key drifted: "${KEY_PREFIX}currentSession" vs "${LS_PRACTICE_CURRENT_SESSION}"`,
  );
}

export const EXPORT_VERSION = 2;

type StorageMap = {
  weekConfig: WeekConfig;
  currentSession: Session;
  history: HistoryEntry[];
  sessions: SessionRecord[];
};

function read<K extends keyof StorageMap>(key: K): StorageMap[K] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key);
    return raw ? (JSON.parse(raw) as StorageMap[K]) : null;
  } catch {
    return null;
  }
}

function write<K extends keyof StorageMap>(key: K, value: StorageMap[K] | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) {
      window.localStorage.removeItem(KEY_PREFIX + key);
    } else {
      window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
    }
  } catch {
    // ignore quota / unavailable storage
  }
}

export const storage = {
  loadAll() {
    return {
      weekConfig: read('weekConfig'),
      currentSession: read('currentSession'),
      history: read('history') ?? [],
      sessions: read('sessions') ?? [],
    };
  },
  saveWeekConfig(v: WeekConfig | null) {
    write('weekConfig', v);
  },
  saveSession(v: Session | null) {
    write('currentSession', v);
  },
  saveHistory(v: HistoryEntry[]) {
    write('history', v);
  },
  saveSessions(v: SessionRecord[]) {
    write('sessions', v);
  },
  clearAll() {
    write('weekConfig', null);
    write('currentSession', null);
    write('history', null);
    write('sessions', null);
  },
};

export function isPlannerExport(data: unknown): data is PlannerExport {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'number') return false;
  if (!Array.isArray(d.history)) return false;
  // sessions was added in v2 — v1 backups legitimately omit it
  if (d.sessions !== undefined && !Array.isArray(d.sessions)) return false;
  // weekConfig and currentSession may be null
  return true;
}
