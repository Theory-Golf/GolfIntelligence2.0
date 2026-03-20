import Link from 'next/link';
import StandardYardageCard from '@/components/StandardYardageCard';

export const metadata = {
  title: 'Standard Yardage Card — Resources',
  description:
    'Generate a printable caddie card with your full bag distances plus altitude, humidity, temperature, and wind reference tables — all on a half-sheet landscape layout.',
};

export default function StandardYardageCardPage() {
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
            Standard{' '}
            <span style={{ color: 'var(--color-accent)' }}>Yardage</span>{' '}
            Card
          </h1>
          <p className="display-sub">
            Build a printable half-sheet caddie card with your full bag distances
            adjusted for altitude and humidity, plus on-course reference tables
            for temperature and wind conditions — all computed offline from your
            standard yardages.
          </p>
        </div>
      </div>

      <StandardYardageCard />
    </>
  );
}
