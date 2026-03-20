import Link from 'next/link';

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
  },
  {
    slug: 'approach-aim-optimizer',
    category: 'Tool',
    title: 'Approach Aim Optimizer',
    description:
      'Monte Carlo aim-point calculator using 2σ dispersion ellipses, Pelz bimodal model, and strokes-gained objective to find the optimal aim point for any approach shot.',
  },
  {
    slug: 'standard-yardage-card',
    category: 'Tool',
    title: 'Standard Yardage Card',
    description:
      'Generate a printable caddie card with your full bag distances plus altitude, humidity, temperature, and wind reference tables — all on a half-sheet landscape layout.',
  },
  // Add future resources here — each gets its own /resources/[slug] page
];

export default function ResourcesPage() {
  return (
    <>
      <div className="page-hero" style={{ paddingBottom: 48, minHeight: 'auto' }}>
        <div className="page-hero-inner">
          <p className="eyebrow" style={{ marginBottom: '20px' }}>
            Learn
          </p>
          <h1 className="display-heading">
            <span style={{ color: 'var(--color-accent)' }}>Resources</span>
          </h1>
          <p className="display-sub">
            Tools, guides, and methodology to help you understand your game and prepare smarter.
          </p>
        </div>
      </div>

      <div className="resource-section">
        <p className="section-label">Tools &amp; Guides</p>
        <div className="resource-grid">
          {RESOURCES.map((r) => (
            <Link
              key={r.slug}
              href={`/resources/${r.slug}`}
              className="resource-card"
            >
              <div className="resource-card-top">
                <span className="feature-card-label">{r.category}</span>
                <span className="resource-card-arrow">→</span>
              </div>
              <div className="resource-card-title">{r.title}</div>
              <p className="resource-card-body">{r.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
