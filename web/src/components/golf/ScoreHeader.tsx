'use client';

import { memo } from 'react';

const COLOR_UNDER = 'var(--seg-shortgame)';
const COLOR_EVEN = 'var(--cement)';
const COLOR_BOGEY = 'var(--bogey)';
const COLOR_DOUBLE = 'var(--scarlet)';

interface ScoreHeaderProps {
  front: number | null;
  back: number | null;
  total: number;
}

function colorFor(v: number | null): string {
  if (v === null) return COLOR_EVEN;
  if (v < 0) return COLOR_UNDER;
  if (v === 0) return COLOR_EVEN;
  if (v === 1) return COLOR_BOGEY;
  return COLOR_DOUBLE;
}

function fmt(v: number | null): string {
  if (v === null) return '--';
  if (v > 0) return `+${v}`;
  if (v < 0) return String(v);
  return 'E';
}

function ScoreHeaderImpl({ front, back, total }: ScoreHeaderProps) {
  return (
    <div className="font-mono text-right leading-tight">
      <div className="flex items-center justify-end gap-2 text-caption font-medium">
        <span style={{ color: colorFor(front) }}>{fmt(front)}</span>
        <span className="text-ash">·</span>
        <span style={{ color: colorFor(back) }}>{fmt(back)}</span>
        <span className="text-ash">·</span>
        <span style={{ color: colorFor(total) }}>{fmt(total)}</span>
      </div>
      <div className="flex items-center justify-end gap-2 text-label-sm tracking-[0.2em] text-ash mt-0.5">
        <span>F</span>
        <span>·</span>
        <span>B</span>
        <span>·</span>
        <span>TOT</span>
      </div>
    </div>
  );
}

export const ScoreHeader = memo(ScoreHeaderImpl);
