import { describe, it, expect, vi } from 'vitest';
import { createOpenWeatherMapProvider } from './openWeatherMap';
import type { HttpClient } from './types';

const TS = new Date('2025-06-15T14:37:00.000Z').getTime() / 1000;

// wind.speed 3.33 m/s × 3.6 ≈ 12 km/h; pop 0.15 → precipProb 15
const makeStub = (weatherMain: string, extras: Record<string, unknown> = {}): HttpClient => ({
  get: vi.fn().mockResolvedValue({
    data: {
      list: [{
        dt: TS,
        main: { temp: 22, feels_like: 20 },
        weather: [{ main: weatherMain }],
        wind: { speed: 3.33, deg: 270 },
        pop: 0.15,
        ...extras,
      }],
    },
  }),
});

const emptyListStub: HttpClient = {
  get: vi.fn().mockResolvedValue({ data: { list: [] } }),
};

const throwingStub: HttpClient = {
  get: vi.fn().mockRejectedValue(new Error('network error')),
};

describe('openWeatherMapProvider.fetchWeather', () => {
  it('maps a valid API response to all WeatherData fields', async () => {
    const provider = createOpenWeatherMapProvider(makeStub('Clear', { rain: { '3h': 2.5 } }));
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    const weather = result.get(0);
    expect(weather).not.toBeNull();
    expect(weather!.temp).toBe(22);
    expect(weather!.feelsLike).toBe(20);
    expect(weather!.precipProb).toBe(15);
    expect(weather!.precipitation).toBe(2.5);
    expect(weather!.windSpeed).toBeCloseTo(3.33 * 3.6, 1);
    expect(weather!.windDeg).toBe(270);
    expect(weather!.condition).toBe('Clear');
  });

  it('converts wind speed from m/s to km/h', async () => {
    const provider = createOpenWeatherMapProvider(makeStub('Clear'));
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)!.windSpeed).toBeCloseTo(3.33 * 3.6, 1);
  });

  it('converts pop 0-1 to precipProb 0-100', async () => {
    const provider = createOpenWeatherMapProvider(makeStub('Clear'));
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)!.precipProb).toBe(15);
  });

  it('defaults precipitation to 0 when rain and snow fields are absent', async () => {
    const provider = createOpenWeatherMapProvider(makeStub('Clear'));
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)!.precipitation).toBe(0);
  });

  it('uses snow precipitation when rain field is absent', async () => {
    const provider = createOpenWeatherMapProvider(makeStub('Snow', { snow: { '3h': 1.2 } }));
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)!.precipitation).toBe(1.2);
  });

  it('returns null at the key when the list is empty', async () => {
    const provider = createOpenWeatherMapProvider(emptyListStub);
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)).toBeNull();
  });

  it('returns null at the key when the HTTP call throws', async () => {
    const provider = createOpenWeatherMapProvider(throwingStub);
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)).toBeNull();
  });

  it('preserves arbitrary input keys in the output map', async () => {
    const provider = createOpenWeatherMapProvider(makeStub('Clear'));
    const input = new Map([
      [5,  { lat: 48.8, lon: 2.3, timestamp: TS }],
      [11, { lat: 49.0, lon: 2.5, timestamp: TS }],
    ]);
    const result = await provider.fetchWeather(input);
    expect(result.has(5)).toBe(true);
    expect(result.has(11)).toBe(true);
  });

  it('picks the closest 3h slot when multiple list entries are present', async () => {
    // TS is 14:37 UTC; slot at 15:00 is 23 min away, slot at 12:00 is 157 min away
    const closerTs = TS + 23 * 60;   // 15:00
    const fartherTs = TS - 157 * 60; // 12:00
    const http: HttpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          list: [
            { dt: fartherTs, main: { temp: 10, feels_like: 8 }, weather: [{ main: 'Clouds' }], wind: { speed: 1, deg: 0 }, pop: 0 },
            { dt: closerTs,  main: { temp: 22, feels_like: 20 }, weather: [{ main: 'Clear' }],  wind: { speed: 3, deg: 90 }, pop: 0 },
          ],
        },
      }),
    };
    const provider = createOpenWeatherMapProvider(http);
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)!.temp).toBe(22);
    expect(result.get(0)!.condition).toBe('Clear');
  });

  it.each([
    ['Clear',        'Clear'],
    ['Clouds',       'Partly Cloudy'],
    ['Rain',         'Rain'],
    ['Drizzle',      'Rain'],
    ['Snow',         'Snow'],
    ['Thunderstorm', 'Storm'],
  ])('OWM category "%s" → condition "%s"', async (owmMain, expected) => {
    const provider = createOpenWeatherMapProvider(makeStub(owmMain));
    const result = await provider.fetchWeather(
      new Map([[0, { lat: 48.8, lon: 2.3, timestamp: TS }]])
    );
    expect(result.get(0)!.condition).toBe(expected);
  });
});
