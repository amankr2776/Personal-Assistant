import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are JARVIS, a personal AI assistant.

ABSOLUTE RULES — NEVER VIOLATE:
1. Answer ONLY what is asked. No extras, no suggestions, no follow-ups.
2. SHORT and DIRECT. No "Sure!", "Here's...", "Let me help", "I can suggest", "You can check". BANNED PHRASES.
3. NEVER say "I don't have access to real-time information" or "I'm not set up to provide" or "check this website". If search/weather data is provided below, USE IT directly. If no data, just say "माफ करें, अभी जानकारी नहीं मिली" or "Sorry, couldn't find that right now."
4. LANGUAGE: Hindi question → Hindi answer. English → English. Mixed → dominant language.
5. Yes/no → just yes/no (हाँ/नहीं).
6. Math → just the answer.
7. Code → just the code, no explanation unless asked.
8. If weather data is provided, describe it naturally. If search results provided, answer from them directly with source attribution.`;

// Detect what kind of live data the query needs
function detectQueryType(message: string): 'weather' | 'sports' | 'news' | 'prices' | 'none' {
  const weatherWords = /weather|mausam|मौसम|temperature|तापमान|barish|बारिश|garmi|गर्मी|sardi|सर्दी|baarish|बारिश/i;
  const sportsWords = /score|match|run|wicket|goal|won|lost|playing|innings|century|virat|kohli|rohit|dhoni|bumrah|pant|gill|hardik|jadeja|ipl|cricket|football|world.cup|t20|odi|euro|olympics|batting|bowling/i;
  const newsWords = /news|khabar|खबर|updates?|breaking|latest|kya.hua|क्या.हुआ|kya.chal|क्या.चल/i;
  const priceWords = /price|rate|stock|share|market|bitcoin|crypto|nifty|sensex|gold|petrol|diesel|bazaar|दर|भाव/i;

  if (weatherWords.test(message)) return 'weather';
  if (sportsWords.test(message)) return 'sports';
  if (priceWords.test(message)) return 'prices';
  if (newsWords.test(message)) return 'news';

  // Time words suggest current info needed
  const timeWords = /\b(aaj|आज|kal|कल|abhi|अभी|today|yesterday|tomorrow|this.week|current|recent)\b/i;
  if (timeWords.test(message)) return 'news';

  return 'none';
}

// Fetch weather data via Open-Meteo (free, no key)
async function fetchWeather(query: string): Promise<string | null> {
  const KNOWN: Record<string, [number, number, string]> = {
    'patna': [25.61, 85.14, 'Patna'], 'delhi': [28.61, 77.21, 'Delhi'],
    'mumbai': [19.08, 72.88, 'Mumbai'], 'bangalore': [12.97, 77.59, 'Bangalore'],
    'kolkata': [22.57, 88.36, 'Kolkata'], 'chennai': [13.08, 80.27, 'Chennai'],
    'hyderabad': [17.39, 78.49, 'Hyderabad'], 'pune': [18.52, 73.86, 'Pune'],
    'jaipur': [26.91, 75.79, 'Jaipur'], 'lucknow': [26.85, 80.95, 'Lucknow'],
    'ranchi': [23.34, 85.31, 'Ranchi'], 'gaya': [24.79, 84.99, 'Gaya'],
    'bihar sharif': [25.38, 85.52, 'Bihar Sharif'], 'paliganj': [25.37, 85.06, 'Paliganj'],
    'bhopal': [23.26, 77.41, 'Bhopal'], 'ahmedabad': [23.02, 72.57, 'Ahmedabad'],
    'chandigarh': [30.74, 76.74, 'Chandigarh'], 'dehradun': [30.32, 78.03, 'Dehradun'],
    'varanasi': [25.32, 83.01, 'Varanasi'], 'allahabad': [25.43, 81.85, 'Prayagraj'],
  };

  let lat: number, lon: number, name: string;

  // Find city
  let found = false;
  for (const [city, coords] of Object.entries(KNOWN)) {
    if (query.toLowerCase().includes(city)) {
      [lat, lon, name] = coords;
      found = true;
      break;
    }
  }

  if (!found) {
    // Try geocoding
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`, { signal: AbortSignal.timeout(4000) });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.results?.[0]) {
          lat = geoData.results[0].latitude;
          lon = geoData.results[0].longitude;
          name = geoData.results[0].name;
          found = true;
        }
      }
    } catch {}
  }

  if (!found) return null;

  try {
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!wRes.ok) return null;
    const d = await wRes.json();
    const c = d.current;
    const day = d.daily;
    return `WEATHER DATA for ${name}: Temperature: ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C), Humidity: ${c.relative_humidity_2m}%, Wind: ${c.wind_speed_10m} km/h, Weather code: ${c.weather_code}, Today's High: ${day.temperature_2m_max?.[0]}°C, Low: ${day.temperature_2m_min?.[0]}°C. Answer using this real data directly.`;
  } catch { return null; }
}

