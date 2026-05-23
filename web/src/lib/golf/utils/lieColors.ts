import type { Lie } from '../db/types';

export const LIE_COLORS: Record<Lie, string> = {
  Tee: '#E040A0', // magenta
  Fairway: '#D4A800', // gold
  Rough: '#F07030', // orange
  Sand: '#B8B2AA', // cement
  Recovery: '#8B1219', // scarlet-dim
  Green: '#00B870', // green
};

export const LIE_ABBREVIATIONS: Record<Lie, string> = {
  Tee: 'T',
  Fairway: 'F',
  Rough: 'R',
  Sand: 'S',
  Recovery: 'V', // V not R — R is taken by Rough
  Green: 'G',
};
