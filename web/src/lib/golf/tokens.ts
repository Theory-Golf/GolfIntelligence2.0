/**
 * Golf Intelligence — design token bridge for JS-land.
 *
 * Every value here is a CSS custom property reference, not a hex literal.
 * styles/system.css is the single source of truth; this file only lets
 * TypeScript hand those tokens to Recharts and friends.
 *
 * Why var() and not hex: this module used to carry dark-mode hex, so in
 * light mode chart axis labels rendered #8A8580 on #F5F3F0 -- 3.30:1, and
 * effectively invisible. CSS variables resolve at paint time, including
 * inside SVG presentation attributes such as fill and stroke, so a theme
 * switch now repaints the charts with no JS and no re-render.
 *
 * The one place this does not work is canvas: a 2D context cannot resolve
 * var(), so canvas code must read the computed value off the document
 * element instead. ApproachAimOptimizer does that already.
 */

// ── Foundation ────────────────────────────────────────────
export const colors = {
  court: 'var(--court)',
  obsidian: 'var(--obsidian)',
  shadow: 'var(--shadow)',
  pitch: 'var(--pitch)',

  cement: 'var(--cement)',
  ash: 'var(--ash)',
  chalk: 'var(--chalk)',

  // --scarlet is the fill colour; --scarlet-text is the readable-on-card
  // variant, because #E8202A is only 3.71:1 against a card.
  scarlet: 'var(--scarlet)',
  scarletText: 'var(--scarlet-text)',
  scarletDim: 'var(--scarlet-dim)',
  scarletGlow: 'var(--scarlet-glow)',
  scarletTint: 'var(--scarlet-tint)',

  // Score
  under: 'var(--under)',
  even: 'var(--even)',
  bogey: 'var(--bogey)',
  double: 'var(--double)',

  // Strokes gained
  sgStrong: 'var(--sg-strong)',
  sgGain: 'var(--sg-gain)',
  sgNeutral: 'var(--sg-neutral)',
  sgLoss: 'var(--sg-loss)',
  sgWeak: 'var(--sg-weak)',

  // Chart categorical
  c1: 'var(--c1)',
  c2: 'var(--c2)',
  c3: 'var(--c3)',
  c4: 'var(--c4)',
  c5: 'var(--c5)',
};

// Ordered array for charts — drop straight into Recharts, Nivo, etc.
export const chartColors = [
  colors.c1,
  colors.c2,
  colors.c3,
  colors.c4,
  colors.c5,
];

// Fill variants for area/bar fills; per-theme opacity lives in system.css.
export const chartFillColors = [
  'var(--c1-fill)',
  'var(--c2-fill)',
  'var(--c3-fill)',
  'var(--c4-fill)',
  'var(--c5-fill)',
];

// ── Typography ─────────────────────────────────────────────
export const typography = {
  // Display / Headings
  headingFont: "'Barlow Condensed', sans-serif",
  headingWeight: 800,
  
  // Body / UI / Navigation
  bodyFont: "'Barlow', sans-serif",
  bodyWeight: 400,
  
  // Data / Labels / Monospace
  monoFont: "'DM Mono', monospace",
  monoWeight: 400,
};

// ── Spacing ───────────────────────────────────────────────
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};

// ── Border Radius ─────────────────────────────────────────
export const borderRadius = {
  sm: '2px',
  md: '4px',
  lg: '8px',
};

// ── Shadows / Elevation ───────────────────────────────────
// Dark theme - use borders instead of shadows
export const elevation = {
  card: 'none',  // Use border: 1px solid var(--pitch) instead
  hover: '0 4px 12px rgba(0, 0, 0, 0.4)',
};

// ── Transitions ───────────────────────────────────────────
export const transitions = {
  fast: '0.15s ease',
  medium: '0.25s ease',
  slow: '0.4s ease',
};

// ── Layout ────────────────────────────────────────────────
export const layout = {
  maxWidth: '1100px',
  headerHeight: '80px',
  sidebarWidth: '240px',
};

// ── Helper Functions ──────────────────────────────────────

/**
 * Get stroke gained color based on value (for aggregate/total SG values)
 */
export function getStrokeGainedColor(value: number): string {
  if (value >= 1.0) return colors.sgStrong;
  if (value >= 0.3) return colors.sgGain;
  if (value > -0.3) return colors.sgNeutral;
  if (value > -1.0) return colors.sgLoss;
  return colors.sgWeak;
}

/**
 * Get stroke gained color for individual shots (tighter thresholds)
 * - SG > 0.25: Strong (green)
 * - SG > 0 and <= 0.25: Gain (mint)
 * - SG = 0: Neutral (gray)
 * - SG < 0 and >= -0.25: Loss (amber)
 * - SG < -0.25: Weak (red)
 */
export function getShotSGColor(value: number): string {
  if (value > 0.25) return colors.sgStrong;
  if (value > 0) return colors.sgGain;
  if (value === 0) return colors.sgNeutral;
  if (value >= -0.25) return colors.sgLoss;
  return colors.sgWeak;
}

/**
 * Get color for a rate/percentage metric against good/ok thresholds.
 *
 * `good` and `ok` are stated in the metric's own direction, so a lower-is-better
 * metric passes its smaller number as `good` (e.g. Drop Off: good 20, ok 30).
 */
export function getRateColor(
  value: number,
  good: number,
  ok: number,
  higherIsBetter: boolean
): string {
  const clears = (threshold: number) =>
    higherIsBetter ? value >= threshold : value <= threshold;

  if (clears(good)) return colors.under;
  if (clears(ok)) return colors.bogey;
  return colors.double;
}

/**
 * Get score color (relative to par)
 */
export function getScoreColor(scoreToPar: number): string {
  if (scoreToPar < 0) return colors.under;
  if (scoreToPar === 0) return colors.even;
  if (scoreToPar === 1) return colors.bogey;
  return colors.double;
}

/**
 * Format strokes gained value with sign
 */
export function formatStrokesGained(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}
