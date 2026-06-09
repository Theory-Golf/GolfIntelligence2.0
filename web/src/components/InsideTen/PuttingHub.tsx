'use client';

import Link from 'next/link';
import './InsideTen.css';

interface Drill {
  id: string;
  name: string;
  desc: string;
  meta: string;
  href: string | null;
  live: boolean;
}

const DRILLS: Drill[] = [
  {
    id: 'inside-ten',
    name: 'Inside Ten',
    desc: '18 putts across 6 ladders from 3 to 10 feet. Speed control and green reading with SG tracking.',
    meta: '18 putts · single-input scoring · SG tracked',
    href: '/player-path/putting/inside-ten',
    live: true,
  },
  {
    id: 'inside-twenty',
    name: 'Inside Twenty',
    desc: '18 putts across 6 ladders from 5 to 19 feet. Mid-range conversion with tier-based tracking.',
    meta: '18 putts · single-input scoring · tier tracked',
    href: '/player-path/putting/inside-twenty',
    live: true,
  },
  {
    id: 'lag-test',
    name: 'Lag Test',
    desc: 'Coming soon.',
    meta: 'Coming soon',
    href: null,
    live: false,
  },
];

export default function PuttingHub() {
  return (
    <section className="px-6 pb-20">
      <div className="max-w-3xl mx-auto">
        <div className="it-hub-grid">
          {DRILLS.map(drill =>
            drill.live && drill.href ? (
              <Link key={drill.id} href={drill.href} className="it-hub-drill-card" style={{ textDecoration: 'none' }}>
                <div className="it-hub-drill-header">
                  <span className="it-hub-drill-name">{drill.name}</span>
                  <span className="it-hub-drill-badge is-live">Live</span>
                </div>
                <p className="it-hub-drill-desc">{drill.desc}</p>
                <p className="it-hub-drill-meta">{drill.meta}</p>
              </Link>
            ) : (
              <div key={drill.id} className="it-hub-drill-card is-placeholder">
                <div className="it-hub-drill-header">
                  <span className="it-hub-drill-name">{drill.name}</span>
                  <span className="it-hub-drill-badge">Soon</span>
                </div>
                <p className="it-hub-drill-desc">{drill.desc}</p>
                <p className="it-hub-drill-meta">{drill.meta}</p>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
