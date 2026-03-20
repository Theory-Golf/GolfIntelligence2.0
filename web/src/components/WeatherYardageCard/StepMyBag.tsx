// @ts-nocheck
'use client';

export const CLUB_OPTIONS = [
  { id: '',      name: '— empty —', def: 0   },
  { id: 'driver', name: 'Driver',   def: 240 },
  { id: '3w',    name: '3-Wood',    def: 220 },
  { id: '4w',    name: '4-Wood',    def: 210 },
  { id: '5w',    name: '5-Wood',    def: 200 },
  { id: '7w',    name: '7-Wood',    def: 190 },
  { id: '2h',    name: '2-Hybrid',  def: 210 },
  { id: '3h',    name: '3-Hybrid',  def: 200 },
  { id: '4h',    name: '4-Hybrid',  def: 190 },
  { id: '5h',    name: '5-Hybrid',  def: 180 },
  { id: '3i',    name: '3-Iron',    def: 200 },
  { id: '4i',    name: '4-Iron',    def: 185 },
  { id: '5i',    name: '5-Iron',    def: 175 },
  { id: '6i',    name: '6-Iron',    def: 165 },
  { id: '7i',    name: '7-Iron',    def: 155 },
  { id: '8i',    name: '8-Iron',    def: 145 },
  { id: '9i',    name: '9-Iron',    def: 135 },
  { id: 'pw',    name: 'PW',        def: 125 },
  { id: 'gw',    name: 'GW',        def: 115 },
  { id: 'sw',    name: 'SW',        def: 100 },
  { id: 'lw',    name: 'LW',        def: 85  },
];

export const DEFAULT_CLUBS = [
  { id: 'driver', dist: 240 },
  { id: '3w',     dist: 220 },
  { id: '5w',     dist: 200 },
  { id: '4i',     dist: 185 },
  { id: '5i',     dist: 175 },
  { id: '6i',     dist: 165 },
  { id: '7i',     dist: 155 },
  { id: '8i',     dist: 145 },
  { id: '9i',     dist: 135 },
  { id: 'pw',     dist: 125 },
  { id: 'gw',     dist: 115 },
  { id: 'sw',     dist: 100 },
  { id: 'lw',     dist: 85  },
];

export default function StepMyBag({ clubs, setClubs }) {
  function handleClubChange(idx, field, value) {
    const updated = clubs.map((c, i) => {
      if (i !== idx) return c;
      if (field === 'id') {
        const opt = CLUB_OPTIONS.find((o) => o.id === value);
        return { id: value, dist: opt?.def ?? 0 };
      }
      return { ...c, dist: parseInt(value, 10) || 0 };
    });
    setClubs(updated);
  }

  return (
    <div className="wyc-step-content">
      <p className="eyebrow" style={{ marginBottom: 16 }}>Step 2</p>
      <h2 className="wyc-step-title">My Bag</h2>
      <p className="wyc-step-desc">
        Enter your standard carry distance for each club at 70°F, sea level, no wind.
      </p>

      <div className="wyc-bag-header">
        <span>Club</span>
        <span>Carry (yds)</span>
      </div>

      <div className="wyc-bag-grid">
        {clubs.map((club, idx) => {
          const isEmpty = club.id === '';
          return (
            <div key={idx} className="wyc-club-row">
              <select
                className="wyc-input wyc-club-select"
                value={club.id}
                onChange={(e) => handleClubChange(idx, 'id', e.target.value)}
                aria-label={`Club ${idx + 1}`}
              >
                {CLUB_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
              <input
                className="wyc-input wyc-dist-input"
                type="number"
                min={0}
                max={400}
                value={isEmpty ? '' : club.dist}
                disabled={isEmpty}
                onChange={(e) => handleClubChange(idx, 'dist', e.target.value)}
                aria-label={`Distance for club ${idx + 1}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
