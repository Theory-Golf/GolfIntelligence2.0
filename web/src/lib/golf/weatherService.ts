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
  teeTime?: string,
): Promise<WeatherResult | null> {
  const today = localTodayIso();
  const time = teeTime ?? currentTimeHHMM();
  const hourlyParams =
    'hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph' +
    '&precipitation_unit=inch&timezone=auto';

  try {
    if (date >= today) {
      const url =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${lat}&longitude=${lon}` +
        `&${hourlyParams}` +
        `&start_date=${date}&end_date=${date}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as { hourly?: HourlyBlock };
      const hourly = json.hourly;
      if (!hourly?.time) return null;
      const idx = pickHourlyIndex(hourly.time, date, time);
      return extractHourly(hourly, idx);
    }

    const url =
      'https://archive-api.open-meteo.com/v1/archive' +
      `?latitude=${lat}&longitude=${lon}` +
      `&start_date=${date}&end_date=${date}` +
      `&${hourlyParams}`;
    const res = await fetch(url);
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

