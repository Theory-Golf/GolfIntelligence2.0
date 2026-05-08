import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import InsideTenLanding from '@/components/InsideTen/Landing';

export const metadata = {
  title: 'Inside Ten — PlayerPath',
  description:
    '18 putts. 6 ladders. 3 to 10 feet. A focused short-putt drill for par saves and birdie conversions.',
};

export default function InsideTenPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-10">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/player-path"
            className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-3" /> PlayerPath
          </Link>

          <p className="eyebrow mb-5">Assessment · Putting</p>

          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Inside<span className="text-primary">Ten</span>
          </h1>

          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            18 putts. 6 ladders. 3 to 10 feet. Speed control and green reading under
            the pressure of putts that matter.
          </p>

          <Link
            href="/player-path/putting/inside-ten/play"
            className="inline-block mt-8 font-display font-bold text-sm uppercase tracking-[0.15em] px-8 py-4 rounded transition-opacity hover:opacity-90"
            style={{ background: 'var(--scarlet)', color: '#fff' }}
          >
            Start Session
          </Link>
        </div>
      </section>

      {/* ── Dynamic content (drill overview, recent performance) ─── */}
      <InsideTenLanding />
    </>
  );
}
