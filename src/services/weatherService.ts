import axios from 'axios';

export interface WeatherData {
  temp: number;
  feelsLike: number;
  precipProb: number;
  windSpeed: number;
  windDeg: number;
  condition: string;
}

export interface HttpClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(url: string, config?: { params?: any }): Promise<{ data: any }>;
}

export const fetchWeatherForPoint = async (
  lat: number,
  lon: number,
  timestamp: number,
  http: HttpClient = axios as HttpClient
): Promise<WeatherData> => {
  const date = new Date(timestamp * 1000);
  const hourIso = date.toISOString().slice(0, 14) + '00'; // Round to the hour

  try {
    const response = await http.get(`https://api.open-meteo.com/v1/forecast`, {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code',
        forecast_days: 2,
      }
    });

    const hourly = response.data.hourly;
    const timeIndex = hourly.time.findIndex((t: string) => t === hourIso.slice(0, 16));
    
    if (timeIndex === -1) {
      // Fallback if exact hour not found
      return mockFallback(timestamp);
    }

    return {
      temp: hourly.temperature_2m[timeIndex],
      feelsLike: hourly.apparent_temperature[timeIndex],
      precipProb: hourly.precipitation_probability[timeIndex],
      windSpeed: hourly.wind_speed_10m[timeIndex],
      windDeg: hourly.wind_direction_10m[timeIndex],
      condition: getWeatherCondition(hourly.weather_code[timeIndex]),
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return mockFallback(timestamp);
  }
};

const getWeatherCondition = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code < 4) return 'Partly Cloudy';
  if (code < 70) return 'Rain';
  if (code < 80) return 'Snow';
  return 'Storm';
};

const mockFallback = (timestamp: number): WeatherData => {
  const hour = new Date(timestamp * 1000).getHours();
  return {
    temp: 20 + Math.sin((hour - 6) * Math.PI / 12) * 5,
    feelsLike: 18,
    precipProb: 10,
    windSpeed: 12,
    windDeg: 270,
    condition: 'Sunny (Fallback)',
  };
};
