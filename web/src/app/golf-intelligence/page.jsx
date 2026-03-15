export const metadata = {
  title: 'Golf Intelligence',
  description: 'Program-level analytics dashboards for collegiate golf.',
};

export default function GolfIntelligencePage() {
  return (
    <div className="page-hero">
      <div className="page-hero-inner">
        <p className="eyebrow" style={{ marginBottom: '20px' }}>
          Dashboard
        </p>

        <h1 className="display-heading">
          Golf{' '}
          <span style={{ color: 'var(--color-accent)' }}>Intelligence</span>
        </h1>

        <p className="display-sub">
          Your program's full analytics suite — strokes gained by category,
          shot-by-shot data, benchmark comparisons, and round-level trends.
          Each college logs in and sees only their own players' data.
        </p>

        <div
          style={{
            marginTop: '40px',
            padding: '32px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-card)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              marginBottom: '12px',
            }}
          >
            Status
          </p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '18px',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              color: 'var(--color-text)',
            }}
          >
            Authentication coming soon
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-muted)',
              marginTop: '8px',
              lineHeight: 1.6,
            }}
          >
            College login and per-program data access will be wired up in the
            next phase. The full dashboard engine already exists — we're building
            the secure auth layer now.
          </p>
        </div>

        <span className="coming-soon">Login — Coming Soon</span>
      </div>
    </div>
  );
}
