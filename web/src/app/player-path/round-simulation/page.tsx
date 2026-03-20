import Link from 'next/link';
import RoundSimulation from '@/components/RoundSimulation';

export const metadata = {
  title: 'Round Simulation — PlayerPath',
  description:
    'Simulate an 18-hole putting round and track your strokes gained over time.',
};

export default function RoundSimulationPage() {
  return (
    <>
      <div className="page-hero" style={{ paddingBottom: 48, minHeight: 'auto' }}>
        <div className="page-hero-inner">
          <Link href="/player-path" className="resource-back-link">
            ← PlayerPath
          </Link>

          <p className="eyebrow" style={{ marginBottom: '20px' }}>
            Assessment · Putting
          </p>

          <h1 className="display-heading">
            Round
            <span style={{ color: 'var(--color-accent)' }}>Sim</span>
          </h1>

          <p className="display-sub">
            18 putts across a realistic tour distribution. Track make rate,
            strokes gained vs PGA Tour benchmarks, and your miss tendencies —
            then log results over time to see where you're improving.
          </p>
        </div>
      </div>

      <RoundSimulation />
    </>
  );
}
