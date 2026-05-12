import type { WeekConfig, Session, HistoryEntry, PlannerExport } from './types';

const KEY_PREFIX = 'tg_practice_';

type StorageMap = {
  weekConfig: WeekConfig;
  currentSession: Session;
  history: HistoryEntry[];
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
  clearAll() {
    write('weekConfig', null);
    write('currentSession', null);
    write('history', null);
  },
};

export function isPlannerExport(data: unknown): data is PlannerExport {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'number') return false;
  if (!Array.isArray(d.history)) return false;
  // weekConfig and currentSession may be null
  return true;
}
