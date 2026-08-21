/**
 * Stable client ids for practice results.
 *
 * `drill_sessions` is unique on (player_id, drill_type, client_id), so this
 * value decides whether a write creates a row or updates one. It must be
 * generated once per practice session and never regenerated on retry.
 */

/** A fresh id for a session being created now. */
export function newClientId(): string {
  return crypto.randomUUID();
}

/**
 * A deterministic UUID for a session that predates client ids.
 *
 * Older locally-stored sessions are keyed on a timestamp or an array index,
 * so the one-time upload has nothing stable to send. Hashing the drill type
 * plus whatever identity the stored row does have produces the same UUID on
 * every run — so re-running the upload collides with itself and updates,
 * instead of inserting a second copy.
 *
 * Uses FNV-1a over four offsets to fill 16 bytes. Not cryptographic; it only
 * needs to be stable and collision-free within one player's history.
 */
export function derivedClientId(drillType: string, seed: string | number): string {
  const input = `${drillType}:${seed}`;
  const bytes = new Uint8Array(16);
  for (let block = 0; block < 4; block++) {
    let hash = 0x811c9dc5 ^ block;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    bytes[block * 4 + 0] = (hash >>> 24) & 0xff;
    bytes[block * 4 + 1] = (hash >>> 16) & 0xff;
    bytes[block * 4 + 2] = (hash >>> 8) & 0xff;
    bytes[block * 4 + 3] = hash & 0xff;
  }
  // Stamp version 4 / variant 10xx so the value is a well-formed UUID.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
