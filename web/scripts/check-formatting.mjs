#!/usr/bin/env node
/**
 * Keeps styles/system.css the single source of truth for formatting.
 *
 *   node scripts/check-formatting.mjs
 *
 * Centralising once is worthless if the next component hand-rolls its own
 * label. This fails the build when a raw value appears where a token
 * exists, and names the token to use instead.
 *
 * Escape hatch: put `formatting-ok: <reason>` in a comment on the same
 * line. Deliberate exceptions then explain themselves where they live,
 * rather than accumulating in an allowlist here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src');

/** Whole files that are legitimately outside the system. */
const EXEMPT = [
  // The source of truth itself.
  { re: /src\/styles\/system\.css$/, why: 'the token source' },
  // Physical yardage cards: print at 5.5-8px by design, because they are
  // printed and carried, not read on a screen.
  { re: /src\/components\/(Standard|Weather)YardageCard\//, why: 'print artefact' },
  // Canvas cannot resolve var(), so this one reads computed values and
  // needs real hex to hand to the 2D context.
  { re: /src\/components\/ApproachAimOptimizer\//, why: 'canvas 2D context' },
];

/** px values that have a --spacing-* token; anything else is an optical nudge. */
const SPACING_TOKENS = new Set([4,6,8,10,12,14,16,18,20,22,24,28,32,40,48,56,64,80,88]);

const rules = [
  {
    id: 'type-css',
    files: /\.css$/,
    re: /font-size:\s*(\d+(?:\.\d+)?)px/g,
    test: m => Number(m[1]) <= 16,
    msg: m => `raw font-size: ${m[1]}px — use a --text-* role token from system.css`,
  },
  {
    id: 'type-tsx',
    files: /\.tsx?$/,
    re: /text-\[(\d+(?:\.\d+)?)px\]/g,
    test: m => Number(m[1]) <= 16,
    msg: m => `arbitrary text-[${m[1]}px] — use text-label / text-label-sm / text-caption`,
  },
  {
    id: 'type-inline',
    files: /\.tsx?$/,
    re: /fontSize:\s*'(\d+(?:\.\d+)?)px'/g,
    test: m => Number(m[1]) <= 16,
    msg: m => `inline fontSize '${m[1]}px' — use var(--text-*) or delete it and let the class own the size`,
  },
  {
    id: 'colour',
    files: /\.(css|tsx?)$/,
    re: /#[0-9A-Fa-f]{6}\b/g,
    test: (m, line) => !/^\s*(\/\/|\*|\/\*)/.test(line),   // comments may cite a hex
    msg: m => `hex literal ${m[0]} — add a token to system.css and reference var(--…)`,
  },
  {
    id: 'spacing',
    files: /\.css$/,
    re: /(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left))?:[^;]*?\b(\d+)px/g,
    test: m => SPACING_TOKENS.has(Number(m[1])),
    msg: m => `raw ${m[1]}px spacing — use var(--spacing-*) from system.css`,
  },
  {
    id: 'layer',
    files: /\.css$/,
    re: /z-index:\s*(\d+)/g,
    test: m => Number(m[1]) > 3,     // 1-3 is local stacking inside a component
    msg: m => `raw z-index: ${m[1]} — use a --z-* layer from system.css`,
  },
  {
    id: 'spacing-alias',
    files: /system\.css$/,
    re: /--spacing-(xs|sm|md|lg|xl|xxl|2xl|3xl)\s*:/g,
    exemptOverride: true,
    test: () => true,
    msg: m => `--spacing-${m[1]} collides with Tailwind's max-w-*/w-*/h-* scale and will silently resize them — use the numeric scale`,
  },
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const failures = [];
for (const file of walk(SRC)) {
  const rel = path.relative(root, file);
  const exempt = EXEMPT.find(x => x.re.test(file));
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  for (const rule of rules) {
    if (!rule.files.test(file)) continue;
    if (exempt && !rule.exemptOverride) continue;
    lines.forEach((line, i) => {
      if (/formatting-ok:/.test(line)) return;
      for (const m of line.matchAll(rule.re)) {
        if (!rule.test(m, line)) continue;
        failures.push(`${rel}:${i + 1}  [${rule.id}] ${rule.msg(m)}`);
      }
    });
  }
}

if (failures.length) {
  console.error(`\ncheck-formatting: ${failures.length} value(s) bypassing styles/system.css\n`);
  for (const f of failures) console.error('  ' + f);
  console.error(`\nAdd or reuse a token in src/styles/system.css. If a value is genuinely`);
  console.error(`outside the system, add "formatting-ok: <reason>" in a comment on that line.\n`);
  process.exit(1);
}
console.log('check-formatting: all formatting values reference styles/system.css');
