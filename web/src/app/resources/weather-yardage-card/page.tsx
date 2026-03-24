import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import WeatherYardageCard from '@/components/WeatherYardageCard';

export const metadata = {
  title: 'Round Specific Yardage Card — Resources',
  description:
    'Generate a printable yardage card with club distances adjusted for your round\'s temperature, altitude, humidity, and wind forecast.',
};

export default function WeatherYardageCardPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/resources" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors">
            <ArrowLeft className="size-3" /> Resources
          </Link>
          <p className="eyebrow mb-4">Tool</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Round Specific <span className="text-primary">Yardage</span> Card
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            Enter your round details to generate a yardage card adjusted for today&apos;s conditions.
            Fetches live forecast data for your course and calculates how temperature,
            altitude, humidity, and wind affect each club in your bag.
          </p>
        </div>
      </section>

      <WeatherYardageCard />
    </>
  );
}
