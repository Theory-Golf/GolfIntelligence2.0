import Link from 'next/link';
import ApproachAimOptimizer from '@/components/ApproachAimOptimizer';

export const metadata = {
  title: 'Approach Aim Optimizer — Resources',
  description:
    'Monte Carlo aim-point calculator using 2σ dispersion ellipses and strokes-gained objective to find the optimal aim point for any approach shot.',
};

export default function ApproachAimOptimizerPage() {
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
            Approach{' '}
            <span style={{ color: 'var(--color-accent)' }}>Aim</span>{' '}
            Optimizer
          </h1>
          <p className="display-sub">
            Monte Carlo aim-point calculator using 2σ rotated dispersion ellipses,
            Pelz bimodal model for short-range wedge shots, and a Broadie strokes-gained
            objective to find the statistically optimal aim point — accounting for green
            geometry, hazard penalties, and your natural shot shape.
          </p>
        </div>
      </div>

      <ApproachAimOptimizer />
    </>
  );
}
