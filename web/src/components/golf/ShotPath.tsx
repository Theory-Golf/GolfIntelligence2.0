'use client';

import { memo } from 'react';

import type { Lie } from '@/lib/golf/db/types';
import { LIE_ABBREVIATIONS, LIE_COLORS } from '@/lib/golf/utils/lieColors';

export interface ShotPathShot {
  startingDistance: number;
  startingLie: Lie;
  endingDistance: number;
  endingLie: Lie;
  holed: boolean;
}

interface ShotPathProps {
  shots: ShotPathShot[];
  activeShotNumber?: number;
}

interface PathToken {
  distance: number;
  lie: Lie;
}

function ShotPathImpl({ shots, activeShotNumber }: ShotPathProps) {
  // Build chain: shot1.start, then end of each completed shot.
  const tokens: PathToken[] = [];
  if (shots.length > 0) {
    tokens.push({ distance: shots[0].startingDistance, lie: shots[0].startingLie });
    for (const s of shots) {
      tokens.push({ distance: s.endingDistance, lie: s.endingLie });
    }
  }

  return (
    <div className="font-mono text-[12px] leading-relaxed flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {tokens.map((t, i) => (
        <span key={`t-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ash">→</span>}
          <span style={{ color: LIE_COLORS[t.lie] }}>
            {t.distance}
            {LIE_ABBREVIATIONS[t.lie]}
          </span>
        </span>
      ))}
      {activeShotNumber !== undefined && (
        <span className="flex items-center gap-1.5">
          {tokens.length > 0 && <span className="text-ash">→</span>}
          <span className="text-ash">shot {activeShotNumber} ›</span>
        </span>
      )}
    </div>
  );
}

export const ShotPath = memo(ShotPathImpl);
