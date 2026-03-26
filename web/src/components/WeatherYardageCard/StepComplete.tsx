'use client';

export default function StepComplete() {
  return (
    <div className="wyc-step-content wyc-step-complete">
      <div className="wyc-complete-icon">✓</div>
      <h2 className="wyc-step-title">Card Ready</h2>
      <p className="wyc-step-desc">
        Your weather-adjusted yardage card is previewed below.
        Print in landscape — two cards per page, cut apart and fold to pocket size.
      </p>

      {/* Feature callouts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 24,
          textAlign: 'left',
        }}
      >
        {[
          { label: 'Adj column', detail: 'Weather-corrected carry' },
          { label: 'Dsp column', detail: 'DECADE dispersion radius' },
          { label: 'Wind table', detail: 'Forecast column highlighted' },
          { label: 'Temp table', detail: 'Adjust as round temp changes' },
        ].map((f) => (
          <div
            key={f.label}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              padding: '8px 12px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--primary)',
                marginBottom: 2,
              }}
            >
              {f.label}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--muted-foreground)',
              }}
            >
              {f.detail}
            </div>
          </div>
        ))}
      </div>

      <button
        className="wyc-btn-primary"
        onClick={() => window.print()}
      >
        Print Card →
      </button>
    </div>
  );
}