// Web search via DuckDuckGo
async function webSearch(query: string): Promise<string | null> {
  try {
    // Try DDG Instant Answer API
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      const parts: string[] = [];
      if (data.Abstract) parts.push(data.Abstract);
      if (data.RelatedTopics) {
        for (const t of data.RelatedTopics.slice(0, 4)) {
          if (t.Text) parts.push(t.Text);
        }
      }
      if (data.Results) {
        for (const r of data.Results.slice(0, 4)) {
          if (r.Text) parts.push(r.Text);
        }
      }
      if (parts.length > 0) return `WEB SEARCH RESULTS for "${query}":\n${parts.join('\n')}`;
    }
  } catch {}

  // Fallback: Wikipedia
  try {
    const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(4000) });
    if (wikiRes.ok) {
      const wd = await wikiRes.json();
      if (wd.extract) return `WIKIPEDIA: ${wd.extract}`;
    }
  } catch {}

  return null;
}

// Sports-specific search (try ESPN Cricinfo RSS + general search)
async function sportsSearch(query: string): Promise<string | null> {
  const queries = [query, `${query} live score today`, `${query} latest result 2025 2026`, `cricket ${query} today`];
  for (const q of queries) {
    try {
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&noCJ=1&no_html=1`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const parts: string[] = [];
        if (data.Abstract) parts.push(data.Abstract);
        for (const t of (data.RelatedTopics || []).slice(0, 6)) { if (t.Text) parts.push(t.Text); }
        for (const r of (data.Results || []).slice(0, 6)) { if (r.Text) parts.push(r.Text); }
        if (parts.length > 1) return `SPORTS DATA:\n${parts.join('\n')}`;
      }
    } catch {}
  }
  return webSearch(query);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, model, memories, context, stream, temperature, max_tokens } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  // Build system prompt
  const systemParts = [SYSTEM_PROMPT];

  // Inject user memories
  if (memories?.length) {
    systemParts.push(`\nUser's personal info (always use when relevant):\n${memories.map((m: string) => `- ${m}`).join('\n')}`);
  }

  // Inject document context
  if (context?.length) {
    systemParts.push(`\nDocument context:\n${context.join('\n')}`);
  }

  // AUTO-DETECT query type and fetch live data
  const queryType = detectQueryType(message);

  if (queryType === 'weather') {
    const weatherData = await fetchWeather(message);
    if (weatherData) systemParts.push(`\n${weatherData}`);
    else {
      // Try weather search as fallback
      const searchData = await webSearch(`weather ${message} today`);
      if (searchData) systemParts.push(`\n${searchData}`);
    }
  } else if (queryType === 'sports') {
    const sportsData = await sportsSearch(message);
    if (sportsData) systemParts.push(`\n${sportsData}`);
  } else if (queryType === 'news' || queryType === 'prices') {
    const searchData = await webSearch(message);
    if (searchData) systemParts.push(`\n${searchData}`);
  }

  const messages = [
    { role: 'system', content: systemParts.join('\n') },
    { role: 'user', content: message },
  ];

  const groqModel = model || 'llama-3.1-8b-instant';

  if (stream) {
    try {
      const groqRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ model: groqModel, messages, temperature: temperature ?? 0.7, max_tokens: max_tokens ?? 2048, stream: true }),
      });
      if (!groqRes.ok) { const err = await groqRes.text(); return res.status(groqRes.status).json({ error: err.slice(0, 300) }); }
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const reader = groqRes.body?.getReader();
      if (!reader) return res.status(500).json({ error: 'No reader' });
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { res.write('data: [DONE]\n\n'); continue; }
          try { const parsed = JSON.parse(data); const c = parsed.choices?.[0]?.delta?.content || ''; if (c) res.write(`data: ${JSON.stringify({ content: c })}\n\n`); } catch {}
        }
      }
      res.end();
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ content: `⚠️ Error: ${error.message}`, error: true })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
    return;
  }

  // Non-streaming
  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: groqModel, messages, temperature: temperature ?? 0.7, max_tokens: max_tokens ?? 2048 }),
    });
    if (!groqRes.ok) { const err = await groqRes.text(); return res.status(groqRes.status).json({ error: err.slice(0, 300) }); }
    const data = await groqRes.json();
    return res.status(200).json({ content: data.choices?.[0]?.message?.content || '' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
