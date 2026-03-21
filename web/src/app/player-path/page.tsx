import PracticeLibrary from '@/components/PracticeLibrary';

export const metadata = {
  title: 'PlayerPath',
  description: 'Identify each player\'s highest-leverage improvement areas.',
};

export default function PlayerPathPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-12">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-5">Development</p>
          <h1 className="font-display font-extrabold text-[clamp(40px,7vw,80px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Player<span className="text-primary">Path</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            Every player has a highest-leverage area. PlayerPath surfaces it —
            quantifying exactly which part of the game is costing the most strokes
            and mapping a clear development priority.
          </p>
        </div>
      </section>

      {/* ── Practice Activity Library ────────────────────────── */}
      <PracticeLibrary />
    </>
  );
}
