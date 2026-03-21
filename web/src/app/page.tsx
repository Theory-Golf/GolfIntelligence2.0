export const metadata = {
  title: 'theory.golf',
  description: 'Not more data. Better answers. Golf intelligence for collegiate programs.',
};

export default function HomePage() {
  return (
    <>
      {/* ── HERO ───────────────────────────────────────────────── */}
      <div className="page-hero page-hero--home">
        <div className="page-hero-inner">
          <p className="eyebrow" style={{ marginBottom: '20px' }}>
            theory.golf
          </p>

          <h1 className="display-heading">
            Not More Data.<br />
            <span style={{ color: 'var(--color-accent)' }}>
              Better Answers.
            </span>
          </h1>

          <p className="display-sub">
            A golf intelligence platform built for college programs. Know why
            scores happened, which players to develop first, and exactly what
            to work on.
          </p>
        </div>
      </div>

      {/* ── PROBLEM STATEMENT ──────────────────────────────────── */}
      <div className="home-problem">
        <div className="home-problem-inner">
          <p className="eyebrow" style={{ marginBottom: '16px' }}>
            The Standard
          </p>
          <p className="home-problem-copy">
            A dashboard that shows you what happened is a scoreboard.
            A dashboard that explains why it happened — and points to
            what changes next — is intelligence.
          </p>
          <p className="home-problem-sub">
            Most programs have more data than they know what to do with.
            They don't have a system that turns that data into a decision
            every Monday morning.
          </p>
        </div>
      </div>

      {/* ── PRODUCT PILLARS ────────────────────────────────────── */}
      <div className="home-pillars">
        <div className="home-pillars-inner">
          <p className="section-label">The System</p>

          <div className="home-pillar-grid">
            <div className="home-pillar-card">
              <p className="feature-card-label">01 — Golf Intelligence</p>
              <h2 className="home-pillar-title">
                Start With<br />
                <span style={{ color: 'var(--color-accent)' }}>Tiger 5</span>
              </h2>
              <p className="home-pillar-body">
                Five failure categories — Par-5 Bogeys, Doubles & Worse,
                Three-Putts, Bogeys from 9-iron or less, Penalty Strokes —
                account for the majority of scoring damage in any round.
                Tiger 5 is your landing view every time.
              </p>
              <p className="home-pillar-body" style={{ marginTop: '12px' }}>
                Six segment tabs let you navigate to the root cause in
                10–15 minutes. Not a data dump. A post-round workflow.
              </p>
              <p className="home-pillar-standard">
                Tiger standard: ≤1.5 failures / round
              </p>
            </div>

            <div className="home-pillar-card">
              <p className="feature-card-label">02 — PlayerPath</p>
              <h2 className="home-pillar-title">
                Find The<br />
                <span style={{ color: 'var(--color-accent)' }}>Driver</span>
              </h2>
              <p className="home-pillar-body">
                Every player has one part of their game that is upstream of
                everything else. PlayerPath identifies it — not by correlation,
                but by causal chain: Driving constrains Approach, Approach
                constrains Short Game, Short Game constrains Putting.
              </p>
              <p className="home-pillar-body" style={{ marginTop: '12px' }}>
                The output isn't a report. It's a finding, a causal
                explanation, and an intervention — in that order.
              </p>
              <p className="home-pillar-standard">
                Benchmarked vs. PGA Tour · College +3 · Scratch
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIGER 5 STRIP ──────────────────────────────────────── */}
      <div className="home-tiger">
        <div className="home-tiger-inner">
          <p className="eyebrow" style={{ marginBottom: '24px' }}>
            Tiger 5 — The Landing View
          </p>
          <div className="home-tiger-grid">
            <div className="home-tiger-item">
              <span className="home-tiger-num">01</span>
              <span className="home-tiger-label">Par-5 Bogeys</span>
            </div>
            <div className="home-tiger-item">
              <span className="home-tiger-num">02</span>
              <span className="home-tiger-label">Doubles & Worse</span>
            </div>
            <div className="home-tiger-item">
              <span className="home-tiger-num">03</span>
              <span className="home-tiger-label">Three-Putts</span>
            </div>
            <div className="home-tiger-item">
              <span className="home-tiger-num">04</span>
              <span className="home-tiger-label">Bogeys from 9-Iron or Less</span>
            </div>
            <div className="home-tiger-item">
              <span className="home-tiger-num">05</span>
              <span className="home-tiger-label">Penalty Strokes</span>
            </div>
          </div>
          <p className="home-tiger-sub">
            These five categories account for the majority of scoring damage
            in any collegiate round. Your first view after every competitive
            round. Every time.
          </p>
        </div>
      </div>
    </>
  );
}
