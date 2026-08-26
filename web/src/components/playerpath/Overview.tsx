import Link from 'next/link';
import PracticeStrip from './PracticeStrip';

/**
 * The three stages of the loop, in the order a player moves through them.
 * Diagnosis happens on the dashboard; PlayerPath is where the work gets done.
 */
const LOOP = [
  {
    num: '01',
    name: 'Diagnose',
    body:
      'Golf Intelligence reads your rounds. Tiger 5 shows where the scoring damage actually came from, and root-cause analysis traces it upstream to the driver behind it — not the failure you remember most.',
    note: 'Tiger 5 · Root cause · Benchmarked vs. College +3',
    href: '/golf-intelligence',
    cta: 'Open the dashboard',
  },
  {
    num: '02',
    name: 'Train',
    body:
      'The Plan builds a full session around what you and your coach are working on. Technical blocks with checkpoints early in the mesocycle, assessment work as you move toward transfer — scaled to the shots you actually have.',
    note: 'Six-week mesocycle · Technical → Transfer',
    href: '#plan',
    cta: 'Build a session',
  },
  {
    num: '03',
    name: 'Test',
    body:
      'Or go straight at one segment. Every assessment game scores you against a standard and keeps its own history, so you can see whether the change is holding under pressure.',
    note: 'Driving · Approach · Wedge · Putting',
    href: '#practice',
    cta: 'Work a segment',
  },
];

export default function PlayerPathOverview() {
  return (
    <section id="playerpath" className="scroll-mt-[var(--pp-chrome-h)] px-6 pt-20 pb-16">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
          01 — PlayerPath
        </p>
        <h1 className="mt-5 font-display text-[clamp(40px,7vw,80px)] font-extrabold uppercase leading-[0.9] tracking-tight text-foreground">
          Player<span className="text-primary">Path</span>
        </h1>
        <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-muted-foreground">
          The dashboard tells you what is costing you strokes. PlayerPath is where you do something
          about it — structured practice built around that finding, and measured the same way a
          round is.
        </p>

        {/*
          A returning player's own numbers, before the pitch. PracticeStrip
          renders nothing until there is history to show, so a player on their
          first visit still meets the explainer first — no flag, no first-visit
          state: the empty case is already the signal.
        */}
        <PracticeStrip />

        <div className="mt-12 grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
          {LOOP.map((item) => (
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
              {/* Always visible — a phone has no hover to reveal it. */}
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary transition duration-150 group-hover:translate-x-[3px]">
                {item.cta} →
              </span>
            </Link>
          ))}
        </div>

        {/* Why any of this is scored at all. */}
        <div className="mt-8 border-l-2 border-primary bg-accent/30 px-5 py-4">
          <p className="max-w-2xl text-sm leading-relaxed text-foreground">
            <strong className="font-semibold">Practice you can keep score in.</strong>{' '}
            <span className="text-muted-foreground">
              Every game here scores you against a standard and saves the result to your account —
              so a session on the range produces a number the same way a round does. That is what
              turns practice from time spent into progress you and your coach can see.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
