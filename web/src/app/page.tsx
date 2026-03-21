import Link from 'next/link';
import { ArrowRight, BarChart3, Target, Crosshair, TrendingDown, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'theory.golf',
  description: 'Not more data. Better answers. Golf intelligence for collegiate programs.',
};

const TIGER_5 = [
  { num: '01', label: 'Par-5 Bogeys', icon: TrendingDown },
  { num: '02', label: 'Doubles & Worse', icon: AlertTriangle },
  { num: '03', label: 'Three-Putts', icon: Target },
  { num: '04', label: 'Bogeys from 9-Iron or Less', icon: Crosshair },
  { num: '05', label: 'Penalty Strokes', icon: AlertTriangle },
];

export default function HomePage() {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="px-6 pt-24 pb-20 md:pt-32 md:pb-28">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-5">theory.golf</p>
          <h1 className="font-display font-extrabold text-[clamp(48px,8vw,96px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Not More Data.<br />
            <span className="text-primary">Better Answers.</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-6 max-w-lg leading-relaxed">
            A golf intelligence platform built for college programs. Know why
            scores happened, which players to develop first, and exactly what
            to work on.
          </p>
          <div className="flex gap-3 mt-8">
            <Link
              href="/golf-intelligence"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-bold text-xs tracking-[0.15em] uppercase px-6 py-3 h-11 hover:bg-scarlet-dim transition-colors no-underline"
            >
              View Dashboard <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border border-border text-muted-foreground font-display font-bold text-xs tracking-[0.15em] uppercase px-6 py-3 h-11 hover:border-primary hover:text-primary transition-colors no-underline"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ────────────────────────────────── */}
      <section className="border-y border-border px-6 py-16 md:py-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-start">
          <div>
            <p className="eyebrow mb-4">The Standard</p>
            <p className="font-display font-semibold text-[clamp(18px,2.5vw,26px)] leading-tight tracking-[0.01em] uppercase text-foreground">
              A dashboard that shows you what happened is a scoreboard.
              A dashboard that explains why it happened — and points to
              what changes next — is intelligence.
            </p>
          </div>
          <p className="font-body text-[15px] text-muted-foreground leading-relaxed">
            Most programs have more data than they know what to do with.
            They don&apos;t have a system that turns that data into a decision
            every Monday morning. Theory Golf changes that — three
            interlocking tools that move from diagnosis to action.
          </p>
        </div>
      </section>

      {/* ── PRODUCT PILLARS — Bento Grid ─────────────────────── */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <p className="section-label mb-10">The System</p>

          <div className="grid md:grid-cols-5 gap-px bg-border border border-border">
            {/* Golf Intelligence — spans 3 cols */}
            <div className="md:col-span-3 bg-card p-8 md:p-10 flex flex-col">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-primary mb-3">
                01 — Golf Intelligence
              </p>
              <h2 className="font-display font-extrabold text-[clamp(28px,4vw,48px)] leading-[0.9] tracking-tight uppercase text-foreground mb-5">
                Start With<br />
                <span className="text-primary">Tiger 5</span>
              </h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-3">
                Five failure categories — Par-5 Bogeys, Doubles & Worse,
                Three-Putts, Bogeys from 9-iron or less, Penalty Strokes —
                account for the majority of scoring damage in any round.
                Tiger 5 is your landing view every time.
              </p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                Six segment tabs let you navigate to the root cause in
                10–15 minutes. Not a data dump. A post-round workflow.
              </p>
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary mt-auto pt-6">
                Tiger standard: &le;1.5 failures / round
              </p>
            </div>

            {/* PlayerPath — spans 2 cols */}
            <div className="md:col-span-2 bg-card p-8 md:p-10 flex flex-col">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-primary mb-3">
                02 — PlayerPath
              </p>
              <h2 className="font-display font-extrabold text-[clamp(28px,4vw,44px)] leading-[0.9] tracking-tight uppercase text-foreground mb-5">
                Find The<br />
                <span className="text-primary">Driver</span>
              </h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-3">
                Every player has one part of their game that is upstream of
                everything else. PlayerPath identifies it — not by correlation,
                but by causal chain.
              </p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                The output isn&apos;t a report. It&apos;s a finding, a causal
                explanation, and an intervention — in that order.
              </p>
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary mt-auto pt-6">
                Benchmarked vs. PGA Tour &middot; College +3 &middot; Scratch
              </p>
            </div>

            {/* Resources — full width accent strip */}
            <div className="md:col-span-5 bg-surface p-8 md:px-10 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-primary mb-2">
                  03 — Resources
                </p>
                <p className="font-display font-bold text-lg uppercase tracking-wide text-foreground">
                  On-Course Tools
                </p>
                <p className="font-body text-sm text-muted-foreground mt-1">
                  Weather-adjusted yardage cards, aim optimizers, and round simulation.
                </p>
              </div>
              <Link
                href="/resources"
                className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors no-underline shrink-0"
              >
                Explore Resources <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── TIGER 5 STRIP ────────────────────────────────────── */}
      <section className="border-t border-border bg-surface px-6 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-6">Tiger 5 — The Landing View</p>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-px bg-border border border-border mb-8">
            {TIGER_5.map(({ num, label, icon: Icon }) => (
              <div key={num} className="bg-card p-5 flex flex-col items-start gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-primary">{num}</span>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <span className="font-display font-semibold text-base tracking-[0.02em] uppercase text-foreground leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-lg">
            These five categories account for the majority of scoring damage
            in any collegiate round. Your first view after every competitive
            round. Every time.
          </p>
        </div>
      </section>
    </>
  );
}
