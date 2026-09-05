import type { Lie } from '../db/types';

/**
 * Lie colours resolve through CSS custom properties rather than hex, so a
 * theme switch repaints them without any JS. Values live in
 * styles/system.css -- see the --lie-* block, which carries a separate,
 * contrast-checked value per theme.
 *
 * These are consumed as SVG fill/stroke and as DOM colours, both of which
 * resolve var(). Canvas does not, so anything drawn to a 2D context has to
 * read the computed value instead (ApproachAimOptimizer does exactly that).
 */
export const LIE_COLORS: Record<Lie, string> = {
  Tee: 'var(--lie-tee)',
  Fairway: 'var(--lie-fairway)',
  Rough: 'var(--lie-rough)',
  Sand: 'var(--lie-sand)',
  Recovery: 'var(--lie-recovery)',
  Green: 'var(--lie-green)',
};

export const LIE_ABBREVIATIONS: Record<Lie, string> = {
  Tee: 'T',
  Fairway: 'F',
  Rough: 'R',
  Sand: 'S',
  Recovery: 'X', // X not R — R is taken by Rough
  Green: 'G',
};
