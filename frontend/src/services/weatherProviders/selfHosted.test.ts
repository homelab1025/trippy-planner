import { describe, it, expect } from 'vitest';
import { selfHostedProvider } from './selfHosted';

describe('selfHostedProvider', () => {
  it('is marked as unavailable', () => {
    expect(selfHostedProvider.available).toBe(false);
  });

  it('has the correct id and label', () => {
    expect(selfHostedProvider.id).toBe('self-hosted');
    expect(selfHostedProvider.label).toBe('Trippy Weather (coming soon)');
  });

  it('fetchWeather returns an empty map regardless of input', async () => {
    const input = new Map([[0, { lat: 48.8, lon: 2.3, timestamp: 1234567890 }]]);
    const result = await selfHostedProvider.fetchWeather(input);
    expect(result.size).toBe(0);
  });
});
