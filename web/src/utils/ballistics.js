/**
 * Golf ballistics calculations for weather-adjusted yardages.
 * All functions are pure (no side effects, no API calls).
 * Based on the DECADE ballistics model.
 */

// DECADE dispersion lookup: adjusted carry distance → scatter radius in yards
const DECADE_DISP = {
  60: 3, 70: 4, 80: 4, 90: 5, 100: 5, 110: 6, 120: 6, 130: 7, 140: 7,
  150: 8, 160: 8, 170: 9, 180: 9, 190: 10, 200: 10, 210: 11, 220: 11,
  230: 12, 240: 12, 250: 13,
};

/** Round a number to the nearest 5. */
export function roundToFive(n) {
  return Math.round(n / 5) * 5;
}

/** Temperature adjustment in yards. Baseline is 70°F. */
export function tempAdjustment(tempF) {
  return (tempF - 70) * 0.075;
}

/** Altitude adjustment in yards. Baseline is home elevation. */
export function altitudeAdjustment(courseAltFt, homeAltFt, carryYds) {
  return carryYds * ((courseAltFt - homeAltFt) * 0.000083);
}

/** Humidity adjustment in yards. Baseline is 50% RH. */
export function humidityAdjustment(rhPercent) {
  return (rhPercent - 50) * 0.006;
}

/**
 * Wind adjustment in yards.
 * Headwind adds distance needed; tailwind reduces distance needed.
 */
export function windAdjustment(carryYds, windMph, isHeadwind) {
  return isHeadwind
    ? carryYds * (windMph * 0.75 / 100)
    : -(carryYds * (windMph * 0.40 / 100));
}

/**
 * DECADE dispersion radius for a given adjusted carry distance.
 * Rounds to nearest 10 before lookup.
 */
export function decadeDispersion(adjustedYards) {
  const key = Math.round(adjustedYards / 10) * 10;
  return DECADE_DISP[key] ?? (adjustedYards > 250 ? 14 : 2);
}

/**
 * Calculate the weather-adjusted carry distance for a single club.
 * @param {number} stdYards - Standard carry at 70°F, sea level, 50% RH, no wind
 * @param {object} wx - Weather object: { tempF, humidity, altFt, homeAltFt }
 * @returns {number} Adjusted carry rounded to nearest 5 yards
 */
export function calcAdjustedDistance(stdYards, wx) {
  const adj =
    stdYards +
    tempAdjustment(wx.tempF) +
    altitudeAdjustment(wx.altFt, wx.homeAltFt, stdYards) +
    humidityAdjustment(wx.humidity);
  return roundToFive(adj);
}

/**
 * Build wind table buckets from active (adjusted) clubs.
 * Pairs adjacent clubs (by distance) to create distance ranges.
 * @param {Array<{name: string, std: number, adj: number}>} activeClubs - sorted by adj desc
 * @returns {Array<{range: string, mid: number}>}
 */
export function buildWindBuckets(activeClubs) {
  const buckets = [];
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
 * @param {number} windMph
 * @returns {5 | 10 | 15}
 */
export function closestWindCol(windMph) {
  const diffs = [5, 10, 15].map((v) => ({ v, d: Math.abs(windMph - v) }));
  diffs.sort((a, b) => a.d - b.d);
  return diffs[0].v;
}
