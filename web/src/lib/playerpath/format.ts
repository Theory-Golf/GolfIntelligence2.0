/**
 * Date formatting for PlayerPath.
 *
 * Every tool had rolled its own copy of these, which drifted — some parsed
 * bare `YYYY-MM-DD` with `new Date(d)` (UTC, so it renders as the previous
 * day west of Greenwich) and some appended `T12:00:00` to avoid that. These
 * all take the midday approach, which is correct for both shapes.
 */

/** Parse an ISO date or datetime as local time, never shifting the day. */
function parseLocal(value: string | number | Date): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (!value) return null;
  // A bare date has no timezone, so anchor it at midday local.
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** "Mar 4" */
export function fmtDateShort(value: string | number | Date): string {
  const d = parseLocal(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Mar 4, 2026" */
export function fmtDate(value: string | number | Date): string {
  const d = parseLocal(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "March 4, 2026" */
export function fmtDateLong(value: string | number | Date): string {
  const d = parseLocal(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "today" / "yesterday" / "3 days ago" / "Mar 4" past a fortnight. */
export function fmtRelativeDay(value: string | number | Date): string {
  const d = parseLocal(value);
  if (!d) return '—';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return fmtDateShort(d);
}
