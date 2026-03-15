'use client';

const STEPS = [
  { n: 1, label: 'Round' },
  { n: 2, label: 'My Bag' },
  { n: 3, label: 'Wedges' },
  { n: 4, label: 'Print' },
];

export default function WizardProgress({ step }) {
  return (
    <div className="wyc-progress">
      {STEPS.map((s, i) => (
        <div key={s.n} className="wyc-progress-step">
          <div className={`wyc-step-bubble ${step >= s.n ? 'is-done' : ''} ${step === s.n ? 'is-active' : ''}`}>
            {step > s.n ? '✓' : s.n}
          </div>
          <span className={`wyc-step-label ${step === s.n ? 'is-active' : ''}`}>{s.label}</span>
          {i < STEPS.length - 1 && (
            <div className={`wyc-step-connector ${step > s.n ? 'is-done' : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
}
