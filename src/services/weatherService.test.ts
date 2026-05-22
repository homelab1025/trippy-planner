import { describe, it, expect, vi } from 'vitest';
import { fetchWeatherForPoint } from './weatherService';
import type { HttpClient } from './weatherService';

// 2025-06-15T14:37:00 UTC — mid-hour so slice(0,14) rounding is exercised; slot is '2025-06-15T14:00'
const TS = new Date('2025-06-15T14:37:00.000Z').getTime() / 1000;

const makeStub = (weatherCode: number): HttpClient => ({
  get: vi.fn().mockResolvedValue({
    data: {
      hourly: {
        time: ['2025-06-15T14:00'],
        temperature_2m: [22],
        apparent_temperature: [20],
        precipitation_probability: [15],
        wind_speed_10m: [12],
        wind_direction_10m: [270],
        weather_code: [weatherCode],
      },
    },
  }),
});

const missingHourStub: HttpClient = {
  get: vi.fn().mockResolvedValue({
    data: {
      hourly: {
        time: ['2025-06-15T12:00'], // different hour — timeIndex will be -1
        temperature_2m: [20],
        apparent_temperature: [18],
        precipitation_probability: [0],
        wind_speed_10m: [5],
        wind_direction_10m: [180],
        weather_code: [0],
      },
    },
  }),
};

const throwingStub: HttpClient = {
  get: vi.fn().mockRejectedValue(new Error('network error')),
};

describe('fetchWeatherForPoint', () => {
  it('maps a valid API response to all WeatherData fields', async () => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, makeStub(0));
    expect(result.temp).toBe(22);
    expect(result.feelsLike).toBe(20);
    expect(result.precipProb).toBe(15);
    expect(result.windSpeed).toBe(12);
    expect(result.windDeg).toBe(270);
    expect(result.condition).toBe('Clear');
  });

  it('returns fallback when the target hour is absent from the response', async () => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, missingHourStub);
    expect(result.condition).toContain('Fallback');
  });

  it('returns fallback when the HTTP call throws', async () => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, throwingStub);
    expect(result.condition).toContain('Fallback');
  });

  it.each([
    [0,  'Clear'],
    [2,  'Partly Cloudy'],
    [50, 'Rain'],
    [75, 'Snow'],
    [95, 'Storm'],
  ])('weather code %i → condition "%s"', async (code, expected) => {
    const result = await fetchWeatherForPoint(48.8, 2.3, TS, makeStub(code));
    expect(result.condition).toBe(expected);
  });
});
