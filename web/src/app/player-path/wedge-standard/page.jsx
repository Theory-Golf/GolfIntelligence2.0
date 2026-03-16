import Link from 'next/link';
import WedgeStandard from '@/components/WedgeStandard';

export const metadata = {
  title: 'Wedge Standard — PlayerPath',
  description:
    'Adaptive Trackman wedge assessment. Targets shift as performance improves — the standard rises with you.',
};

export default function WedgeStandardPage() {
  return (
    <>
      <div className="page-hero" style={{ paddingBottom: 48, minHeight: 'auto' }}>
        <div className="page-hero-inner">
          <Link href="/player-path" className="resource-back-link">
            ← PlayerPath
          </Link>

          <p className="eyebrow" style={{ marginBottom: '20px' }}>
            Assessment · Wedge
          </p>

          <h1 className="display-heading">
            Wedge
            <span style={{ color: 'var(--color-accent)' }}>Standard</span>
          </h1>

          <p className="display-sub">
            An adaptive assessment that adjusts difficulty as your performance
            improves. Scored on proximity, carry accuracy, and dispersion.
            The standard rises with you.
          </p>
        </div>
      </div>

      <WedgeStandard />
    </>
  );
}
