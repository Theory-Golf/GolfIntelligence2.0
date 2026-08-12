import {
  MAX_STATE_WORDS,
  stateAbbrFrom,
  stateNameFrom,
} from './usStates';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export interface GeocodeResult {
  lat: number;
  lon: number;
  /** Populated place name, e.g. "Austin". */
  city: string;
  /** Two-letter US state abbreviation when the result is in the US. */
  stateAbbr: string | null;
  /** ISO-3166 alpha-2, upper case, e.g. "US". */
  countryCode: string | null;
  /** ZIP code when the location was resolved from one. */
  postcode: string | null;
  /** Human label for the UI, e.g. "Austin, TX". */
  displayName: string;
}

export interface WeatherResult {
  temp: number;
  windSpeed: number;
  windDirection: string;
  precip: number;
}

interface GeocodeApiResult {
  latitude?: number;
  longitude?: number;
  name?: string;
  admin1?: string;
  admin2?: string;
  country_code?: string;
  population?: number;
  postcodes?: string[];
  feature_code?: string;
}

interface HourlyBlock {
  time?: Array<string | null>;
  temperature_2m?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  wind_direction_10m?: Array<number | null>;
  precipitation?: Array<number | null>;
}

function compassFromDegrees(deg: number): string {
  const idx = ((Math.round(deg / 45) % 8) + 8) % 8;
  return COMPASS[idx];
}

function localTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentTimeHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export { currentTimeHHMM };

// ─── Location input parsing ──────────────────────────────────────────────────

export type ParsedLocation =
  | { kind: 'zip'; zip: string }
  | { kind: 'place'; city: string; stateAbbr: string | null };

const ZIP_RE = /^(\d{5})(?:-\d{4})?$/;

/**
 * Interpret whatever the player typed into the single location field.
 * Accepts a bare ZIP ("78701"), "City, ST", "City ST", "City, State Name",
 * or a bare city ("Austin"). Returns null when there isn't enough to search.
 */
export function parseLocationQuery(raw: string): ParsedLocation | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;

  const zipMatch = ZIP_RE.exec(trimmed);
  if (zipMatch) return { kind: 'zip', zip: zipMatch[1] };

  // A partial ZIP is someone mid-keystroke, not a place called "787".
  if (/^\d+$/.test(trimmed)) return null;

  // "Austin, TX 78701" — a trailing ZIP is the most precise part, use it.
  const trailingZip = /(?:^|[\s,])(\d{5})(?:-\d{4})?$/.exec(trimmed);
  if (trailingZip) return { kind: 'zip', zip: trailingZip[1] };

  const commaIdx = trimmed.indexOf(',');
  if (commaIdx > 0) {
    const city = trimmed.slice(0, commaIdx).trim();
    const rest = trimmed.slice(commaIdx + 1).trim();
    if (city.length < 2) return null;
    return { kind: 'place', city, stateAbbr: stateAbbrFrom(rest) };
  }

  // No comma: peel a trailing state off the end if the words spell one.
  const words = trimmed.split(' ');
  for (let take = Math.min(MAX_STATE_WORDS, words.length - 1); take >= 1; take--) {
    const candidate = words.slice(words.length - take).join(' ');
    const abbr = stateAbbrFrom(candidate);
    if (abbr) {
      const city = words.slice(0, words.length - take).join(' ');
      if (city.length >= 2) return { kind: 'place', city, stateAbbr: abbr };
    }
  }

  // Without a state to disambiguate, wait for three characters — that's also
  // where the gazetteer switches from exact to fuzzy matching.
  if (trimmed.length < 3) return null;
  return { kind: 'place', city: trimmed, stateAbbr: null };
}

// ─── Geocoding ───────────────────────────────────────────────────────────────

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

function labelFor(
  city: string,
  stateAbbr: string | null,
  countryCode: string | null,
  postcode: string | null,
): string {
  const region = stateAbbr ?? (countryCode && countryCode !== 'US' ? countryCode : null);
  const base = region ? `${city}, ${region}` : city;
  // Skip the ZIP when the gazetteer already named the place after it.
  return postcode && postcode !== city ? `${base} ${postcode}` : base;
}

function toResult(r: GeocodeApiResult, postcode: string | null): GeocodeResult | null {
  if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return null;
  const city = r.name?.trim() || '';
  if (!city) return null;
  const countryCode = r.country_code ? r.country_code.toUpperCase() : null;
  const stateAbbr = countryCode === 'US' ? stateAbbrFrom(r.admin1) : null;
  return {
    lat: r.latitude,
    lon: r.longitude,
    city,
    stateAbbr,
    countryCode,
    postcode,
    displayName: labelFor(city, stateAbbr, countryCode, postcode),
  };
}

