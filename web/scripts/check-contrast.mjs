#!/usr/bin/env node
/**
 * Verifies every text token in styles/system.css clears WCAG AA against
 * every surface it can legitimately sit on, in both themes.
 *
 *   node scripts/check-contrast.mjs
 *
 * Exits non-zero on any failure, so it can gate CI. Run it after touching
 * any colour in system.css — the values there were chosen by this maths,
 * not by eye, and a "small tweak" is exactly how a 4.0:1 grey gets back in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(root, '../src/styles/system.css'), 'utf8');

/* ── colour maths (WCAG 2.1) ─────────────────────────────────── */
const hex2rgb = h => {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const chan = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = hex => { const [r, g, b] = hex2rgb(hex).map(chan); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** composite an rgba tint over an opaque background */
const over = (fg, alpha, bg) => {
  const [r, g, b] = hex2rgb(fg), [R, G, B] = hex2rgb(bg);
  const f = (a, c) => Math.round(a * alpha + c * (1 - alpha));
  return '#' + [f(r, R), f(g, G), f(b, B)].map(v => v.toString(16).padStart(2, '0')).join('');
};

/* ── pull the two theme blocks out of system.css ─────────────── */
const block = re => (css.match(re) || [, ''])[1];
const parse = src => Object.fromEntries(
  [...src.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})\s*;/g)].map(m => [m[1], m[2]])
);
const dark = parse(block(/\/\* ── 3\. SEMANTIC — DARK[\s\S]*?\n:root \{([\s\S]*?)\n\}/));
const light = parse(block(/\[data-theme="light"\] \{([\s\S]*?)\n\}/));

if (!dark.court || !light.court) {
  console.error('check-contrast: could not parse theme blocks from system.css');
  process.exit(2);
}

/* ── what sits on what ───────────────────────────────────────── */
// Chrome text can land on any surface, including --pitch panels.
const CHROME = ['chalk', 'cement', 'ash'];
// Data colours appear on page/card surfaces, and inside their own score pill.
const DATA = ['under', 'even', 'bogey', 'double', 'scarlet-text',
              'sg-strong', 'sg-gain', 'sg-neutral', 'sg-loss', 'sg-weak',
              'c1', 'c2', 'c3', 'c4', 'c5'];
// Score pills paint a translucent tint of the *original* accent over a card.
const PILL_TINT = {
  under: ['#00C07A', 0.12], even: ['#8A8580', 0.10],
  bogey: ['#F59520', 0.10], double: ['#E8202A', 0.12],
};
const AA = 4.5;

let failures = 0;
for (const [name, T] of [['dark', dark], ['light', light]]) {
  const chromeBgs = ['court', 'obsidian', 'shadow', 'pitch'].map(k => T[k]);
  const cardBgs = ['court', 'obsidian', 'shadow'].map(k => T[k]);
  const card = T.card;
  console.log(`\n${name.toUpperCase()}`);
  for (const token of [...CHROME, ...DATA]) {
    const fg = T[token];
    if (!fg) continue;
    const bgs = CHROME.includes(token) ? [...chromeBgs] : [...cardBgs];
    if (PILL_TINT[token]) bgs.push(over(...PILL_TINT[token], card));
    let worst = Infinity, worstBg = '';
    for (const bg of bgs) { const r = ratio(fg, bg); if (r < worst) { worst = r; worstBg = bg; } }
    const ok = worst >= AA;
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${token.padEnd(13)} ${fg} on ${worstBg}  ${worst.toFixed(2)}:1`);
  }
}

console.log(failures
  ? `\n${failures} token(s) below ${AA}:1 — fix system.css before committing.`
  : `\nAll text tokens clear ${AA}:1 on every surface they can sit on.`);
process.exit(failures ? 1 : 0);
