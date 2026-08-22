/**
 * localStorage access for PlayerPath tools.
 *
 * Six tools had each rolled their own try-catch wrapper and three had their
 * own availability probe (`_it_probe`, `_i20_probe`, `_wc_probe`), which is
 * the same code written six ways. This is that code, once.
 *
 * Since Phase 1 localStorage is the offline cache, not the source of truth —
 * practice results live in `drill_sessions`. Every call here fails soft:
 * private browsing and full quotas are normal, not exceptional.
 */

export function isAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const probe = '__tg_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function get<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function set(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or unavailable — the account copy is authoritative */
  }
}

export function del(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

/** Object form, for tools that already call `storage.get(...)`. */
export const storage = { get, set, del, isAvailable };
