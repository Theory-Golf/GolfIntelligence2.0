import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import StandardYardageCard from '@/components/StandardYardageCard';

export const metadata = {
  title: 'Standard Yardage Card — Resources',
  description:
    'Generate a printable caddie card with your full bag distances plus altitude, humidity, temperature, and wind reference tables — all on a half-sheet landscape layout.',
};

export default function StandardYardageCardPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/resources" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors">
            <ArrowLeft className="size-3" /> Resources
          </Link>
          <p className="eyebrow mb-4">Tool</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Standard <span className="text-primary">Yardage</span> Card
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            Build a printable half-sheet caddie card with your full bag distances
            adjusted for altitude and humidity, plus on-course reference tables
            for temperature and wind conditions — all computed offline from your
            standard yardages.
          </p>
        </div>
      </section>

      <StandardYardageCard />
    </>
  );
}
