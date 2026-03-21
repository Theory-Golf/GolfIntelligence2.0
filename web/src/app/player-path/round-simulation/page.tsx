import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import RoundSimulation from '@/components/RoundSimulation';

export const metadata = {
  title: 'Round Simulation — PlayerPath',
  description:
    'Simulate an 18-hole putting round and track your strokes gained over time.',
};

export default function RoundSimulationPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/player-path" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors">
            <ArrowLeft className="size-3" /> PlayerPath
          </Link>
          <p className="eyebrow mb-5">Assessment &middot; Putting</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Round<span className="text-primary">Sim</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            18 putts across a realistic tour distribution. Track make rate,
            strokes gained vs PGA Tour benchmarks, and your miss tendencies —
            then log results over time to see where you&apos;re improving.
          </p>
        </div>
      </section>

      <RoundSimulation />
    </>
  );
}
