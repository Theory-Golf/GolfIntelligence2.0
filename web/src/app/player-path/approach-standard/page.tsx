import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ApproachStandard from '@/components/ApproachStandard';

export const metadata = {
  title: 'Approach Standard — PlayerPath',
  description:
    'Periodized approach assessment from 125–210 yards. Five tiers anchored to PGA Tour proximity data. Binary scoring. The standard rises with you.',
};

export default function ApproachStandardPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/player-path#library"
            className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-3" /> Library
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

      <ApproachStandard />
    </>
  );
}
