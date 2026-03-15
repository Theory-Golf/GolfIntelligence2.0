'use client';

export const WEDGE_DEFS = [
  { id: 'pw', name: 'PW', fullDef: 125, threeDef: 105, halfDef: 85  },
  { id: 'gw', name: 'GW', fullDef: 115, threeDef: 95,  halfDef: 75  },
  { id: 'sw', name: 'SW', fullDef: 100, threeDef: 80,  halfDef: 60  },
  { id: 'lw', name: 'LW', fullDef: 85,  threeDef: 65,  halfDef: 45  },
];

export default function StepWedges({ wedges, setWedges }) {
  function handleChange(id, swing, value) {
    setWedges((prev) => ({
      ...prev,
      [id]: { ...prev[id], [swing]: parseInt(value, 10) || 0 },
    }));
  }

  return (
    <div className="wyc-step-content">
      <p className="eyebrow" style={{ marginBottom: 16 }}>Step 3</p>
      <h2 className="wyc-step-title">Wedge Distances</h2>
      <p className="wyc-step-desc">
        Enter your standard carry distances for partial wedge swings. Used to build the wedge distance matrix on your card.
      </p>

      <div className="wyc-wedge-grid">
        {WEDGE_DEFS.map((w) => {
          const vals = wedges[w.id] || { half: w.halfDef, three: w.threeDef, full: w.fullDef };
          return (
            <div key={w.id} className="wyc-wedge-block">
              <div className="wyc-wedge-name">{w.name}</div>
              <div className="wyc-wedge-inputs">
                <div className="wyc-field">
                  <label className="wyc-label" htmlFor={`w_${w.id}_half`}>½ Swing</label>
                  <input
                    id={`w_${w.id}_half`}
                    className="wyc-input"
                    type="number"
                    min={0}
                    max={200}
                    value={vals.half}
                    onChange={(e) => handleChange(w.id, 'half', e.target.value)}
                  />
                </div>
                <div className="wyc-field">
                  <label className="wyc-label" htmlFor={`w_${w.id}_three`}>¾ Swing</label>
                  <input
                    id={`w_${w.id}_three`}
                    className="wyc-input"
                    type="number"
                    min={0}
                    max={200}
                    value={vals.three}
                    onChange={(e) => handleChange(w.id, 'three', e.target.value)}
                  />
                </div>
                <div className="wyc-field">
                  <label className="wyc-label" htmlFor={`w_${w.id}_full`}>Full</label>
                  <input
                    id={`w_${w.id}_full`}
                    className="wyc-input"
                    type="number"
                    min={0}
                    max={200}
                    value={vals.full}
                    onChange={(e) => handleChange(w.id, 'full', e.target.value)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
