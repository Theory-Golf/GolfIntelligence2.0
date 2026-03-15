export const metadata = {
  title: 'Resources',
  description: 'Guides, methodology, and learning resources from theory.golf.',
};

export default function ResourcesPage() {
  return (
    <div className="page-hero">
      <div className="page-hero-inner">
        <p className="eyebrow" style={{ marginBottom: '20px' }}>
          Learn
        </p>

        <h1 className="display-heading">
          <span style={{ color: 'var(--color-accent)' }}>Resources</span>
        </h1>

        <p className="display-sub">
          Guides on strokes gained methodology, how to interpret your data, and
          how the best programs use analytics to build better teams.
        </p>

        <span className="coming-soon">Full Page — Coming Soon</span>
      </div>
    </div>
  );
}
