'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ACTIVITIES, CATEGORIES, TYPES } from '@/data/practiceActivities';
import './PracticeLibrary.css';

/**
 * Map activity IDs to their interactive tool routes.
 * As each activity page is built, add its route here.
 */
const ACTIVITY_ROUTES = {
  'round-simulation': '/player-path/round-simulation',
  'wedge-standard': '/player-path/wedge-standard',
};

/**
 * All Performance Driver IDs available for demo toggling.
 * Putting: M1, M2, L1, L2, L3
 * Wedge: A1, A2, A3, A4
 * Additional segments extend this list as activities are added.
 */
const ALL_DRIVER_IDS = ['M1', 'M2', 'L1', 'L2', 'L3', 'A1', 'A2', 'A3', 'A4'];

export default function PracticeLibrary() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [flaggedDrivers, setFlaggedDrivers] = useState([]);

  // Toggle a driver chip on/off
  function toggleDriver(id) {
    setFlaggedDrivers((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  // Derive filtered + annotated activity list
  const { relevant, others } = useMemo(() => {
    const flaggedSet = new Set(flaggedDrivers);

    const filtered = ACTIVITIES.filter((a) => {
      const catMatch = activeCategory === 'all' || a.category === activeCategory;
      const typeMatch = activeType === 'all' || a.type === activeType;
      return catMatch && typeMatch;
    });

    if (flaggedSet.size === 0) {
      return { relevant: [], others: filtered };
    }

    const rel = filtered.filter((a) =>
      a.connected_drivers.some((cd) => flaggedSet.has(cd.driver_id))
    );
    const oth = filtered.filter(
      (a) => !a.connected_drivers.some((cd) => flaggedSet.has(cd.driver_id))
    );
    return { relevant: rel, others: oth };
  }, [activeCategory, activeType, flaggedDrivers]);

  const totalVisible = relevant.length + others.length;
  const hasDriverFilter = flaggedDrivers.length > 0;

  return (
    <div className="pl-wrapper">

      {/* ── Filter bar ─────────────────────────────────────── */}
      <p className="pl-section-label">Practice Library</p>

      <div className="pl-filter-row">
        <span className="pl-filter-label">Category</span>
        <div className="pl-filters">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`pl-filter-btn${activeCategory === cat.id ? ' is-active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pl-filter-row">
        <span className="pl-filter-label">Type</span>
        <div className="pl-filters">
          {TYPES.map((t) => (
            <button
              key={t.id}
              className={`pl-filter-btn${activeType === t.id ? ' is-active' : ''}`}
              onClick={() => setActiveType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Driver intelligence toggle ──────────────────────── */}
      <div className="pl-driver-section">
        <div className="pl-driver-section-header">
          <span className="pl-driver-section-title">Flagged Drivers</span>
          <span className="pl-driver-section-hint">
            Toggle a driver to surface the activities that address it
          </span>
        </div>
        <div className="pl-driver-chips">
          {ALL_DRIVER_IDS.map((id) => (
            <button
              key={id}
              className={`pl-driver-chip${flaggedDrivers.includes(id) ? ' is-flagged' : ''}`}
              onClick={() => toggleDriver(id)}
            >
              {id}
            </button>
          ))}
          {hasDriverFilter && (
            <button
              className="pl-driver-chip-clear"
              onClick={() => setFlaggedDrivers([])}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Results bar ────────────────────────────────────── */}
      <div className="pl-results-bar">
        <p className="pl-results-count">
          <strong>{totalVisible}</strong>{' '}
          {totalVisible === 1 ? 'activity' : 'activities'}
          {hasDriverFilter && relevant.length > 0 && (
            <> &mdash; <strong>{relevant.length}</strong> matched</>
          )}
        </p>
        {hasDriverFilter && relevant.length > 0 && (
          <span className="pl-relevance-note">
            Relevant activities ranked first
          </span>
        )}
      </div>

      {/* ── Activity grid ───────────────────────────────────── */}
      {totalVisible === 0 ? (
        <div className="pl-empty">
          <p className="pl-empty-text">No activities match the current filters</p>
        </div>
      ) : (
        <div className="pl-grid">
          {/* Relevant activities first */}
          {relevant.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              flaggedDrivers={flaggedDrivers}
              variant="relevant"
            />
          ))}
          {/* Remaining activities */}
          {others.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              flaggedDrivers={flaggedDrivers}
              variant={hasDriverFilter ? 'dimmed' : 'normal'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity Card ──────────────────────────────────────────────────

function ActivityCard({ activity, flaggedDrivers, variant }) {
  const flaggedSet = new Set(flaggedDrivers);
  const isRelevant = variant === 'relevant';
  const isDimmed = variant === 'dimmed';
  const isAssessment = activity.type === 'skill_assessment';
  const route = ACTIVITY_ROUTES[activity.id];

  const cardClass = [
    'pl-card',
    isRelevant ? 'is-relevant' : '',
    isDimmed ? 'is-dimmed' : '',
    route ? 'is-linkable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cardContent = (
    <>
      {/* Name + type badge */}
      <div className="pl-card-header">
        <span className="pl-card-name">{activity.name}</span>
        <span className={`pl-type-badge ${isAssessment ? 'assessment' : 'development'}`}>
          {isAssessment ? 'Assessment' : 'Development'}
        </span>
      </div>

      {/* Description */}
      <p className="pl-card-description">{activity.description}</p>

      {/* Connected drivers + launch arrow */}
      <div className="pl-card-drivers">
        <span className="pl-card-drivers-label">Drivers</span>
        {activity.connected_drivers.map((cd) => {
          const isFlagged = flaggedSet.has(cd.driver_id);
          return (
            <span
              key={cd.driver_id}
              className={`pl-connected-driver${isFlagged ? ' is-flagged' : ''}`}
              title={cd.connection}
            >
              {cd.driver_id}
            </span>
          );
        })}
        {isRelevant && <span className="pl-relevant-badge">Recommended</span>}
        {route && <span className="pl-card-launch">Launch →</span>}
      </div>
    </>
  );

  if (route) {
    return (
      <Link href={route} className={cardClass} style={{ textDecoration: 'none' }}>
        {cardContent}
      </Link>
    );
  }

  return <div className={cardClass}>{cardContent}</div>;
}
