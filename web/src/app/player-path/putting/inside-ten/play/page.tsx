import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import InsideTenPlay from '@/components/InsideTen/Play';

export const metadata = {
  title: 'Session Entry — Inside Ten',
  description: 'Log your Inside Ten putting session.',
};

export default function InsideTenPlayPage() {
  return (
    <>
      {/* ── Header ───────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/player-path/putting/inside-ten"
            className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-3" /> Inside Ten
          </Link>

          <p className="eyebrow mb-3">New Session</p>
          <h1 className="font-display font-extrabold text-[clamp(28px,5vw,52px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Enter Your<span className="text-primary"> Score</span>
          </h1>
        </div>
      </section>

      {/* ── Score entry ──────────────────────────────────────────── */}
      <InsideTenPlay />
    </>
  );
}
