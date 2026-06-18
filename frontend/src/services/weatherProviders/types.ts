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
  get(url: string, config?: { params?: Record<string, string> }): Promise<{ data: unknown }>;
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
