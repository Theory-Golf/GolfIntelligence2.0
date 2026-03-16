'use client';

export default function StepComplete() {
  return (
    <div className="wyc-step-content wyc-step-complete">
      <div className="wyc-complete-icon">✓</div>
      <h2 className="wyc-step-title">Card Generated</h2>
      <p className="wyc-step-desc">
        Your weather-adjusted yardage card is ready below. Print two cards per page — cut apart and fold to pocket size.
      </p>
      <button
        className="wyc-btn-primary"
        style={{ marginTop: 24 }}
        onClick={() => window.print()}
      >
        Print Card
      </button>
    </div>
  );
}
