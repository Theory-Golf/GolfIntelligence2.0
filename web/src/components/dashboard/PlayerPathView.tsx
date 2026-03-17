'use client';

import { useState } from 'react';
import type { PerformanceDriversResult, PlayerPathMetrics, PerformanceDriversResultV2 } from '@/lib/golf/types';

export function PlayerPathView({ drivers: _drivers, playerPathMetrics, performanceDriversV2 }: { drivers: PerformanceDriversResult; playerPathMetrics: PlayerPathMetrics; performanceDriversV2: PerformanceDriversResultV2 }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Driving': true,
    'Approach': true,
    'Putting': true,
    'Short Game': true,
  });

  // Toggle section expansion
  const toggleSection = (segment: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [segment]: !prev[segment]
    }));
  };

  // Get severity color
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'Critical': return 'var(--scarlet)';
      case 'Significant': return '#EA580C';
      case 'Moderate': return '#CA8A04';
      case 'Strong': return 'var(--under)';
      default: return 'var(--ash)';
    }
  };

  // Get SG value from a driver for sorting purposes
  const getDriverSG = (driver: { code: string; data: any }): number => {
    if (!driver.data) return 0;
    const { code, data } = driver;

    // Driving drivers: D1-D5 - use sgImpact
    if (code.startsWith('D')) {
      return data.sgImpact ?? 0;
    }

    // Approach drivers: A1-A4 - sum of all band sgTotal values
    if (code.startsWith('A') && data.bands) {
      return data.bands.reduce((sum: number, band: any) => sum + (band.sgTotal ?? 0), 0);
    }

    // Putting - Lag: L1-L3 - use sgImpact
    if (code === 'L1-L3') {
      return data.sgImpact ?? 0;
    }

    // Putting - Makeable: M1 - average of bucket avgSG (weighted by totalPutts)
    if (code === 'M1' && data.buckets) {
      const totalPutts = data.buckets.reduce((sum: number, b: any) => sum + (b.totalPutts ?? 0), 0);
      if (totalPutts === 0) return 0;
      const totalSG = data.buckets.reduce((sum: number, b: any) => sum + ((b.avgSG ?? 0) * (b.totalPutts ?? 0)), 0);
      return totalSG / totalPutts;
    }

    // Putting - Primary Loss: M2 - use primaryLossSG
    if (code === 'M2') {
      return data.primaryLossSG ?? 0;
    }

    // Short Game drivers: S1-S3
    if (code.startsWith('S')) {
      // S3 has direct sgImpact
      if (code === 'S3') {
        return data.sgImpact ?? 0;
      }
      // S1 and S2 - calculate from lieMetrics or distanceMetrics
      if (data.lieMetrics) {
        // Calculate weighted SG from lie metrics
        const totalShots = data.lieMetrics.reduce((sum: number, m: any) => sum + (m.totalShots ?? 0), 0);
        if (totalShots === 0) return 0;
        // Estimate SG based on proximity rate (lower rate = negative SG)
        const avgProximityRate = data.lieMetrics.reduce((sum: number, m: any) => sum + ((m.proximityRate ?? 0) * (m.totalShots ?? 0)), 0) / totalShots;
        // Assume baseline 50% proximity rate = 0 SG, below is negative
        return (avgProximityRate - 50) * 0.1;
      }
      if (data.distanceMetrics) {
        const totalShots = data.distanceMetrics.reduce((sum: number, m: any) => sum + (m.totalShots ?? 0), 0);
        if (totalShots === 0) return 0;
        const avgProximityRate = data.distanceMetrics.reduce((sum: number, m: any) => sum + ((m.proximityRate ?? 0) * (m.totalShots ?? 0)), 0) / totalShots;
        return (avgProximityRate - 50) * 0.1;
      }
    }

    return 0;
  };


  // Get drivers for all segments
  const getAllSegmentDrivers = () => {
    const { driving, approach, putting, shortGame } = playerPathMetrics;

    return {
      'Driving': [
        { code: 'D1', data: driving.d1 },
        { code: 'D2', data: driving.d2 },
        { code: 'D3', data: driving.d3 },
        { code: 'D4', data: driving.d4 },
        { code: 'D5', data: driving.d5 },
      ],
      'Approach': [
        { code: 'A1', data: approach.a1 },
        { code: 'A2', data: approach.a2 },
        { code: 'A3', data: approach.a3 },
        { code: 'A4', data: approach.a4 },
      ],
      'Putting': [
        { code: 'L1-L3', data: putting.lag },
        { code: 'M1', data: putting.m1 },
        { code: 'M2', data: putting.m2 },
      ],
      'Short Game': [
        { code: 'S1', data: shortGame.s1 },
        { code: 'S2', data: shortGame.s2 },
        { code: 'S3', data: shortGame.s3 },
      ],
    };
  };

  const allSegmentDrivers = getAllSegmentDrivers();

  // Render driver card based on driver type
  const renderDriverCard = (driver: { code: string; data: any }) => {
    if (!driver.data) return null;

    const { code, data } = driver;

    // Common card styling
    const cardStyle = {
      borderLeft: `4px solid ${getSeverityColor(data.severity)}`,
      background: 'var(--charcoal)',
      padding: '16px',
      borderRadius: '4px',
      marginBottom: '12px',
    };

    return (
      <div key={code} style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--chalk)', fontWeight: 600, fontSize: '14px' }}>{data.name}</span>
          </div>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            color: getSeverityColor(data.severity),
            background: `${getSeverityColor(data.severity)}20`,
            padding: '4px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase',
          }}>
            {data.severity}
          </span>
        </div>

        {/* Description */}
        <p style={{ color: 'var(--cement)', fontSize: '11px', marginBottom: '12px' }}>
          {data.description}
        </p>

        {/* Driver-specific content */}
        {code.startsWith('D') && renderDrivingDriver(data)}
        {code.startsWith('A') && renderApproachDriver(data)}
        {code === 'L1-L3' && renderLagPuttingDriver(data)}
        {code === 'M1' && renderMakeableDriver(data)}
        {code === 'M2' && renderPrimaryLossDriver(data)}
        {code.startsWith('S') && renderShortGameDriver(data)}
      </div>
    );
  };

  // Driving driver rendering
  const renderDrivingDriver = (data: any) => {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
        <div>
          <span style={{ color: 'var(--ash)' }}>Value: </span>
          <span style={{ color: 'var(--chalk)', fontWeight: 600 }}>
            {typeof data.value === 'number' ? data.value.toFixed(1) : data.fwHitRate?.toFixed(1)}%
          </span>
        </div>
        {data.sgImpact !== undefined && (
          <div>
            <span style={{ color: 'var(--ash)' }}>SG Impact: </span>
            <span style={{ color: data.sgImpact < 0 ? 'var(--scarlet)' : 'var(--under)', fontWeight: 600 }}>
              {data.sgImpact.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Approach driver rendering
  const renderApproachDriver = (data: any) => {
    if (!data.bands || data.bands.length === 0) return null;

    return (
      <div>
        <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--ash)' }}>
              <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>Band</th>
              <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>Shots</th>
              <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>GIR%</th>
              <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>SG</th>
            </tr>
          </thead>
          <tbody>
            {data.bands.filter((b: any) => b.totalShots > 0).map((band: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                <td style={{ padding: '4px', color: 'var(--chalk)' }}>{band.label}</td>
                <td style={{ padding: '4px', textAlign: 'right', color: 'var(--cement)' }}>{band.totalShots}</td>
                <td style={{ padding: '4px', textAlign: 'right', color: 'var(--chalk)' }}>{band.girRate?.toFixed(1)}%</td>
                <td style={{ padding: '4px', textAlign: 'right', color: band.sgTotal < 0 ? 'var(--scarlet)' : 'var(--under)' }}>
                  {band.sgTotal?.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Lag putting driver rendering
  const renderLagPuttingDriver = (data: any) => {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ color: 'var(--ash)' }}>Poor Lag Rate: </span>
          <span style={{ color: 'var(--chalk)', fontWeight: 600 }}>{data.poorLagRate?.toFixed(1)}%</span>
        </div>
        <div>
          <span style={{ color: 'var(--ash)' }}>Dispersion: </span>
          <span style={{ color: 'var(--chalk)', fontWeight: 600 }}>{data.speedDispersionBand?.toFixed(1)}ft</span>
        </div>
        <div>
          <span style={{ color: 'var(--ash)' }}>Centering: </span>
          <span style={{ color: 'var(--chalk)', fontWeight: 600 }}>{data.centeringRate}</span>
        </div>
      </div>
    );
  };

  // Makeable putt driver rendering
  const renderMakeableDriver = (data: any) => {
    if (!data.buckets || data.buckets.length === 0) return null;

    return (
      <div>
        <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--ash)' }}>
              <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>Bucket</th>
              <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>Putts</th>
              <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>Make%</th>
              <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>SG/Put</th>
            </tr>
          </thead>
          <tbody>
            {data.buckets.filter((b: any) => b.totalPutts > 0).map((bucket: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                <td style={{ padding: '4px', color: 'var(--chalk)' }}>{bucket.label}</td>
                <td style={{ padding: '4px', textAlign: 'right', color: 'var(--cement)' }}>{bucket.totalPutts}</td>
                <td style={{ padding: '4px', textAlign: 'right', color: 'var(--chalk)' }}>{bucket.makePct?.toFixed(1)}%</td>
                <td style={{ padding: '4px', textAlign: 'right', color: bucket.avgSG < 0 ? 'var(--scarlet)' : 'var(--under)' }}>
                  {bucket.avgSG?.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Primary loss driver rendering
  const renderPrimaryLossDriver = (data: any) => {
    return (
      <div style={{ fontSize: '11px' }}>
        <span style={{ color: 'var(--ash)' }}>Primary Loss: </span>
        <span style={{ color: 'var(--scarlet)', fontWeight: 600 }}>{data.primaryLossBucket}</span>
        <span style={{ color: 'var(--ash)' }}> ({data.primaryLossSG?.toFixed(2)} SG)</span>
      </div>
    );
  };

  // Short game driver rendering
  const renderShortGameDriver = (data: any) => {
    if (data.lieMetrics) {
      return (
        <div>
          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>Lie</th>
                <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>Shots</th>
                <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>≤8ft</th>
                <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.lieMetrics.filter((m: any) => m.totalShots > 0).map((metric: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                  <td style={{ padding: '4px', color: 'var(--chalk)' }}>{metric.lie}</td>
                  <td style={{ padding: '4px', textAlign: 'right', color: 'var(--cement)' }}>{metric.totalShots}</td>
                  <td style={{ padding: '4px', textAlign: 'right', color: 'var(--chalk)' }}>{metric.inside8Feet}</td>
                  <td style={{ padding: '4px', textAlign: 'right', color: metric.proximityRate < 50 ? 'var(--scarlet)' : 'var(--under)' }}>
                    {metric.proximityRate?.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (data.distanceMetrics) {
      return (
        <div>
          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ash)' }}>
                <th style={{ textAlign: 'left', padding: '4px', color: 'var(--ash)' }}>Distance</th>
                <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>Shots</th>
                <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>≤8ft</th>
                <th style={{ textAlign: 'right', padding: '4px', color: 'var(--ash)' }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.distanceMetrics.filter((m: any) => m.totalShots > 0).map((metric: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--dark)' }}>
                  <td style={{ padding: '4px', color: 'var(--chalk)' }}>{metric.label}</td>
                  <td style={{ padding: '4px', textAlign: 'right', color: 'var(--cement)' }}>{metric.totalShots}</td>
                  <td style={{ padding: '4px', textAlign: 'right', color: 'var(--chalk)' }}>{metric.inside8Feet}</td>
                  <td style={{ padding: '4px', textAlign: 'right', color: metric.proximityRate < 50 ? 'var(--scarlet)' : 'var(--under)' }}>
                    {metric.proximityRate?.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div style={{ fontSize: '11px' }}>
        <span style={{ color: 'var(--ash)' }}>Failure Rate: </span>
        <span style={{ color: data.value > 20 ? 'var(--scarlet)' : 'var(--chalk)', fontWeight: 600 }}>
          {data.value?.toFixed(1)}%
        </span>
        <span style={{ color: 'var(--ash)' }}> ({data.failures}/{data.totalShortGameShots} shots)</span>
      </div>
    );
  };

  // Get severity color
  const getSeverityColorV2 = (severity: string): string => {
    switch (severity) {
      case 'Critical': return 'var(--scarlet)';
      case 'Moderate': return '#CA8A04';
      case 'Monitor': return 'var(--ash)';
      default: return 'var(--ash)';
    }
  };


  const top5Drivers = performanceDriversV2.drivers;

  return (
    <div className="content">
      {/* Section Heading */}
      <h4 style={{ marginBottom: '8px', color: 'var(--ash)' }}>Player Path</h4>
      <p style={{ fontSize: '12px', color: 'var(--ash)', marginBottom: '16px' }}>
        Top 5 Performance Drivers — Ranked by scoring impact with specificity bonuses applied
      </p>

      {/* Top 5 Performance Drivers Hero Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {top5Drivers.length > 0 ? top5Drivers.map((driver) => (
          <div
            key={driver.driverId}
            className="card-hero"
            style={{
              borderLeft: `4px solid ${getSeverityColorV2(driver.severity)}`,
              padding: '16px',
            }}
          >
            {/* Rank Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--chalk)',
                background: 'var(--obsidian)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}>
                #{driver.rank}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: getSeverityColorV2(driver.severity),
                background: `${getSeverityColorV2(driver.severity)}20`,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}>
                {driver.severity}
              </span>
            </div>

            {/* Category */}
            <div style={{ fontSize: '11px', color: 'var(--ash)', marginBottom: '4px' }}>
              {driver.category}
            </div>

            {/* Label */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--chalk)', marginBottom: '12px', lineHeight: 1.3 }}>
              {driver.label}
            </div>

            {/* Impact Score */}
            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--obsidian)' }}>
              <div style={{ fontSize: '10px', color: 'var(--ash)' }}>Impact</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--scarlet)' }}>
                {driver.impactScore.toFixed(2)} strokes/round
              </div>
            </div>

            {/* Cascade Note */}
            {driver.cascadeNote && (
              <div style={{ marginTop: '8px', padding: '6px', background: 'var(--obsidian)', borderRadius: '4px', fontSize: '10px', color: 'var(--cement)', fontStyle: 'italic' }}>
                {driver.cascadeNote}
              </div>
            )}

            {/* Sample Size */}
            <div style={{ marginTop: '8px', fontSize: '9px', color: 'var(--ash)' }}>
              Sample: {driver.sampleSize} shots
            </div>
          </div>
        )) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px', color: 'var(--ash)' }}>
            <p>No significant performance drivers identified.</p>
            <p style={{ fontSize: '11px', marginTop: '8px' }}>Keep tracking your shots to identify patterns.</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: 'var(--charcoal)',
          padding: '12px 16px',
          borderRadius: '4px',
          borderLeft: '3px solid var(--scarlet)',
          flex: 1,
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--scarlet)' }}>{playerPathMetrics.criticalDrivers.length}</div>
          <div style={{ fontSize: '10px', color: 'var(--ash)' }}>Critical Drivers</div>
        </div>
        <div style={{
          background: 'var(--charcoal)',
          padding: '12px 16px',
          borderRadius: '4px',
          borderLeft: '3px solid #EA580C',
          flex: 1,
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#EA580C' }}>{playerPathMetrics.significantDrivers.length}</div>
          <div style={{ fontSize: '10px', color: 'var(--ash)' }}>Significant Drivers</div>
        </div>
        <div style={{
          background: 'var(--charcoal)',
          padding: '12px 16px',
          borderRadius: '4px',
          borderLeft: '3px solid #CA8A04',
          flex: 1,
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#CA8A04' }}>{playerPathMetrics.moderateDrivers.length}</div>
          <div style={{ fontSize: '10px', color: 'var(--ash)' }}>Moderate Drivers</div>
        </div>
        <div style={{
          background: 'var(--charcoal)',
          padding: '12px 16px',
          borderRadius: '4px',
          borderLeft: '3px solid var(--under)',
          flex: 1,
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--under)' }}>{playerPathMetrics.totalRounds}</div>
          <div style={{ fontSize: '10px', color: 'var(--ash)' }}>Rounds Analyzed</div>
        </div>
      </div>




      {/* Segment Sections - Collapsible */}
      {(['Driving', 'Approach', 'Putting', 'Short Game'] as const).map(segment => (
        <div key={segment} style={{ marginBottom: '24px' }}>
          {/* Section Header - Clickable to expand/collapse */}
          <button
            onClick={() => toggleSection(segment)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '12px 16px',
              background: 'var(--charcoal)',
              border: '1px solid var(--ash)',
              borderRadius: '4px',
              color: 'var(--chalk)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <span>{segment}</span>
            <span style={{ fontSize: '12px', color: 'var(--ash)' }}>
              {expandedSections[segment] ? '▲' : '▼'}
            </span>
          </button>

          {/* Driver Cards - Only shown when section is expanded */}
          {expandedSections[segment] && (
            <div style={{ marginTop: '16px' }}>
              {/* Sort drivers by SG lowest to highest */}
              {allSegmentDrivers[segment]
                .slice()
                .sort((a, b) => getDriverSG(a) - getDriverSG(b))
                .map(driver => renderDriverCard(driver))
              }

              {allSegmentDrivers[segment].filter(d => d.data).length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--ash)' }}>
                  <p>No driver data available for this segment.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}