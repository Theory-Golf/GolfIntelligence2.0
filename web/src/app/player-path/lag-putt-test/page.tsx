import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import LagPuttTest from '@/components/LagPuttTest';

export const metadata = {
  title: 'Lag Putt Test — PlayerPath',
  description:
    'Adapted from the Swedish Golf Team protocol. 18 putts from 27–72 ft, scored by proximity. Compare your speed control to tour and amateur benchmarks.',
};

export default function LagPuttTestPage() {
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
          <p className="eyebrow mb-5">Assessment &middot; Putting</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Lag Putt<span className="text-primary">Test</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            18 putts from 27–72 ft. Scored on how far each putt finishes from
            the hole. Total score is compared against tour and amateur
            benchmarks — lower is better.
          </p>
        </div>
      </section>

      <LagPuttTest />
    </>
  );
}
