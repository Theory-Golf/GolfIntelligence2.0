import { isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * Auth failures come in two flavours and they must not be treated alike:
 *
 *  - the credentials or the session are genuinely no good (sign the player
 *    out, ask them to sign in again), or
 *  - the request never got an answer — course wifi dropped, the phone woke
 *    from sleep mid-flight, Supabase returned a 5xx.
 *
 * Only the first is a reason to end a session. WebKit reports a failed
 * `fetch` as the bare string "Load failed", which is what iOS players were
 * seeing on the sign-in screen, and what a mid-round bounce to /login was
 * really made of.
 */

const TRANSIENT_MESSAGE =
  /load failed|failed to fetch|network ?error|network request failed|network connection was lost|timed? ?out|timeout|aborted|econnreset|socket hang up/i;

// 0 is what supabase-js records for a fetch that never reached the server.
const TRANSIENT_STATUS = new Set([0, 408, 425, 429, 499, 500, 502, 503, 504]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '';
}

/** True when the failure is the connection, not the player's credentials. */
export function isTransientAuthError(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;

  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && TRANSIENT_STATUS.has(status)) return true;

  // A plain TypeError from `fetch` (no Supabase wrapper) looks like nothing
  // else, so it's matched on the message the runtime chose.
  return TRANSIENT_MESSAGE.test(errorMessage(error));
}

/**
 * What to put on screen. Supabase's own wording is fine for a real auth
 * failure ("Invalid login credentials"); a dropped connection needs
 * translating, because "Load failed" tells a player nothing.
 */
export function describeAuthError(error: unknown): string {
  if (isTransientAuthError(error)) {
    return "Couldn't reach the server. Check your connection and try again — nothing you've entered is lost.";
  }
  const message = errorMessage(error).trim();
  return message || 'Something went wrong. Try again.';
}
