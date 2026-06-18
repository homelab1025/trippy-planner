import { createOpenMeteoProvider } from './openMeteo';
import { selfHostedProvider } from './selfHosted';

export { setWeatherDebug } from './openMeteo';
export type { WeatherProvider, WeatherData, WeatherRequest } from './types';

export const openMeteoProvider = createOpenMeteoProvider();

export const PROVIDERS = [openMeteoProvider, selfHostedProvider];
export const DEFAULT_PROVIDER = openMeteoProvider;
