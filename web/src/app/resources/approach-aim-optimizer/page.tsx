import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ApproachAimOptimizer from '@/components/ApproachAimOptimizer';

export const metadata = {
  title: 'Approach Aim Optimizer — Resources',
  description:
    'Monte Carlo aim-point calculator using 2σ dispersion ellipses and strokes-gained objective to find the optimal aim point for any approach shot.',
};

export default function ApproachAimOptimizerPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/resources" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground no-underline mb-6 hover:text-primary transition-colors">
            <ArrowLeft className="size-3" /> Resources
          </Link>
          <p className="eyebrow mb-4">Tool</p>
          <h1 className="font-display font-extrabold text-[clamp(32px,6vw,64px)] leading-[0.9] tracking-tight uppercase text-foreground">
            Approach <span className="text-primary">Aim</span> Optimizer
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            Monte Carlo aim-point calculator using 2σ rotated dispersion ellipses,
            Pelz bimodal model for short-range wedge shots, and a Broadie strokes-gained
            objective to find the statistically optimal aim point — accounting for green
            geometry, hazard penalties, and your natural shot shape.
          </p>
        </div>
      </section>

      <ApproachAimOptimizer />
    </>
  );
}
