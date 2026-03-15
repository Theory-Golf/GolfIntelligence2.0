import Link from 'next/link';
import WeatherYardageCard from '@/components/WeatherYardageCard';

export const metadata = {
  title: 'Weather Yardage Card — Resources',
  description:
    'Generate a printable yardage card with club distances adjusted for temperature, altitude, humidity, and wind.',
};

export default function WeatherYardageCardPage() {
  return (
    <>
      <div className="page-hero" style={{ paddingBottom: 32, minHeight: 'auto' }}>
        <div className="page-hero-inner">
          <Link href="/resources" className="resource-back-link">
            ← Resources
          </Link>
          <p className="eyebrow" style={{ marginBottom: '16px' }}>
            Tool
          </p>
          <h1 className="display-heading">
            Weather{' '}
            <span style={{ color: 'var(--color-accent)' }}>Yardage</span>{' '}
            Card
          </h1>
          <p className="display-sub">
            Enter your round details to generate a weather-adjusted yardage card.
            Fetches live forecast data for your course and calculates how temperature,
            altitude, humidity, and wind affect each club in your bag.
          </p>
        </div>
      </div>

      <WeatherYardageCard />
    </>
  );
}
