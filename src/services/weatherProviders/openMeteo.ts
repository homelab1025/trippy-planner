import axios from 'axios';
import type { WeatherData, WeatherProvider, HttpClient } from './types';

let _debug = false;
export const setWeatherDebug = (enabled: boolean) => { _debug = enabled; };

const getWeatherCondition = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code < 4) return 'Partly Cloudy';
  if (code < 70) return 'Rain';
  if (code < 80) return 'Snow';
  return 'Storm';
};

export const createOpenMeteoProvider = (http: HttpClient = axios as HttpClient): WeatherProvider => ({
  id: 'open-meteo',
  label: 'Open-Meteo',
  available: true,
  fetchWeather: async (points) => {
    if (points.size === 0) return new Map();

    const entries = Array.from(points.entries());

    const timestamps = entries.map(([, r]) => r.timestamp);
    const startDate = new Date(Math.min(...timestamps) * 1000).toISOString().slice(0, 10);
    const endDate = new Date(Math.max(...timestamps) * 1000).toISOString().slice(0, 10);

    try {
      const response = await http.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: entries.map(([, r]) => r.lat).join(','),
          longitude: entries.map(([, r]) => r.lon).join(','),
          hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,weather_code',
          start_date: startDate,
          end_date: endDate,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = response.data as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const locationData: any[] = Array.isArray(raw) ? raw : [raw];

      const result = new Map<number, WeatherData | null>();

      for (let i = 0; i < entries.length; i++) {
        const [key, req] = entries[i];
        const hourly = locationData[i]?.hourly;

        if (!hourly) {
          result.set(key, null);
          continue;
        }

        const hourIso = new Date(req.timestamp * 1000).toISOString().slice(0, 14) + '00';
        const timeIndex = hourly.time.findIndex((t: string) => t === hourIso);

        if (timeIndex === -1) {
          result.set(key, null);
          continue;
        }

        if (_debug) {
          console.log('[weather:open-meteo]', {
            key, lat: req.lat, lon: req.lon,
            date: hourIso.slice(0, 10),
            hour: hourIso,
            timeIndex,
            temp: hourly.temperature_2m[timeIndex],
            precipProb: hourly.precipitation_probability[timeIndex],
          });
        }

        result.set(key, {
          temp: hourly.temperature_2m[timeIndex],
          feelsLike: hourly.apparent_temperature[timeIndex],
          precipProb: hourly.precipitation_probability[timeIndex],
          precipitation: hourly.precipitation[timeIndex],
          windSpeed: hourly.wind_speed_10m[timeIndex],
          windDeg: hourly.wind_direction_10m[timeIndex],
          condition: getWeatherCondition(hourly.weather_code[timeIndex]),
        });
      }

      return result;
    } catch {
      return new Map(entries.map(([key]) => [key, null]));
    }
  },
});
