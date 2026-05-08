import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import InsideTenHistory from '@/components/InsideTen/History';

export const metadata = {
  title: 'History — Inside Ten',
  description: 'Your Inside Ten putting session history and trend analysis.',
};

export default function InsideTenHistoryPage() {
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

          <p className="eyebrow mb-3">Performance</p>
          <h1 className="font-display font-extrabold text-[clamp(28px,5vw,52px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Session<span className="text-primary"> History</span>
          </h1>

          <div className="mt-6">
            <Link
              href="/player-path/putting/inside-ten/play"
              className="inline-block font-display font-bold text-sm uppercase tracking-[0.15em] px-6 py-3 rounded transition-opacity hover:opacity-90"
              style={{ background: 'var(--scarlet)', color: '#fff' }}
            >
              New Session
            </Link>
          </div>
        </div>
      </section>

      {/* ── Dashboard ────────────────────────────────────────────── */}
      <InsideTenHistory />
    </>
  );
}
