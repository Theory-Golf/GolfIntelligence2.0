const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export interface GeocodeResult {
  lat: number;
  lon: number;
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
  country_code?: string;
}

interface ForecastCurrent {
  temperature_2m?: number | null;
  wind_speed_10m?: number | null;
  wind_direction_10m?: number | null;
  precipitation?: number | null;
}

interface ArchiveDaily {
  temperature_2m_max?: Array<number | null>;
  wind_speed_10m_max?: Array<number | null>;
  wind_direction_10m_dominant?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
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

export async function geocodeLocation(
  query: string,
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(trimmed)}` +
    '&count=1&language=en&format=json';
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: GeocodeApiResult[] };
    const first = json.results?.[0];
    if (
      !first ||
      typeof first.latitude !== 'number' ||
      typeof first.longitude !== 'number'
    ) {
      return null;
    }
    const parts: string[] = [];
    if (first.name) parts.push(first.name);
    if (first.admin1) parts.push(first.admin1);
    else if (first.country_code) parts.push(first.country_code);
    return {
      lat: first.latitude,
      lon: first.longitude,
      displayName: parts.join(', '),
    };
  } catch {
    return null;
  }
}

export async function fetchWeather(
  lat: number,
  lon: number,
  date: string,
): Promise<WeatherResult | null> {
  const isToday = date === localTodayIso();
  try {
    if (isToday) {
      const url =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${lat}&longitude=${lon}` +
        '&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation' +
        '&temperature_unit=fahrenheit&wind_speed_unit=mph' +
        '&precipitation_unit=inch&timezone=auto';
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as { current?: ForecastCurrent };
      const c = json.current;
      if (
        !c ||
        typeof c.temperature_2m !== 'number' ||
        typeof c.wind_speed_10m !== 'number' ||
        typeof c.wind_direction_10m !== 'number' ||
        typeof c.precipitation !== 'number'
      ) {
        return null;
      }
      return {
        temp: c.temperature_2m,
        windSpeed: c.wind_speed_10m,
        windDirection: compassFromDegrees(c.wind_direction_10m),
        precip: c.precipitation,
      };
    }

    const url =
      'https://archive-api.open-meteo.com/v1/archive' +
      `?latitude=${lat}&longitude=${lon}` +
      `&start_date=${date}&end_date=${date}` +
      '&daily=temperature_2m_max,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_sum' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph' +
      '&precipitation_unit=inch&timezone=auto';
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { daily?: ArchiveDaily };
    const d = json.daily;
    const temp = d?.temperature_2m_max?.[0];
    const wind = d?.wind_speed_10m_max?.[0];
    const dir = d?.wind_direction_10m_dominant?.[0];
    const precip = d?.precipitation_sum?.[0];
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
  } catch {
    return null;
  }
}
