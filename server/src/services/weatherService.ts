import { IWeatherSnapshot } from '../models/Schedule.js';

interface CacheEntry {
  data: IWeatherSnapshot;
  expiresAt: number;
}

const weatherCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

export interface GeocodingResult {
  city: string;
  country: string;
  lat: number;
  lon: number;
}

/**
 * Open-Meteo Geocoding search
 */
export async function searchCities(query: string): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query.trim()
    )}&count=6&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
    const data = (await res.json()) as any;
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((item: any) => ({
      city: item.name,
      country: item.country || item.admin1 || '',
      lat: Number(item.latitude.toFixed(4)),
      lon: Number(item.longitude.toFixed(4)),
    }));
  } catch (err) {
    console.error('[WeatherService] Geocoding search failed:', err);
    return [];
  }
}

/**
 * Weather Adapter interface
 */
export interface IWeatherProvider {
  fetchForecast(lat: number, lon: number): Promise<IWeatherSnapshot>;
}

/**
 * Open-Meteo provider (free, no API key required)
 */
export class OpenMeteoProvider implements IWeatherProvider {
  async fetchForecast(lat: number, lon: number): Promise<IWeatherSnapshot> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=2`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo responded with status ${res.status}`);
    }

    const data = (await res.json()) as any;
    const current = data.current || {};
    const daily = data.daily || {};

    const temp = current.temperature_2m ?? 20;
    const tempMax = daily.temperature_2m_max?.[0] ?? temp + 3;
    const tempMin = daily.temperature_2m_min?.[0] ?? temp - 3;
    const humidity = current.relative_humidity_2m ?? 50;
    const rainMm = (daily.precipitation_sum?.[0] ?? current.precipitation ?? 0);
    const rainProb = daily.precipitation_probability_max?.[0] ?? 0;
    const windSpeed = current.wind_speed_10m ?? 0;
    const uvIndex = daily.uv_index_max?.[0] ?? 3;

    // Map WMO weather codes to human descriptions
    const code = current.weather_code ?? 0;
    let condition = 'Clear sky';
    if (code >= 1 && code <= 3) condition = 'Partly cloudy';
    else if (code >= 45 && code <= 48) condition = 'Foggy';
    else if (code >= 51 && code <= 55) condition = 'Drizzle';
    else if (code >= 61 && code <= 65) condition = 'Rain';
    else if (code >= 71 && code <= 77) condition = 'Snow';
    else if (code >= 80 && code <= 82) condition = 'Rain showers';
    else if (code >= 95) condition = 'Thunderstorm';

    return {
      temp: Number(temp.toFixed(1)),
      tempMax: Number(tempMax.toFixed(1)),
      tempMin: Number(tempMin.toFixed(1)),
      humidity: Math.round(humidity),
      rainMm: Number(rainMm.toFixed(1)),
      rainProb: Math.round(rainProb),
      windSpeed: Number(windSpeed.toFixed(1)),
      uvIndex: Number(uvIndex.toFixed(1)),
      conditionDescription: condition,
      source: 'Open-Meteo',
      fetchedAt: new Date(),
    };
  }
}

/**
 * OpenWeatherMap provider adapter (for when key is provided)
 */
export class OpenWeatherMapProvider implements IWeatherProvider {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchForecast(lat: number, lon: number): Promise<IWeatherSnapshot> {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenWeatherMap error ${res.status}`);
    const data = (await res.json()) as any;

    const temp = data.main?.temp ?? 20;
    const humidity = data.main?.humidity ?? 50;
    const rainMm = data.rain?.['1h'] ? data.rain['1h'] * 4 : 0;
    const windSpeed = data.wind?.speed ?? 0;
    const condition = data.weather?.[0]?.description ?? 'Clear';

    return {
      temp: Number(temp.toFixed(1)),
      tempMax: Number((data.main?.temp_max ?? temp + 2).toFixed(1)),
      tempMin: Number((data.main?.temp_min ?? temp - 2).toFixed(1)),
      humidity: Math.round(humidity),
      rainMm: Number(rainMm.toFixed(1)),
      rainProb: rainMm > 0 ? 80 : 0,
      windSpeed: Number(windSpeed.toFixed(1)),
      uvIndex: 4,
      conditionDescription: condition,
      source: 'OpenWeatherMap',
      fetchedAt: new Date(),
    };
  }
}

/**
 * Master Weather Service with caching & fallback
 */
export async function getWeatherForecast(
  lat: number,
  lon: number,
  providerOverride?: string
): Promise<{ snapshot: IWeatherSnapshot; isFallback: boolean }> {
  const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const now = Date.now();

  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return { snapshot: cached.data, isFallback: false };
  }

  let provider: IWeatherProvider;
  const configuredProvider = providerOverride || process.env.WEATHER_PROVIDER || 'open-meteo';

  if (configuredProvider === 'openweathermap' && process.env.OPENWEATHERMAP_API_KEY) {
    provider = new OpenWeatherMapProvider(process.env.OPENWEATHERMAP_API_KEY);
  } else {
    provider = new OpenMeteoProvider();
  }

  try {
    const snapshot = await provider.fetchForecast(lat, lon);
    weatherCache.set(cacheKey, {
      data: snapshot,
      expiresAt: now + CACHE_TTL_MS,
    });
    return { snapshot, isFallback: false };
  } catch (err) {
    console.warn(`[WeatherService] Provider failed for lat=${lat}, lon=${lon}: ${(err as Error).message}. Using fallback standard snapshot.`);
    
    // Return standard seasonal fallback snapshot
    const fallbackSnapshot: IWeatherSnapshot = {
      temp: 21,
      tempMax: 24,
      tempMin: 18,
      humidity: 50,
      rainMm: 0,
      rainProb: 0,
      windSpeed: 5,
      uvIndex: 3,
      conditionDescription: 'Weather service offline (fallback data used)',
      source: 'Fallback System',
      fetchedAt: new Date(),
    };

    return { snapshot: fallbackSnapshot, isFallback: true };
  }
}
