import axios from 'axios';
import type { WeatherData, WeatherRequest, WeatherProvider, HttpClient } from './types';

let _debug = false;
export const setWeatherDebug = (enabled: boolean) => { _debug = enabled; };

const getWeatherCondition = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code < 4) return 'Partly Cloudy';
  if (code < 70) return 'Rain';
  if (code < 80) return 'Snow';
  return 'Storm';
};

const fetchOne = async (
  key: number,
  { lat, lon, timestamp }: WeatherRequest,
  http: HttpClient,
): Promise<[number, WeatherData | null]> => {
  const date = new Date(timestamp * 1000);
  const hourIso = date.toISOString().slice(0, 14) + '00';
  const dateStr = date.toISOString().slice(0, 10);

  try {
    const response = await http.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,weather_code',
        start_date: dateStr,
        end_date: dateStr,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hourly = (response.data as any).hourly;
    const timeIndex = hourly.time.findIndex((t: string) => t === hourIso.slice(0, 16));
    if (timeIndex === -1) return [key, null];

    if (_debug) {
      console.log('[weather:open-meteo]', {
        key, lat, lon,
        date: dateStr,
        hour: hourIso.slice(0, 16),
        timeIndex,
        temp: hourly.temperature_2m[timeIndex],
        precipProb: hourly.precipitation_probability[timeIndex],
      });
    }

    return [key, {
      temp: hourly.temperature_2m[timeIndex],
      feelsLike: hourly.apparent_temperature[timeIndex],
      precipProb: hourly.precipitation_probability[timeIndex],
      precipitation: hourly.precipitation[timeIndex],
      windSpeed: hourly.wind_speed_10m[timeIndex],
      windDeg: hourly.wind_direction_10m[timeIndex],
      condition: getWeatherCondition(hourly.weather_code[timeIndex]),
    }];
  } catch {
    return [key, null];
  }
};

export const createOpenMeteoProvider = (http: HttpClient = axios as HttpClient): WeatherProvider => ({
  id: 'open-meteo',
  label: 'Open-Meteo',
  fetchWeather: async (points) => {
    const entries = await Promise.all(
      Array.from(points.entries()).map(([key, req]) => fetchOne(key, req, http))
    );
    return new Map(entries);
  },
});