async function searchOpenMeteo(
  name: string,
  count: number,
  signal?: AbortSignal,
): Promise<GeocodeApiResult[]> {
  const url =
    `${GEOCODE_URL}?name=${encodeURIComponent(name)}` +
    `&count=${count}&language=en&format=json`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: GeocodeApiResult[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

function dedupe(results: GeocodeResult[]): GeocodeResult[] {
  const seen = new Set<string>();
  const out: GeocodeResult[] = [];
  for (const r of results) {
    const key = `${r.lat.toFixed(2)}|${r.lon.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Rank so the obvious answer lands first: matching state beats everything,
 * then an exact name match, then US over foreign, then population.
 */
function rankPlaces(
  raw: GeocodeApiResult[],
  city: string,
  wantedState: string | null,
): GeocodeResult[] {
  const wantedCity = city.toLowerCase();
  const scored = raw
    .map((r) => {
      const result = toResult(r, null);
      if (!result) return null;
      let score = 0;
      if (wantedState && result.stateAbbr === wantedState) score += 1000;
      if (result.city.toLowerCase() === wantedCity) score += 100;
      if (result.countryCode === 'US') score += 50;
      score += Math.min(40, Math.log10((r.population ?? 0) + 1) * 8);
      return { result, score };
    })
    .filter((x): x is { result: GeocodeResult; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  const ordered = dedupe(scored.map((s) => s.result));

  // With an explicit state, only show that state — anything else is noise.
  if (wantedState) {
    const inState = ordered.filter((r) => r.stateAbbr === wantedState);
    if (inState.length > 0) return inState;
  }
  return ordered;
}

interface ZippopotamPlace {
  'place name'?: string;
  state?: string;
  'state abbreviation'?: string;
  latitude?: string;
  longitude?: string;
}

/**
 * ZIP fallback. Open-Meteo indexes many postal codes but not reliably all of
 * them; zippopotam.us is a free, key-less, CORS-enabled ZIP gazetteer.
 */
async function zipFallback(
  zip: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { places?: ZippopotamPlace[] };
    const place = json.places?.[0];
    if (!place) return [];
    const lat = Number(place.latitude);
    const lon = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const city = place['place name']?.trim() || zip;
    const stateAbbr =
      stateAbbrFrom(place['state abbreviation']) ?? stateAbbrFrom(place.state);
    return [
      {
        lat,
        lon,
        city,
        stateAbbr,
        countryCode: 'US',
        postcode: zip,
        displayName: labelFor(city, stateAbbr, 'US', zip),
      },
    ];
  } catch {
    return [];
  }
}

async function geocodeZip(
  zip: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const raw = await searchOpenMeteo(zip, 5, signal);
  const matches = raw
    .filter((r) => (r.country_code ?? '').toUpperCase() === 'US')
    .map((r) => toResult(r, zip))
    .filter((r): r is GeocodeResult => r !== null)
    // A hit named after the ZIP itself carries no city for the round record;
    // the postal gazetteer below gives a real place name instead.
    .filter((r) => !/^\d+$/.test(r.city));
  if (matches.length > 0) return dedupe(matches).slice(0, 1);
  return zipFallback(zip, signal);
}

/**
 * Resolve a free-text location to candidate coordinates, best match first.
 * Returns at most five candidates so the UI can offer alternates when a city
 * name is ambiguous ("Springfield").
 */
export async function resolveLocation(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const parsed = parseLocationQuery(query);
  if (!parsed) return [];

  if (parsed.kind === 'zip') return geocodeZip(parsed.zip, signal);

  const raw = await searchOpenMeteo(parsed.city, 10, signal);
  const ranked = rankPlaces(raw, parsed.city, parsed.stateAbbr);
  if (ranked.length > 0) return ranked.slice(0, 5);

  // Some gazetteer entries only match on the full "City State" string.
  if (parsed.stateAbbr) {
    const stateName = stateNameFrom(parsed.stateAbbr);
    const retry = await searchOpenMeteo(
      `${parsed.city} ${stateName ?? parsed.stateAbbr}`,
      10,
      signal,
    );
    return rankPlaces(retry, parsed.city, parsed.stateAbbr).slice(0, 5);
  }
  return [];
}

// ─── Weather ─────────────────────────────────────────────────────────────────

function pickHourlyIndex(times: Array<string | null>, date: string, teeTime: string): number {
  const hour = teeTime.slice(0, 2);
  const target = `${date}T${hour}:00`;
  const idx = times.findIndex((t) => t && t.startsWith(target));
  return idx >= 0 ? idx : 0;
}

function extractHourly(hourly: HourlyBlock, idx: number): WeatherResult | null {
  const temp = hourly.temperature_2m?.[idx];
  const wind = hourly.wind_speed_10m?.[idx];
  const dir = hourly.wind_direction_10m?.[idx];
  const precip = hourly.precipitation?.[idx];
  if (
    typeof temp !== 'number' ||
    typeof wind !== 'number' ||
    typeof dir !== 'number' ||
    typeof precip !== 'number'
  ) {
    return null;
  }
  return {
    temp,
    windSpeed: wind,
    windDirection: compassFromDegrees(dir),
    precip,
  };
}

export async function fetchWeather(
  lat: number,
  lon: number,
  date: string,
  teeTime?: string,
  signal?: AbortSignal,
): Promise<WeatherResult | null> {
  const today = localTodayIso();
  const time = teeTime ?? currentTimeHHMM();
  const hourlyParams =
    'hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph' +
    '&precipitation_unit=inch&timezone=auto';

  try {
    const base =
      date >= today
        ? 'https://api.open-meteo.com/v1/forecast'
        : 'https://archive-api.open-meteo.com/v1/archive';
    const url =
      `${base}?latitude=${lat}&longitude=${lon}` +
      `&${hourlyParams}` +
      `&start_date=${date}&end_date=${date}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { hourly?: HourlyBlock };
    const hourly = json.hourly;
    if (!hourly?.time) return null;
    const idx = pickHourlyIndex(hourly.time, date, time);
    return extractHourly(hourly, idx);
  } catch {
    return null;
  }
}
