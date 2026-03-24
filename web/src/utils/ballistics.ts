/**
 * Golf ballistics calculations for weather-adjusted yardages.
 * All functions are pure (no side effects, no API calls).
 * Based on the DECADE ballistics model.
 */

// DECADE dispersion lookup: adjusted carry distance → scatter radius in yards
const DECADE_DISP: Record<number, number> = {
  60: 3, 70: 4, 80: 4, 90: 5, 100: 5, 110: 6, 120: 6, 130: 7, 140: 7,
  150: 8, 160: 8, 170: 9, 180: 9, 190: 10, 200: 10, 210: 11, 220: 11,
  230: 12, 240: 12, 250: 13,
};

/** Round a number to the nearest 5. */
export function roundToFive(n: number): number {
  return Math.round(n / 5) * 5;
}

/** Temperature adjustment in yards. Baseline is 70°F. */
export function tempAdjustment(tempF: number): number {
  return (tempF - 70) * 0.075;
}

/** Altitude adjustment in yards. Baseline is home elevation. */
export function altitudeAdjustment(courseAltFt: number, homeAltFt: number, carryYds: number): number {
  return carryYds * ((courseAltFt - homeAltFt) * 0.000083);
}

/** Humidity adjustment in yards. Baseline is 50% RH. */
export function humidityAdjustment(rhPercent: number): number {
  return (rhPercent - 50) * 0.006;
}

/**
 * Wind adjustment in yards.
 * Headwind adds distance needed; tailwind reduces distance needed.
 */
export function windAdjustment(carryYds: number, windMph: number, isHeadwind: boolean): number {
  return isHeadwind
    ? carryYds * (windMph * 0.75 / 100)
    : -(carryYds * (windMph * 0.40 / 100));
}

/**
 * DECADE dispersion radius for a given adjusted carry distance.
 * Rounds to nearest 10 before lookup.
 */
export function decadeDispersion(adjustedYards: number): number {
  const key = Math.round(adjustedYards / 10) * 10;
  return DECADE_DISP[key] ?? (adjustedYards > 250 ? 14 : 2);
}

interface WeatherConditions {
  tempF: number;
  humidity: number;
  altFt: number;
  homeAltFt: number;
}

/**
 * Calculate the weather-adjusted carry distance for a single club.
 */
export function calcAdjustedDistance(stdYards: number, wx: WeatherConditions): number {
  const adj =
    stdYards +
    tempAdjustment(wx.tempF) +
    altitudeAdjustment(wx.altFt, wx.homeAltFt, stdYards) +
    humidityAdjustment(wx.humidity);
  return roundToFive(adj);
}

interface ActiveClub {
  name: string;
  std: number;
  adj: number;
}

interface WindBucket {
  range: string;
  mid: number;
}

/**
 * Build wind table buckets from active (adjusted) clubs.
 * Pairs adjacent clubs (by distance) to create distance ranges.
 */
export function buildWindBuckets(activeClubs: ActiveClub[]): WindBucket[] {
  const buckets: WindBucket[] = [];
  for (let i = 0; i < activeClubs.length; i += 2) {
    const a = activeClubs[i];
    const b = activeClubs[i + 1];
    const hi = roundToFive(a.adj);
    const lo = roundToFive(b ? b.adj : Math.max(a.adj - 15, 0));
    const mid = roundToFive((hi + lo) / 2);
    buckets.push({ range: `${lo}–${hi}`, mid });
  }
  return buckets;
}

/**
 * Pick the closest forecast wind column (5, 10, or 15 mph).
 */
export function closestWindCol(windMph: number): 5 | 10 | 15 {
  const diffs = ([5, 10, 15] as const).map((v) => ({ v, d: Math.abs(windMph - v) }));
  diffs.sort((a, b) => a.d - b.d);
  return diffs[0].v;
}
