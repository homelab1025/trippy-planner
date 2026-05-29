import type { WeatherProvider } from './types';

export const selfHostedProvider: WeatherProvider = {
  id: 'self-hosted',
  label: 'Trippy Weather (coming soon)',
  available: false,
  fetchWeather: async (_points) => new Map(),
};
