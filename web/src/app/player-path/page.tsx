import PlayerPathOverview from '@/components/playerpath/Overview';
import PracticePlanner from '@/components/PracticePlanner';
import PracticeLibrary from '@/components/PracticeLibrary';

export const metadata = {
  title: 'PlayerPath',
  description: 'Identify each player\'s highest-leverage improvement areas.',
};

export default function PlayerPathPage() {
  return (
    <>
      {/* ── 01 · PlayerPath — what it is, what it includes ────── */}
      <PlayerPathOverview />

      {/* ── 02 · The Plan — build and run a practice session ──── */}
      <section id="plan" className="scroll-mt-[61px] border-t border-border pt-16">
        <PracticePlanner />
      </section>

      {/* ── 03 · The Library — flagged drivers + the catalog ──── */}
      <section id="library" className="scroll-mt-[61px] border-t border-border pt-16">
        <PracticeLibrary />
      </section>
    </>
  );
}
