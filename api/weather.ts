import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecurityHeaders, checkRateLimitSync, handleOptions } from './_security';

// Open-Meteo API — 100% free, no key, proper weather JSON
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

// Common Indian cities with pre-set coordinates (fallback)
const KNOWN_CITIES: Record<string, { lat: number; lon: number; name: string }> = {
  'patna': { lat: 25.61, lon: 85.14, name: 'Patna' },
  'delhi': { lat: 28.61, lon: 77.21, name: 'Delhi' },
  'mumbai': { lat: 19.08, lon: 72.88, name: 'Mumbai' },
  'bangalore': { lat: 12.97, lon: 77.59, name: 'Bangalore' },
  'kolkata': { lat: 22.57, lon: 88.36, name: 'Kolkata' },
  'chennai': { lat: 13.08, lon: 80.27, name: 'Chennai' },
  'hyderabad': { lat: 17.39, lon: 78.49, name: 'Hyderabad' },
  'pune': { lat: 18.52, lon: 73.86, name: 'Pune' },
  'jaipur': { lat: 26.91, lon: 75.79, name: 'Jaipur' },
  'lucknow': { lat: 26.85, lon: 80.95, name: 'Lucknow' },
  'bhopal': { lat: 23.26, lon: 77.41, name: 'Bhopal' },
  'ranchi': { lat: 23.34, lon: 85.31, name: 'Ranchi' },
  'gaya': { lat: 24.79, lon: 84.99, name: 'Gaya' },
  'bihar sharif': { lat: 25.38, lon: 85.52, name: 'Bihar Sharif' },
  'paliganj': { lat: 25.37, lon: 85.06, name: 'Paliganj' },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await checkRateLimitSync(req, res, 'weather', 30)) return;

  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.length > 200) return res.status(400).json({ error: 'Query required (max 200 chars)' });

  try {
    // Extract city name from query
    const city = extractCity(query);
    const location = await resolveCity(city);

    if (!location) {
      return res.status(200).json({
        weather: null,
        text: `शहर "${city}" नहीं मिला। कृपया शहर का नाम बताएं।`,
      });
    }

    // Fetch weather
    const weatherRes = await fetch(
      `${WEATHER_URL}?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=1`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!weatherRes.ok) {
      return res.status(200).json({ weather: null, text: `मौसम डाटा उपलब्ध नहीं हो सका।` });
    }

    const data = await weatherRes.json();
    const current = data.current;
    const daily = data.daily;

    const weatherDesc = getWeatherDescription(current?.weather_code);
    const temp = current?.temperature_2m;
    const feelsLike = current?.apparent_temperature;
    const humidity = current?.relative_humidity_2m;
    const wind = current?.wind_speed_10m;
    const maxTemp = daily?.temperature_2m_max?.[0];
    const minTemp = daily?.temperature_2m_min?.[0];

    // Build text in Hindi if query is Hindi
    const isHindi = /[\u0900-\u097F]/.test(query);

    const text = isHindi
      ? `📍 ${location.name}\n🌡️ तापमान: ${temp}°C (महसूस ${feelsLike}°C)\n🌤️ मौसम: ${weatherDesc.hi}\n💧 आर्द्रता: ${humidity}%\n💨 हवा: ${wind} km/h\n📊 आज: न्यूनतम ${minTemp}°C / अधिकतम ${maxTemp}°C`
      : `📍 ${location.name}\n🌡️ Temperature: ${temp}°C (feels like ${feelsLike}°C)\n🌤️ Condition: ${weatherDesc.en}\n💧 Humidity: ${humidity}%\n💨 Wind: ${wind} km/h\n📊 Today: Low ${minTemp}°C / High ${maxTemp}°C`;

    return res.status(200).json({
      weather: { temp, feelsLike, humidity, wind, weatherCode: current?.weather_code, maxTemp, minTemp },
      location: location.name,
      text,
    });
  } catch (error: any) {
    return res.status(200).json({ weather: null, text: `मौसम जानकारी नहीं मिली।` });
  }
}

function extractCity(query: string): string {
  // Remove common words
  const cleaned = query
    .replace(/आज|कल|aaj|today|weather|मौसम|mausam|temperature|तापमान|का|की|में|कैसा|है|how|what|is|the|of|in|current|अभी|abhi/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Check known cities first
  for (const city of Object.keys(KNOWN_CITIES)) {
    if (query.toLowerCase().includes(city)) return city;
  }

  // Return whatever's left
  return cleaned || query;
}

async function resolveCity(city: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const lower = city.toLowerCase().trim();

  // Check known cities
  if (KNOWN_CITIES[lower]) return KNOWN_CITIES[lower];

  // Geocode via Open-Meteo
  try {
    const res = await fetch(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length > 0) {
        const r = data.results[0];
        return { lat: r.latitude, lon: r.longitude, name: r.name };
      }
    }
  } catch {}

  return null;
}

function getWeatherDescription(code: number): { en: string; hi: string } {
  const map: Record<number, { en: string; hi: string }> = {
    0: { en: 'Clear sky', hi: 'साफ आसमान' },
    1: { en: 'Mainly clear', hi: 'ज्यादातर साफ' },
    2: { en: 'Partly cloudy', hi: 'आंशिक बादल' },
    3: { en: 'Overcast', hi: 'बादली' },
    45: { en: 'Foggy', hi: 'कोहरा' },
    48: { en: 'Depositing rime fog', hi: 'कोहरा' },
    51: { en: 'Light drizzle', hi: 'हल्की बूंदाबांदी' },
    53: { en: 'Moderate drizzle', hi: 'बूंदाबांदी' },
    55: { en: 'Dense drizzle', hi: 'भारी बूंदाबांदी' },
    61: { en: 'Slight rain', hi: 'हल्की बारिश' },
    63: { en: 'Moderate rain', hi: 'बारिश' },
    65: { en: 'Heavy rain', hi: 'भारी बारिश' },
    71: { en: 'Slight snowfall', hi: 'हल्की बर्फबारी' },
    73: { en: 'Moderate snowfall', hi: 'बर्फबारी' },
    75: { en: 'Heavy snowfall', hi: 'भारी बर्फबारी' },
    80: { en: 'Slight rain showers', hi: 'हल्की बारिश' },
    81: { en: 'Moderate rain showers', hi: 'बारिश' },
    82: { en: 'Violent rain showers', hi: 'तेज बारिश' },
    95: { en: 'Thunderstorm', hi: 'आंधी-तूफान' },
    96: { en: 'Thunderstorm with slight hail', hi: 'आंधी हिमपात' },
    99: { en: 'Thunderstorm with heavy hail', hi: 'भारी आंधी हिमपात' },
  };
  return map[code] || { en: 'Partly cloudy', hi: 'आंशिक बादली' };
}
