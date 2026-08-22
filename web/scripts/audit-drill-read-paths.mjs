#!/usr/bin/env node
/**
 * Guards against a whole class of bug: a practice surface that WRITES results
 * to the player's account but READS its history from localStorage only.
 *
 * When that happens nothing errors — the write lands, the row is in
 * `drill_sessions`, RLS is fine, the round-trip script passes — but a session
 * played on a phone is invisible on a laptop, because each surface rebuilds
 * its list from the device it is on. That shipped once. This catches it.
 *
 * Purely static: it reads source, talks to nothing, and runs anywhere.
 *
 *   node scripts/audit-drill-read-paths.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

// A surface counts as reading from the account if it calls the merge helper
// directly, or a per-game wrapper around it that this audit also verifies.
// Matches both a plain call and an explicitly-typed one: syncDrillHistory<T>({...}).
const SYNC_RE = /\bsync(?:DrillHistory|Sessions|Runs)\s*(?:<[^(]*>\s*)?\(/;
const WRITE_RE = /\brecordDrillSession\s*\(/;
// Surfaces that render a stored history list to the player.
const LOCAL_READ_RE = /\b(?:loadSessions|loadRuns|storage\.loadAll)\s*\(/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map((p) => ({ path: p, rel: relative(SRC, p), src: readFileSync(p, 'utf8') }));

const problems = [];

for (const f of files) {
  if (f.rel.startsWith('lib/playerpath/')) continue; // the helpers themselves
  // Each file must merge for itself. A sibling in the same directory doing it
  // is not enough — that is precisely how the original bug hid: the game synced
  // while its history dashboard, a separate mount, still read local only.
  const reads = SYNC_RE.test(f.src);

  if (WRITE_RE.test(f.src) && !reads) {
    problems.push(`${f.rel}\n    writes results to the account but never reads them back.\n    Add a syncDrillHistory() merge on mount, or results won't cross devices.`);
  }

  // A surface that renders a stored history list must merge the account copy.
  if (LOCAL_READ_RE.test(f.src) && !reads) {
    problems.push(`${f.rel}\n    renders history from local storage with no account merge.\n    Import the game's sync helper so other devices' sessions appear.`);
  }
}

if (problems.length) {
  console.error(`\nFAILED — ${problems.length} practice surface${problems.length === 1 ? '' : 's'} out of sync:\n`);
  for (const p of problems) console.error('  • ' + p + '\n');
  console.error('Every surface that records a result must also read the account copy back.\n');
  process.exit(1);
}

const writers = files.filter((f) => WRITE_RE.test(f.src) && !f.rel.startsWith('lib/')).length;
console.log(`All practice surfaces read back what they write (${writers} write surfaces checked).`);
