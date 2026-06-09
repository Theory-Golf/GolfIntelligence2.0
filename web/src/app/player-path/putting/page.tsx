import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PuttingHub from '@/components/InsideTen/PuttingHub';

export const metadata = {
  title: 'Putting Hub — PlayerPath',
  description: 'Putting practice drills for speed control, green reading, and par-save conversion.',
};

export default function PuttingHubPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/player-path"
            className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-3" /> PlayerPath
          </Link>
          <p className="eyebrow mb-5">Practice · Putting</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Putting<span className="text-primary">Hub</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            Speed control and green reading drills designed for the 3–10 ft range —
            the band where par saves and birdie conversions are decided.
          </p>
        </div>
      </section>

      <PuttingHub />
    </>
  );
}
