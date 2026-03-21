import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import WedgeStandard from '@/components/WedgeStandard';

export const metadata = {
  title: 'Wedge Standard — PlayerPath',
  description:
    'Adaptive Trackman wedge assessment. Targets shift as performance improves — the standard rises with you.',
};

export default function WedgeStandardPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/player-path" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors">
            <ArrowLeft className="size-3" /> PlayerPath
          </Link>
          <p className="eyebrow mb-5">Assessment &middot; Wedge</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Wedge<span className="text-primary">Standard</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            An adaptive assessment that adjusts difficulty as your performance
            improves. Scored on proximity, carry accuracy, and dispersion.
            The standard rises with you.
          </p>
        </div>
      </section>

      <WedgeStandard />
    </>
  );
}
