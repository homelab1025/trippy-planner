import axios from 'axios';
import type { WeatherData, WeatherRequest, WeatherProvider, HttpClient } from './types';
import { OPENWEATHERMAP_API_KEY } from '../../config/weatherProviderKeys';

interface OWMEntry {
  dt: number;
  main: { temp: number; feels_like: number };
  weather: [{ main: string }];
  wind: { speed: number; deg: number };
  pop: number;
  rain?: { '3h': number };
  snow?: { '3h': number };
}

const getCondition = (main: string): string => {
  if (main === 'Clear') return 'Clear';
  if (main === 'Clouds') return 'Partly Cloudy';
  if (main === 'Rain' || main === 'Drizzle') return 'Rain';
  if (main === 'Snow') return 'Snow';
  return 'Storm';
};

const fetchOne = async (
  key: number,
  { lat, lon, timestamp }: WeatherRequest,
  http: HttpClient,
): Promise<[number, WeatherData | null]> => {
  try {
    const response = await http.get('https://api.openweathermap.org/data/2.5/forecast', {
      params: { lat, lon, appid: OPENWEATHERMAP_API_KEY, units: 'metric' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: OWMEntry[] = (response.data as any).list;
    if (!list?.length) return [key, null];

    const entry = list.reduce((best, curr) =>
      Math.abs(curr.dt - timestamp) < Math.abs(best.dt - timestamp) ? curr : best
    );

    return [key, {
      temp: entry.main.temp,
      feelsLike: entry.main.feels_like,
      precipProb: Math.round(entry.pop * 100),
      precipitation: entry.rain?.['3h'] ?? entry.snow?.['3h'] ?? 0,
      windSpeed: entry.wind.speed * 3.6,
      windDeg: entry.wind.deg,
      condition: getCondition(entry.weather[0].main),
    }];
  } catch {
    return [key, null];
  }
};

export const createOpenWeatherMapProvider = (http: HttpClient = axios as HttpClient): WeatherProvider => ({
  id: 'openweathermap',
  label: 'OpenWeatherMap',
  available: true,
  fetchWeather: async (points) => {
    const entries = await Promise.all(
      Array.from(points.entries()).map(([key, req]) => fetchOne(key, req, http))
    );
    return new Map(entries);
  },
});
