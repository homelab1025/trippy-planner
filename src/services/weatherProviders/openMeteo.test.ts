import { describe, it, expect, vi } from 'vitest';
import { createOpenMeteoProvider } from './openMeteo';
import type { HttpClient } from './types';

// 2025-06-15T14:37:00 UTC — same fixture as legacy weatherService tests
const TS = new Date('2025-06-15T14:37:00.000Z').getTime() / 1000;

const makeStub = (weatherCode: number): HttpClient => ({
  get: vi.fn().mockResolvedValue({
    data: {
      hourly: {
        time: ['2025-06-15T14:00'],
        temperature_2m: [22],
        apparent_temperature: [20],
        precipitation_probability: [15],
        precipitation: [2.5],
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
        time: ['2025-06-15T12:00'],
        temperature_2m: [20],
        apparent_temperature: [18],
        precipitation_probability: [0],
        precipitation: [0],
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

describe('openMeteoProvider.fetchWeather', () => {
  it('maps a valid API response to all WeatherData fields', async () => {
    const provider = createOpenMeteoProvider(makeStub(0));
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    const weather = result.get(0);
    expect(weather).not.toBeNull();
    expect(weather!.temp).toBe(22);
    expect(weather!.feelsLike).toBe(20);
    expect(weather!.precipProb).toBe(15);
    expect(weather!.precipitation).toBe(2.5);
    expect(weather!.windSpeed).toBe(12);
    expect(weather!.windDeg).toBe(270);
    expect(weather!.condition).toBe('Clear');
  });

  it('returns null at the key when the target hour is absent', async () => {
    const provider = createOpenMeteoProvider(missingHourStub);
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)).toBeNull();
  });

  it('returns null at the key when the HTTP call throws', async () => {
    const provider = createOpenMeteoProvider(throwingStub);
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)).toBeNull();
  });

  it('preserves arbitrary input keys in the output map', async () => {
    const provider = createOpenMeteoProvider(makeStub(0));
    const input = new Map([
      [5,  { lat: 48.8, lon: 2.3, timestamp: TS }],
      [11, { lat: 49.0, lon: 2.5, timestamp: TS }],
    ]);
    const result = await provider.fetchWeather(input);
    expect(result.has(5)).toBe(true);
    expect(result.has(11)).toBe(true);
  });

  it.each([
    [0,  'Clear'],
    [2,  'Partly Cloudy'],
    [50, 'Rain'],
    [75, 'Snow'],
    [95, 'Storm'],
  ])('weather code %i → condition "%s"', async (code, expected) => {
    const provider = createOpenMeteoProvider(makeStub(code));
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)!.condition).toBe(expected);
  });
});
