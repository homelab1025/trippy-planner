import { createOpenMeteoProvider } from './openMeteo';
import { createOpenWeatherMapProvider } from './openWeatherMap';

export { setWeatherDebug } from './openMeteo';
export type { WeatherProvider, WeatherData, WeatherRequest } from './types';

export const openMeteoProvider = createOpenMeteoProvider();
export const openWeatherMapProvider = createOpenWeatherMapProvider();

export const PROVIDERS = [openMeteoProvider, openWeatherMapProvider];
export const DEFAULT_PROVIDER = openMeteoProvider;
