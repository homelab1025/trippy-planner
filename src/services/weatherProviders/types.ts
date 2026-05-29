// src/services/weatherProviders/types.ts

export interface WeatherData {
  temp: number;
  feelsLike: number;
  precipProb: number;
  precipitation: number;
  windSpeed: number;
  windDeg: number;
  condition: string;
}

export interface HttpClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(url: string, config?: { params?: any }): Promise<{ data: any }>;
}

export interface WeatherRequest {
  lat: number;
  lon: number;
  timestamp: number; // Unix seconds
}

export interface WeatherProvider {
  id: string;
  label: string;
  available: boolean;
  fetchWeather: (points: Map<number, WeatherRequest>) => Promise<Map<number, WeatherData | null>>;
}
