/**
 * Weather and geocoding API helpers.
 * Uses Nominatim (OpenStreetMap) for ZIP→coordinates
 * and Open-Meteo for weather forecasts and elevation.
 * Both APIs are free with no API key required.
 */

/**
 * Convert wind direction in degrees to compass abbreviation.
 * @param {number} deg - 0–360°
 * @returns {string} e.g. 'N', 'NE', 'ESE'
 */
export function degToCompass(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
}

/**
 * Geocode a US ZIP code to latitude/longitude using Nominatim.
 * @param {string} zip - 5-digit US ZIP code
 * @returns {Promise<{lat: number, lng: number, name: string}>}
 */
export async function zipToLatLng(zip) {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'theory.golf/1.0' },
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  if (!data.length) throw new Error(`ZIP code ${zip} not found`);
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    name: data[0].display_name.split(',')[0],
  };
}

/**
 * Get elevation in feet at a lat/lng using Open-Meteo.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<number>} Elevation in feet
 */
export async function getElevation(lat, lng) {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Elevation fetch failed (${res.status})`);
  const data = await res.json();
  const meters = Array.isArray(data.elevation) ? data.elevation[0] : data.elevation;
  return Math.round(meters * 3.28084);
}

/**
 * Get hourly weather forecast from Open-Meteo at a specific date/hour.
 * @param {number} lat
 * @param {number} lng
 * @param {string} date - 'YYYY-MM-DD'
 * @param {number} hour - 0–23
 * @returns {Promise<{tempF: number, humidity: number, windMph: number, windDeg: number}>}
 */
export async function getWeatherAtTime(lat, lng, date, hour) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,winddirection_10m` +
    `&temperature_unit=fahrenheit` +
    `&windspeed_unit=mph` +
    `&start_date=${date}&end_date=${date}` +
    `&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  const data = await res.json();

  const h = data.hourly;
  const idx = Math.min(hour, h.time.length - 1);

  return {
    tempF: Math.round(h.temperature_2m[idx]),
    humidity: Math.round(h.relativehumidity_2m[idx]),
    windMph: Math.round(h.windspeed_10m[idx]),
    windDeg: Math.round(h.winddirection_10m[idx]),
  };
}

/**
 * Orchestrate all weather data fetches for a round.
 * @param {string} courseZip
 * @param {string} homeZip - optional; defaults to courseZip if empty
 * @param {string} date - 'YYYY-MM-DD'
 * @param {string} teeTime - 'HH:MM'
 * @returns {Promise<{
 *   tempF: number, humidity: number, windMph: number, windDeg: number,
 *   windDirText: string, altFt: number, homeAltFt: number, windColMph: number,
 *   courseName: string
 * }>}
 */
export async function fetchAllWeatherData(courseZip, homeZip, date, teeTime) {
  const hour = parseInt(teeTime.split(':')[0], 10);

  // Course location
  const course = await zipToLatLng(courseZip);

  // Home location (for altitude delta); fall back to course if blank
  const effectiveHomeZip = homeZip.trim() || courseZip;
  const home = effectiveHomeZip === courseZip ? course : await zipToLatLng(effectiveHomeZip);

  // Fetch elevation and weather in parallel
  const [courseAlt, homeAlt, weather] = await Promise.all([
    getElevation(course.lat, course.lng),
    home === course ? Promise.resolve(null) : getElevation(home.lat, home.lng),
    getWeatherAtTime(course.lat, course.lng, date, hour),
  ]);

  const homeAltFt = homeAlt ?? courseAlt;

  // Nearest standard wind column (5, 10, or 15 mph)
  const diffs = [5, 10, 15].map((v) => ({ v, d: Math.abs(weather.windMph - v) }));
  diffs.sort((a, b) => a.d - b.d);
  const windColMph = diffs[0].v;

  return {
    ...weather,
    windDirText: degToCompass(weather.windDeg),
    altFt: courseAlt,
    homeAltFt,
    windColMph,
    courseName: course.name,
  };
}
