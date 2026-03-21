import Link from 'next/link';
import { ArrowRight, CloudSun, Crosshair, CreditCard } from 'lucide-react';

export const metadata = {
  title: 'Resources',
  description: 'Tools, guides, and methodology resources from theory.golf.',
};

const RESOURCES = [
  {
    slug: 'weather-yardage-card',
    category: 'Tool',
    title: 'Weather Yardage Card',
    description:
      'Generate a printable yardage card with club distances adjusted for temperature, altitude, humidity, and wind at your tee time.',
    icon: CloudSun,
    span: 'md:col-span-2',
  },
  {
    slug: 'approach-aim-optimizer',
    category: 'Tool',
    title: 'Approach Aim Optimizer',
    description:
      'Monte Carlo aim-point calculator using 2σ dispersion ellipses, Pelz bimodal model, and strokes-gained objective to find the optimal aim point for any approach shot.',
    icon: Crosshair,
    span: 'md:col-span-1',
  },
  {
    slug: 'standard-yardage-card',
    category: 'Tool',
    title: 'Standard Yardage Card',
    description:
      'Generate a printable caddie card with your full bag distances plus altitude, humidity, temperature, and wind reference tables — all on a half-sheet landscape layout.',
    icon: CreditCard,
    span: 'md:col-span-1',
  },
];

export default function ResourcesPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="px-6 pt-20 pb-12">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-5">Learn</p>
          <h1 className="font-display font-extrabold text-[clamp(40px,7vw,80px)] leading-[0.9] tracking-tight uppercase text-foreground">
            <span className="text-primary">Resources</span>
          </h1>
          <p className="font-body text-base text-muted-foreground mt-5 max-w-lg leading-relaxed">
            Tools, guides, and methodology to help you understand your game and prepare smarter.
          </p>
        </div>
      </section>

      {/* ── Resource Bento Grid ──────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <p className="section-label mb-6">Tools &amp; Guides</p>

          <div className="grid md:grid-cols-3 gap-px bg-border border border-border">
            {RESOURCES.map((r) => {
              const Icon = r.icon;
              return (
                <Link
                  key={r.slug}
                  href={`/resources/${r.slug}`}
                  className={`${r.span} bg-card p-7 no-underline flex flex-col gap-4 group transition-colors hover:bg-surface`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="size-5 text-primary" />
                      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-primary">
                        {r.category}
                      </span>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-lg tracking-[0.02em] uppercase text-foreground mb-2">
                      {r.title}
                    </h2>
                    <p className="font-body text-sm text-muted-foreground leading-relaxed">
                      {r.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
