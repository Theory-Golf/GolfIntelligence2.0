#!/usr/bin/env node
/**
 * Verifies that practice results actually reach a player's account and come
 * back on another device.
 *
 * This exists because it cannot be checked from a sandboxed CI/agent
 * environment: the Supabase project host is not reachable from one, so the
 * client round trip has to be exercised from a machine that can talk to it.
 * The server-side guarantees (RLS isolation, the insert policy, upsert
 * idempotency) are already proven in SQL — what this covers is the part only
 * a real authenticated client can show.
 *
 * What it asserts, in order:
 *   1. A real sign-in produces a session whose uid is what writes are keyed to.
 *   2. A drill session written through the app's exact upsert lands.
 *   3. A SECOND, independent client signed in as the same player sees it —
 *      this is the cross-device proof, and the whole point of the feature.
 *   4. Replaying the identical write, which is what an offline-queue flush
 *      does, updates the row instead of duplicating it.
 *   5. A different player cannot see it (only if a second login is supplied).
 *
 * It writes only rows of drill_type '_verify' and deletes them on the way out,
 * including after a failure, so real practice history is never touched.
 *
 * Usage, from web/:
 *   TG_TEST_EMAIL=you@example.com TG_TEST_PASSWORD=... \
 *     node scripts/verify-practice-sync.mjs
 *
 * Optionally add a second account to also prove cross-player isolation:
 *   TG_OTHER_EMAIL=other@example.com TG_OTHER_PASSWORD=... 
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from
 * .env.local, or from the environment if already set.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const DRILL_TYPE = '_verify';

// ── env ───────────────────────────────────────────────────────────
function loadEnvLocal() {
  try {
    for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local — rely on the environment */
  }
}
loadEnvLocal();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.TG_TEST_EMAIL;
const PASSWORD = process.env.TG_TEST_PASSWORD;

if (!URL_ || !KEY) die('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or add .env.local).');
if (!EMAIL || !PASSWORD) die('Set TG_TEST_EMAIL and TG_TEST_PASSWORD to an account you can sign in as.');

// ── reporting ─────────────────────────────────────────────────────
let failures = 0;
const ok = (cond, msg, detail) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}${detail ? `  [${detail}]` : ''}`);
  if (!cond) failures++;
};
const step = (msg) => console.log(`\n• ${msg}`);
function die(msg) {
  console.error('\n' + msg);
  process.exit(2);
}

/** A fresh client with its own auth storage — i.e. a separate device. */
function newDevice() {
  return createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) die(`${label}: sign-in failed — ${error.message}`);
  return data.user.id;
}

// Deliberately NOT a uuid. client_id was declared uuid until 0008 widened it
// to text, and six drills (Lag Putt Test, Round Simulation, Wedge Standard,
// Driver Standard, Approach Standard, Practice Planner) key sessions off
// Date.now(). Because this script used to generate a uuid here, it passed
// throughout the entire period those six drills could not save at all. Keep
// this shape: it is the one the real drills produce.
const clientId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
let deviceA;

try {
  // ── 1. Sign in ──────────────────────────────────────────────────
  step('1. Sign in (device A)');
  deviceA = newDevice();
  const uid = await signIn(deviceA, EMAIL, PASSWORD, 'device A');
  ok(!!uid, 'session established', `uid ${uid.slice(0, 8)}…`);

  // ── 2. Write, exactly as saveDrillSession does ──────────────────
  step('2. Write a practice result');
  const playedAt = new Date().toISOString();
  const { error: wErr } = await deviceA
    .from('drill_sessions')
    .upsert(
      { player_id: uid, drill_type: DRILL_TYPE, client_id: clientId, played_at: playedAt, payload: { write: 1 } },
      { onConflict: 'player_id,drill_type,client_id' },
    );
  ok(!wErr, 'write accepted', wErr?.message);

  const { data: mine } = await deviceA.from('drill_sessions').select('*').eq('client_id', clientId);
  ok(mine?.length === 1, 'exactly one row on device A', `got ${mine?.length ?? 0}`);
  ok(mine?.[0]?.player_id === uid, 'row is keyed to the signed-in player');

  // ── 3. The actual point: a different device sees it ─────────────
  step('3. Read it back on a second, independent client (cross-device)');
  const deviceB = newDevice();
  const uidB = await signIn(deviceB, EMAIL, PASSWORD, 'device B');
  ok(uidB === uid, 'same player on device B');
  const { data: theirs, error: rErr } = await deviceB
    .from('drill_sessions').select('*').eq('client_id', clientId);
  ok(!rErr, 'read accepted', rErr?.message);
  ok(theirs?.length === 1, 'device B sees the result device A wrote', `got ${theirs?.length ?? 0}`);
  ok(theirs?.[0]?.payload?.write === 1, 'payload survived the round trip');

  // ── 4. Replay, as the offline queue would on reconnect ──────────
  step('4. Replay the same write (offline-queue flush)');
  const before = theirs[0].updated_at;
  await new Promise((r) => setTimeout(r, 1100)); // let the clock move
  const { error: r2Err } = await deviceB
    .from('drill_sessions')
    .upsert(
      { player_id: uid, drill_type: DRILL_TYPE, client_id: clientId, played_at: new Date().toISOString(), payload: { write: 2 } },
      { onConflict: 'player_id,drill_type,client_id' },
    );
  ok(!r2Err, 'replay accepted', r2Err?.message);
  const { data: after } = await deviceB.from('drill_sessions').select('*').eq('client_id', clientId);
  ok(after?.length === 1, 'still one row — no duplicate', `got ${after?.length ?? 0}`);
  ok(after?.[0]?.updated_at > before, 'updated_at advanced (trigger fired)');
  ok(after?.[0]?.payload?.write === 2, 'newer payload won');

  // ── 5. Isolation, if a second account was supplied ──────────────
  if (process.env.TG_OTHER_EMAIL && process.env.TG_OTHER_PASSWORD) {
    step('5. A different player cannot see it');
    const other = newDevice();
    const otherUid = await signIn(other, process.env.TG_OTHER_EMAIL, process.env.TG_OTHER_PASSWORD, 'other player');
    ok(otherUid !== uid, 'second account is a different player');
    const { data: leaked } = await other.from('drill_sessions').select('id').eq('client_id', clientId);
    ok((leaked?.length ?? 0) === 0, 'row is NOT visible to the other player', `saw ${leaked?.length ?? 0}`);
    await other.auth.signOut();
  } else {
    step('5. Cross-player isolation — skipped');
    console.log('  set TG_OTHER_EMAIL / TG_OTHER_PASSWORD to include it');
  }

  await deviceB.auth.signOut();
} finally {
  // Always clean up, including after a failure.
  if (deviceA) {
    const { error } = await deviceA.from('drill_sessions').delete().eq('drill_type', DRILL_TYPE);
    if (error) console.log(`\n  note: could not remove '${DRILL_TYPE}' rows — ${error.message}`);
    await deviceA.auth.signOut();
  }
}

console.log(
  failures
    ? `\nFAILED — ${failures} check${failures === 1 ? '' : 's'} did not pass.`
    : '\nAll practice-sync checks passed. History follows the player across devices.',
);
process.exit(failures ? 1 : 0);
