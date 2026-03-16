import PracticeLibrary from '@/components/PracticeLibrary';

export const metadata = {
  title: 'PlayerPath',
  description: 'Identify each player\'s highest-leverage improvement areas.',
};

export default function PlayerPathPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="page-hero" style={{ paddingBottom: 48, minHeight: 'auto' }}>
        <div className="page-hero-inner">
          <p className="eyebrow" style={{ marginBottom: '20px' }}>
            Development
          </p>

          <h1 className="display-heading">
            Player
            <span style={{ color: 'var(--color-accent)' }}>Path</span>
          </h1>

          <p className="display-sub">
            Every player has a highest-leverage area. PlayerPath surfaces it —
            quantifying exactly which part of the game is costing the most strokes
            and mapping a clear development priority.
          </p>
        </div>
      </div>

      {/* ── Practice Activity Library ─────────────────────────── */}
      <PracticeLibrary />
    </>
  );
}
