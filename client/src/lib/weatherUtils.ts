// Weather code mapping based on Open-Meteo API
// https://open-meteo.com/en/docs

export interface WeatherInfo {
  description: string;
  icon: string;
  color: string;
}

export function getWeatherInfo(weatherCode: number): WeatherInfo {
  switch (weatherCode) {
    case 0:
      return {
        description: "Cerah",
        icon: "sun",
        color: "text-yellow-400"
      };
    case 1:
    case 2:
      return {
        description: "Cerah Berawan",
        icon: "cloud-sun",
        color: "text-yellow-300"
      };
    case 3:
      return {
        description: "Berawan",
        icon: "cloud",
        color: "text-gray-400"
      };
    case 45:
    case 48:
      return {
        description: "Berkabut",
        icon: "cloud-fog",
        color: "text-gray-500"
      };
    case 51:
    case 53:
    case 55:
      return {
        description: "Gerimis",
        icon: "cloud-drizzle",
        color: "text-blue-400"
      };
    case 61:
    case 63:
    case 65:
      return {
        description: "Hujan",
        icon: "cloud-rain",
        color: "text-blue-500"
      };
    case 71:
    case 73:
    case 75:
    case 77:
      return {
        description: "Salju",
        icon: "snowflake",
        color: "text-cyan-300"
      };
    case 80:
    case 81:
    case 82:
      return {
        description: "Hujan Lebat",
        icon: "cloud-rain-wind",
        color: "text-blue-600"
      };
    case 85:
    case 86:
      return {
        description: "Salju Ringan",
        icon: "cloud-snow",
        color: "text-cyan-400"
      };
    case 95:
      return {
        description: "Petir",
        icon: "cloud-lightning",
        color: "text-purple-500"
      };
    case 96:
    case 99:
      return {
        description: "Petir & Hujan Es",
        icon: "cloud-hail",
        color: "text-purple-600"
      };
    default:
      return {
        description: "Tidak Diketahui",
        icon: "help-circle",
        color: "text-gray-400"
      };
  }
}

export function formatTemperature(temp: number): string {
  return `${Math.round(temp)}°C`;
}

export function getWindDirection(degrees: number): string {
  const directions = [
    "Utara", "Timur Laut", "Timur", "Tenggara",
    "Selatan", "Barat Daya", "Barat", "Barat Laut"
  ];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}
