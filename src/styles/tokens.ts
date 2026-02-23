/**
 * Golf Intelligence v2.0 — Design Tokens
 * Athletic Edition: G/FORE × Jordan Brand inspired
 */

// ── Foundation — Black Court ──────────────────────────────
export const colors = {
  // Blacks with depth
  court: '#0C0C0C',       // Deepest background - hero sections
  obsidian: '#141414',    // Primary app surface
  shadow: '#1E1E1E',      // Cards, panels, elevated surfaces
  pitch: '#2A2A2A',       // Borders, dividers, separators
  
  // Neutrals
  cement: '#C4BFB8',      // Jordan cement grey - secondary text
  ash: '#8A8580',         // Muted labels, captions
  chalk: '#F2F0EE',       // Near-white - headings, key values
  
  // Scarlet - The Only Accent
  scarlet: '#E8202A',     // Primary accent - fire red / scarlet
  scarletDim: '#9B1520',  // Hover states / pressed
  scarletGlow: '#FF3D47', // Bright pop on dark surfaces
  scarletTint: '#1F0507', // Subtle scarlet wash on black
  
  // Data Semantic - Score
  under: '#00C07A',       // Under par - electric teal-green
  even: '#8A8580',        // Even par - cement / disappears
  bogey: '#F59520',       // Bogey - amber signal
  double: '#E8202A',      // Double+ - scarlet / urgent
  
  // Strokes Gained Scale
  sgStrong: '#00C07A',    // +1.0+ electric green
  sgGain: '#52D9A0',      // +0.3–0.9 mint
  sgNeutral: '#C4BFB8',   // ±0.3 cement
  sgLoss: '#F59520',      // −0.3–0.9 amber
  sgWeak: '#E8202A',      // −1.0+ scarlet
  
  // Chart Categorical (5 series)
  c1: '#3D8EF0',          // Royal Blue
  c2: '#A855F7',          // Court Purple
  c3: '#06C8E0',          // Aqua
  c4: '#D4F000',          // Volt
  c5: '#F03DAA',          // Magenta
};

// Ordered array for charts - drop straight into Recharts, Nivo, etc.
export const chartColors = [
  colors.c1,  // Royal Blue
  colors.c2,  // Court Purple
  colors.c3,  // Aqua
  colors.c4,  // Volt
  colors.c5,  // Magenta
];

// Fill variants (15% opacity for area/bar fills on dark bg)
export const chartFillColors = [
  'rgba(61, 142, 240, 0.15)',   // c1-fill
  'rgba(168, 85, 247, 0.15)',   // c2-fill
  'rgba(6, 200, 224, 0.15)',    // c3-fill
  'rgba(212, 240, 0, 0.15)',   // c4-fill
  'rgba(240, 61, 170, 0.15)',   // c5-fill
];

// ── Typography ─────────────────────────────────────────────
export const typography = {
  // Display / Headings
  headingFont: "'Barlow Condensed', sans-serif",
  headingWeight: 800,
  
  // Body / UI / Navigation
  bodyFont: "'Barlow', sans-serif",
  bodyWeight: 300,
  
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
 * Get stroke gained color based on value
 */
export function getStrokeGainedColor(value: number): string {
  if (value >= 1.0) return colors.sgStrong;
  if (value >= 0.3) return colors.sgGain;
  if (value > -0.3) return colors.sgNeutral;
  if (value > -1.0) return colors.sgLoss;
  return colors.sgWeak;
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
