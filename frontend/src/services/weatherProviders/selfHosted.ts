import type { WeatherProvider } from './types';

export const selfHostedProvider: WeatherProvider = {
  id: 'self-hosted',
  label: 'Trippy Weather (coming soon)',
  available: false,
  fetchWeather: async () => new Map(),
};
