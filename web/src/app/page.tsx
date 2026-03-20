export const metadata = {
  title: 'theory.golf',
  description: 'The intelligence layer for collegiate golf.',
};

export default function HomePage() {
  return (
    <div className="page-hero">
      <div className="page-hero-inner">
        <p className="eyebrow" style={{ marginBottom: '20px' }}>
          theory.golf
        </p>

        <h1 className="display-heading">
          The Intelligence<br />
          Layer for{' '}
          <span style={{ color: 'var(--color-accent)' }}>
            Collegiate Golf
          </span>
        </h1>

        <p className="display-sub">
          Data-driven analytics built for college programs. Track strokes gained,
          identify performance drivers, and develop players with precision.
        </p>

        <div className="feature-grid">
          <div className="feature-card">
            <p className="feature-card-label">01</p>
            <h3 className="feature-card-title">Golf Intelligence</h3>
            <p className="feature-card-body">
              Program-level dashboards with strokes gained, shot-by-shot
              breakdowns, and benchmark comparisons.
            </p>
          </div>
          <div className="feature-card">
            <p className="feature-card-label">02</p>
            <h3 className="feature-card-title">PlayerPath</h3>
            <p className="feature-card-body">
              Identify each player's highest-leverage improvement areas and track
              development over time.
            </p>
          </div>
          <div className="feature-card">
            <p className="feature-card-label">03</p>
            <h3 className="feature-card-title">College-Only Access</h3>
            <p className="feature-card-body">
              Every program sees only their own players' data. Secure,
              institution-specific access built in from day one.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
