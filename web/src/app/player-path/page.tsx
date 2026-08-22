import PlayerPathOverview from '@/components/playerpath/Overview';
import PracticePlanner from '@/components/PracticePlanner';
import PracticeBySegment from '@/components/playerpath/PracticeBySegment';

export const metadata = {
  title: 'PlayerPath',
  description: 'Identify each player\'s highest-leverage improvement areas.',
};

export default function PlayerPathPage() {
  return (
    <>
      {/* Flushes queued practice writes and uploads pre-sync local history. */}

      {/* ── 01 · PlayerPath — what it is, what it includes ────── */}
      <PlayerPathOverview />

      {/* ── 02 · The Plan — build and run a practice session ──── */}
      <section id="plan" className="scroll-mt-[61px] border-t border-border pt-16">
        <PracticePlanner />
      </section>

      {/* ── 03 · Practice — assessment games by game segment ──── */}
      <section id="practice" className="scroll-mt-[61px] border-t border-border pt-16">
        <PracticeBySegment />
      </section>
    </>
  );
}
