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
          Every shot tells a story. Golf Intelligence turns that data into a
          clear picture of what's costing strokes — and a direct path to fix
          it. From round analysis to structured practice, Theory Golf connects
          the loop.
        </p>

        <div className="loop-strip">
          <p className="eyebrow" style={{ marginBottom: '20px' }}>The Loop</p>
          <div className="loop-steps">
            <div className="loop-step">
              <span className="loop-step-num">01</span>
              <p className="loop-step-title">Measure</p>
              <p className="loop-step-body">Track every shot with Tiger 5 and Strokes Gained</p>
            </div>
            <div className="loop-arrow">→</div>
            <div className="loop-step">
              <span className="loop-step-num">02</span>
              <p className="loop-step-title">Diagnose</p>
              <p className="loop-step-body">PlayerPath identifies your top performance drivers</p>
            </div>
            <div className="loop-arrow">→</div>
            <div className="loop-step">
              <span className="loop-step-num">03</span>
              <p className="loop-step-title">Practice</p>
              <p className="loop-step-body">Structured resources to work on exactly the right things</p>
            </div>
          </div>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <p className="feature-card-label">01</p>
            <h3 className="feature-card-title">Golf Intelligence</h3>
            <p className="feature-card-body">
              Tiger 5, Tiger 5 Root Cause, and Strokes Gained — the
              three-layer framework that tells coaches and players exactly
              when a round broke down, where it happened, and how much it
              cost.
            </p>
          </div>
          <div className="feature-card">
            <p className="feature-card-label">02</p>
            <h3 className="feature-card-title">PlayerPath</h3>
            <p className="feature-card-body">
              Turns round data into a ranked list of performance drivers.
              Coaches and players leave every review aligned on the
              highest-leverage areas to work on — no guesswork.
            </p>
          </div>
          <div className="feature-card">
            <p className="feature-card-label">03</p>
            <h3 className="feature-card-title">Resources</h3>
            <p className="feature-card-body">
              On-course tools built for collegiate programs. Customizable
              yardage cards, aiming aids, and practice frameworks that
              connect directly to what the data identifies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
