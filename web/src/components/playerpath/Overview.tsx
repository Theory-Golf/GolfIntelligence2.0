import Link from 'next/link';

const INCLUDES = [
  {
    num: '01',
    name: 'The Driver',
    body:
      'Your rounds run through the Golf Intelligence engine. It ranks every leak by strokes lost and root-cause frequency, then flags the handful that are actually upstream of your score.',
    note: 'Benchmarked vs. PGA Tour · College +3 · Scratch',
    href: '#library',
    cta: 'See flagged drivers',
  },
  {
    num: '02',
    name: 'The Plan',
    body:
      'A structured practice session built around the technical elements you and your coach are working on. It scales to the shots you have, holds you to checkpoints, and tracks whether the change is actually being acquired.',
    note: 'Six-week mesocycle · Technical → Transfer',
    href: '#plan',
    cta: 'Build a session',
  },
  {
    num: '03',
    name: 'The Library',
    body:
      'Every assessment and development activity in one catalog, each one mapped to the performance drivers it addresses. Flag a driver and the work that fixes it rises to the top.',
    note: 'Assessments · Development activities · On-course tests',
    href: '#library',
    cta: 'Browse the work',
  },
];

export default function PlayerPathOverview() {
  return (
    <section id="playerpath" className="scroll-mt-[61px] px-6 pt-20 pb-16">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
          01 — PlayerPath
        </p>
        <h1 className="mt-5 font-display text-[clamp(40px,7vw,80px)] font-extrabold uppercase leading-[0.9] tracking-tight text-foreground">
          Player<span className="text-primary">Path</span>
        </h1>
        <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-muted-foreground">
          Every player has a highest-leverage area. PlayerPath surfaces it — quantifying exactly
          which part of the game is costing the most strokes — then turns that finding into
          practice you can actually run.
        </p>
        <p className="mt-4 max-w-xl font-body text-base leading-relaxed text-muted-foreground">
          Not a report. A finding, a causal explanation, and an intervention — in that order.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
          {INCLUDES.map((item) => (
            <Link
              key={item.num}
              href={item.href}
              className="group flex flex-col gap-3 bg-card p-6 no-underline transition-colors duration-150 hover:bg-surface"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                {item.num}
              </span>
              <span className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
                {item.name}
              </span>
              <span className="text-[13px] leading-relaxed text-muted-foreground">{item.body}</span>
              <span className="mt-auto border-t border-border pt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                {item.note}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition duration-150 group-hover:translate-x-[3px] group-hover:text-primary">
                {item.cta} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
