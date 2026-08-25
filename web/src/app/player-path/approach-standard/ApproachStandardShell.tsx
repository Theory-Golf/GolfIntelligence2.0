'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ResumeSessionBar from '@/components/playerpath/ResumeSessionBar';
import { segmentAnchor } from '@/data/practiceActivities';
import ApproachStandard from '@/components/ApproachStandard';

type Screen = 'TIER_SELECT' | 'SETUP' | 'SHOT' | 'RESULT' | 'HISTORY';

export default function ApproachStandardShell() {
  const [screen, setScreen] = useState<Screen>('TIER_SELECT');

  return (
    <>
      {screen !== 'SHOT' && <ResumeSessionBar />}
      {screen !== 'SHOT' && (
        <section className="px-6 pt-16 pb-8">
          <div className="max-w-3xl mx-auto">
            <Link
              href={segmentAnchor('approach-standard')}
              className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-3" /> Practice
            </Link>
            <p className="eyebrow mb-5">Assessment &middot; Approach</p>
            <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
              Approach<span className="text-primary">Standard</span>
            </h1>
            <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
              A periodized drill for full iron and hybrid shots from 125 to 210
              yards. Five tiers anchored to PGA Tour proximity data. Binary
              scoring — every shot is Inside or Outside. The standard rises with
              you.
            </p>
          </div>
        </section>
      )}

      <ApproachStandard onScreenChange={setScreen} />
    </>
  );
}
