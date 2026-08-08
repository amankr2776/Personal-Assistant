import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecurityHeaders, checkRateLimitSync, handleOptions, getClientIP } from './_security';

// ========== SECURITY ==========
// Input sanitization
function sanitize(str: string, maxLen: number): string {
  return str.slice(0, maxLen).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' }[c] || c));
}

function isValidMessage(msg: unknown): msg is string {
  return typeof msg === 'string' && msg.trim().length > 0 && msg.length <= 5000;
}

// ========== CONFIG ==========
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];

if (!GEMINI_KEY && !GROQ_KEY) {
  console.error('⚠️ No API keys configured. Set GEMINI_API_KEY or GROQ_API_KEY.');
}

const SYSTEM_PROMPT = `You are Aira, a warm, intelligent, and caring personal AI assistant for Aman Kumar. You are female — a girl assistant. You speak with a friendly, supportive, and feminine tone. You are like a trusted companion who genuinely cares about Aman.

PERSONALITY:
- You are Aira (not JARVIS). You are a girl/woman AI assistant.
- Use warm, caring, feminine language. Be supportive and encouraging.
- In English: use natural feminine speech patterns ("I'd love to help!", "Sure dear", "Here you go", "Don't worry, I've got you")
- In Hindi: use feminine forms (मैं कर दूंगी, मुझे खुशी होगी, चिंता मत करो, मैं हूँ ना)
- Be sweet but professional. Concise for simple queries, detailed when needed.
- NEVER refer to yourself as male or use "bro/bhai/brother". You are a female assistant.

RULES:
1. Answer what is asked — be thorough when needed, concise for simple queries.
2. NEVER say "I don't have access to real-time information" or "I'm not set up to provide" or "check this website". If real-time data is provided below in SEARCH/WIKI/WEATHER sections, USE IT directly. If no external data, answer from your knowledge.
3. LANGUAGE (CRITICAL — STRICT): You MUST reply ONLY in English or Hindi (Devanagari script). NEVER use Bengali, Marathi, Tamil, Telugu, Kannada, Malayalam, Urdu, Gujarati, Punjabi, Sanskrit, Odia, Assamese, Nepali, or ANY other language. If the user writes in Hindi (Devanagari script), reply in Hindi (Devanagari script). If the user writes in English, reply in English. If mixed, reply in the dominant language. If unsure, reply in English.
4. Coding: provide complete, working code with brief comments.
5. Math: show the answer.
6. For advice/analysis/PPT/notes: be detailed and structured.
7. If search data is provided, answer from it directly — do NOT ignore it and do NOT give outdated info when fresh data is right there.
8. Today's date is ${new Date().toISOString().split('T')[0]}. We are in ${new Date().getFullYear()}. Never say we are in 2024.

MEMORY RULES (CRITICAL):
9. CONVERSATION MEMORY: You receive the full conversation history. Use it! When the user refers to "that", "it", "the code", "we discussed" etc., ALWAYS look at conversation history to understand context. Never ask "what do you mean?" if the answer is in the history.
10. The user's name is Aman Kumar. He is from Bihar, India.
    GitHub: https://github.com/amankr2776 — Repos: Agri-Wise, ShieldCore, ai-coding-mentor (TypeScript)
    LinkedIn: https://linkedin.com/in/amankr2776
    When user asks about GitHub/repos/code → provide info AND say "Opening your GitHub profile..." (the app will auto-open the link).
    When user asks about LinkedIn → say "Opening your LinkedIn profile..." (the app will auto-open the link).
11. PERSONAL MEMORY: If "User info" section is provided below, you MUST use it proactively. For example:
    - If you know his city → use it for weather/location queries without asking
    - If you know his exam date → remind him or reference it naturally
    - If you know his college/subject → personalize your answers
    - If you know his preferences → match them
    NEVER ignore the User info section. It is FACT about the user. Use it whenever relevant.
12. When the user shares personal information (name, location, preferences, dates, contacts, health, work, education, goals), acknowledge it naturally in your response — this signals it's been noted.

NEVER DISCLOSE MEMORY SOURCE (CRITICAL):
13. When answering questions using information from "User info" or memories, NEVER reveal where you got the information. Do NOT say any of these phrases or similar:
    - "you told me" / "you mentioned" / "you said earlier" / "as you told me"
    - "from your saved memory" / "from memory" / "according to your memory" / "stored in memory"
    - "I remember you said" / "as per our previous conversation" / "you previously mentioned"
    - "your saved information" / "your profile says" / "your memory indicates"
    Just answer naturally and directly as if you always knew it. The user should feel like you genuinely know them, not like you're reading from a database.

MANDATORY AUTO-SAVE (CRITICAL):
14. When the user mentions ANY personal fact that seems important/mandatory, you must signal it naturally in your response so it gets auto-saved. These include:
    - Name, age, birthday, location (city/village/state/country)
    - Education: school, college, university, class, semester, branch, roll number, exam dates
    - Projects: project name, technology, deadline, team, status
    - Work: company, role, salary, interview dates
    - Health: conditions, medications, doctor appointments
    - Family: names, relationships, events
    - Finance: bank, account, income, expenses, goals
    - Preferences: favorite anything, dislikes, habits
    - Goals, plans, deadlines, important dates
    - Contact info: phone, email, social media
    When the user shares such info, respond naturally and briefly acknowledge it (e.g., "Got it", "Noted", or just weave it into your answer). Do NOT explicitly say "I'll save this to memory" — just answer naturally.`;

// ========== QUERY CLASSIFICATION ==========
function classifyQuery(message: string): { needsSearch: boolean; isWeather: boolean } {
  const m = message.toLowerCase();
  const isWeather = /weather|mausam|मौसम|temperature|तापमान|barish|बारिश|garmi|गर्मी|sardi|सर्दी|baarish/i.test(m);

  // Pure math
  if (/^[\d\s+\-*/().^%]+$/.test(m.trim())) return { needsSearch: false, isWeather };
  // Pure coding (no year/latest/current)
  if (/(write|create|build|implement|code|program|function|script|class)\s/i.test(m) && !/\b(202[4-9]|latest|current|newest|recent|today)\b/i.test(m)) return { needsSearch: false, isWeather };
  // "How to" tutorials
  if (/^how\s+to\s/i.test(m) && !/\b(202[4-9]|latest|current|today)\b/i.test(m)) return { needsSearch: false, isWeather };
  // Advice/personal
  if (/(how\s+to\s+deal|how\s+to\s+handle|how\s+to\s+cope|how\s+to\s+overcome|how\s+to\s+improve|advice|tips\s+for)/i.test(m) && !/\b(202[4-9]|latest|current)\b/i.test(m)) return { needsSearch: false, isWeather };
  // Greetings
  if (/^(hello|hi|hey|namaste|नमस्ते|good\s+morning|good\s+evening|good\s+night|thanks|thank\s+you|bye|goodbye|yes|no|ok|okay|sure|हाँ|नहीं)/i.test(m.trim())) return { needsSearch: false, isWeather };

  // Years → search
  if (/\b(202[4-9]|203[0-9])\b/.test(m)) return { needsSearch: true, isWeather };
  // Time words → search
  if (/\b(today|yesterday|tomorrow|this\s+week|this\s+month|this\s+year|current|recent|latest|now|right\s+now|upcoming|next|scheduled|future|abhi|अभी|aaj|आज|kal|कल)\b/i.test(m)) return { needsSearch: true, isWeather };
  // Sports → search
  if (/\b(score|match|run|wicket|goal|won|lost|playing|innings|century|virat|kohli|rohit|dhoni|bumrah|pant|gill|hardik|jadeja|ipl|cricket|football|world\s+cup|t20|odi|euro|olympics|batting|bowling|schedule|fixture|tournament|winner|champion|championship|trophy|final)\b/i.test(m)) return { needsSearch: true, isWeather };
  // Prices → search
  if (/\b(price|rate|stock|share|market|bitcoin|crypto|nifty|sensex|gold\s+price|petrol|diesel|bazaar|दर|भाव)\b/i.test(m)) return { needsSearch: true, isWeather };
  // News → search
  if (/\b(news|khabar|खबर|updates?|breaking|kya\s+hua|क्या\s+हुआ|kya\s+chal|क्या\s+चल)\b/i.test(m)) return { needsSearch: true, isWeather };
  // Factual questions → search
  if (/\b(who|what|where|when|which|how\s+many|how\s+much|how\s+old)\b/i.test(m)) return { needsSearch: true, isWeather };

  return { needsSearch: false, isWeather };
}

// ========== WEATHER ==========
async function fetchWeather(query: string, clientLat?: number, clientLon?: number): Promise<string | null> {
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
  let lat: number, lon: number, name: string; let found = false;
  for (const [city, coords] of Object.entries(KNOWN)) { if (query.toLowerCase().includes(city)) { [lat, lon, name] = coords; found = true; break; } }
  if (!found && clientLat !== undefined && clientLon !== undefined) {
    // Use client Geolocation — find nearest known city
    let minDist = Infinity;
    for (const [city, coords] of Object.entries(KNOWN)) {
      const [clat, clon, cname] = coords;
      const dist = Math.sqrt((clat - clientLat) ** 2 + (clon - clientLon) ** 2);
      if (dist < minDist) { minDist = dist; lat = clat; lon = clon; name = cname; found = true; }
    }
    // If nearest city is >1 degree away, use raw coords
    if (found && minDist > 1) { lat = clientLat; lon = clientLon; name = `${clientLat.toFixed(2)}°N, ${clientLon.toFixed(2)}°E`; }
  }
  if (!found) {
    try { const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.slice(0, 60))}&count=1`, { signal: AbortSignal.timeout(4000) }); if (r.ok) { const d = await r.json(); if (d.results?.[0]) { lat = d.results[0].latitude; lon = d.results[0].longitude; name = d.results[0].name; found = true; } } } catch {}
  }
  if (!found) return null;
  try {
    const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`, { signal: AbortSignal.timeout(6000) });
    if (!wRes.ok) return null;
    const d = await wRes.json(); const c = d.current; const day = d.daily;
    return `WEATHER for ${name}: ${c.temperature_2m}°C (feels ${c.apparent_temperature}°C), Humidity: ${c.relative_humidity_2m}%, Wind: ${c.wind_speed_10m} km/h, Code: ${c.weather_code}, High: ${day.temperature_2m_max?.[0]}°C, Low: ${day.temperature_2m_min?.[0]}°C.`;
  } catch { return null; }
}

// ========== WIKIPEDIA SEARCH ==========
async function wikiSearch(query: string): Promise<string | null> {
  let searchTerms = [query.slice(0, 100)];
  const q = query.toLowerCase();
  const yearMatch = q.match(/(20\d{2})/);
  const year = yearMatch ? yearMatch[1] : '';
  if (/\bipl\b/.test(q)) searchTerms = year ? [`${year} Indian Premier League`, `IPL ${year}`] : [`IPL ${new Date().getFullYear()}`];
  if (/\bcricket\s+world\s+cup\b/.test(q)) searchTerms = year ? [`${year} ICC Men's Cricket World Cup`] : ['Cricket World Cup'];
  if (/\bchampions\s+trophy\b/.test(q)) searchTerms = year ? [`${year} ICC Champions Trophy`] : ['ICC Champions Trophy'];
  if (/\bt20\s+world\s+cup\b/i.test(q)) searchTerms = year ? [`${year} ICC Men's T20 World Cup`] : ['ICC T20 World Cup'];
  if (/\bworld\s+test\s+championship\b/i.test(q)) searchTerms = ['ICC World Test Championship'];
  if (/\bolympics?\b/.test(q)) { if (year) searchTerms = [`${year} Summer Olympics`, `${year} Winter Olympics`]; else searchTerms = ['Olympic Games']; }
  if (/\bindia\b/.test(q) && year) searchTerms.push(`${year} in India`);
  if (year && searchTerms.length === 1) { const topic = query.replace(yearMatch![0], '').replace(/[?।?!]/g, '').trim(); if (topic.length > 2) { searchTerms.push(`${year} ${topic}`); } searchTerms.push(`${year} in India`); searchTerms.push(year); }

  const results: string[] = [];
  for (const term of searchTerms.slice(0, 5)) {
    try {
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.slice(0, 80))}`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) { const d = await r.json(); if (d.extract && d.extract.length > 40 && d.title !== 'Not found') { if (!results.some(x => x.includes(d.title))) results.push(`WIKIPEDIA (${d.title}): ${d.extract}`); continue; } }
    } catch {}
    try {
      const sr = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term.slice(0, 80))}&limit=2&format=json`, { signal: AbortSignal.timeout(4000) });
      if (sr.ok) { const sd = await sr.json(); for (const title of (sd[1] || []).slice(0, 2)) { if (results.length >= 3) break; try { const r2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(3000) }); if (r2.ok) { const d2 = await r2.json(); if (d2.extract && d2.extract.length > 40 && !results.some(x => x.includes(d2.title))) results.push(`WIKIPEDIA (${d2.title}): ${d2.extract}`); } } catch {} } }
    } catch {}
    if (results.length >= 3) break;
  }
  return results.length > 0 ? results.join('\n\n') : null;
}

async function ddgSearch(query: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query.slice(0, 100))}&format=json&no_html=1`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) { const data = await res.json(); const parts: string[] = []; if (data.Abstract) parts.push(data.Abstract); if (data.RelatedTopics) for (const t of data.RelatedTopics.slice(0, 4)) { if (t.Text) parts.push(t.Text); } if (data.Results) for (const r of data.Results.slice(0, 4)) { if (r.Text) parts.push(r.Text); } if (parts.length > 0) return `SEARCH: ${parts.join('\n')}`; }
  } catch {}
  return null;
}

async function smartSearch(message: string): Promise<string | null> {
  const results: string[] = [];
  const wiki = await wikiSearch(message); if (wiki) results.push(wiki);
  const ddg = await ddgSearch(message); if (ddg) results.push(ddg);
  if (results.length > 0 && results[0].length > 100) return results.join('\n\n');
  const yearMatch = message.match(/(20\d{2})/);
  if (yearMatch) { const topic = message.replace(yearMatch[0], '').replace(/[?।?!]/g, '').trim(); if (topic) { const w = await wikiSearch(`${yearMatch[1]} ${topic}`); if (w && !results.some(r => r === w)) results.push(w); } }
  return results.length > 0 ? results.join('\n\n') : null;
}

// ========== Gemini API (multi-turn with history + images) ==========
async function callGeminiMulti(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>,
  stream: boolean,
): Promise<Response | null> {
  if (!GEMINI_KEY) return null;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${GEMINI_KEY}${stream ? '&alt=sse' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) return res;
      if (res.status === 503 || res.status === 429) continue;
    } catch {}
  }
  return null;
}

// ========== Gemini API (single message, kept for backward compat) ==========
async function callGemini(systemPrompt: string, userMessage: string, stream: boolean, images?: string[]): Promise<Response | null> {
  if (!GEMINI_KEY) return null;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${GEMINI_KEY}${stream ? '&alt=sse' : ''}`;

      // Build user parts: text + any images
      const userParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: userMessage }];

      if (images && images.length > 0) {
        for (const img of images) {
          // Parse data URI: data:image/png;base64,xxxx
          const match = img.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
          if (match) {
            userParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        }
      }

      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: 'user', parts: userParts }], generationConfig: { temperature: 0.7, maxOutputTokens: 8192 } }), signal: AbortSignal.timeout(30000) });
      if (res.ok) return res; if (res.status === 503 || res.status === 429) continue;
    } catch {}
  }
  return null;
}

// ========== Groq API ==========
async function callGroq(messages: Array<{ role: string; content: string }>, stream: boolean): Promise<Response | null> {
  if (!GROQ_KEY) return null;
  for (const model of ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']) {
    try {
      const res = await fetch(GROQ_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` }, body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 4096, stream }), signal: AbortSignal.timeout(30000) });
      if (res.ok) return res;
      if (res.status === 429) { await new Promise(r => setTimeout(r, 5000)); const retry = await fetch(GROQ_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` }, body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 4096, stream }), signal: AbortSignal.timeout(30000) }); if (retry.ok) return retry; }
    } catch {}
  }
  return null;
}

// ========== Streaming ==========
async function streamGemini(apiRes: Response, out: VercelResponse): Promise<void> {
  out.setHeader('Content-Type', 'text/event-stream'); out.setHeader('Cache-Control', 'no-cache'); out.setHeader('Connection', 'keep-alive');
  const reader = apiRes.body?.getReader(); if (!reader) return;
  const decoder = new TextDecoder(); let buffer = '';
  try { while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) { if (!line.startsWith('data: ')) continue; const data = line.slice(6).trim(); if (!data || data === '[DONE]') continue; try { const p = JSON.parse(data); const c = p.candidates?.[0]?.content?.parts?.[0]?.text || ''; if (c) out.write(`data: ${JSON.stringify({ content: c })}\n\n`); } catch {} } } } catch {}
  out.write('data: [DONE]\n\n'); out.end();
}

async function streamGroq(apiRes: Response, out: VercelResponse): Promise<void> {
  out.setHeader('Content-Type', 'text/event-stream'); out.setHeader('Cache-Control', 'no-cache'); out.setHeader('Connection', 'keep-alive');
  const reader = apiRes.body?.getReader(); if (!reader) return;
  const decoder = new TextDecoder(); let buffer = '';
  try { while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) { if (!line.startsWith('data: ')) continue; const data = line.slice(6).trim(); if (data === '[DONE]') { out.write('data: [DONE]\n\n'); continue; } try { const p = JSON.parse(data); const c = p.choices?.[0]?.delta?.content || ''; if (c) out.write(`data: ${JSON.stringify({ content: c })}\n\n`); } catch {} } } } catch {}
  out.write('data: [DONE]\n\n'); out.end();
}

// ========== MAIN ==========
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security headers
  setSecurityHeaders(req, res);

  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting
  if (await checkRateLimitSync(req, res, 'chat', 30)) return;

  // Input validation
  const { message, memories, context, stream, images, history } = req.body || {};
  if (!isValidMessage(message)) return res.status(400).json({ error: 'Valid message required (1-5000 chars)' });

  // Validate arrays
  const safeMemories = Array.isArray(memories) ? memories.filter((m: unknown) => typeof m === 'string').slice(0, 20) : [];
  const safeContext = Array.isArray(context) ? context.filter((c: unknown) => typeof c === 'string').slice(0, 10) : [];
  // Validate images (array of data URI strings)
  const safeImages: string[] = Array.isArray(images) ? images.filter((img: unknown) => typeof img === 'string' && (img as string).startsWith('data:')).slice(0, 5) : [];
  // Validate conversation history
  const safeHistory: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(history)
    ? history.filter((h: unknown): h is { role: 'user' | 'assistant'; content: string } =>
        typeof h === 'object' && h !== null && typeof (h as any).role === 'string' && typeof (h as any).content === 'string' && ['user', 'assistant'].includes((h as any).role)
      ).slice(-20).map((h) => ({ role: h.role, content: h.content.slice(0, 500) }))
    : [];

  // Build system prompt
  const systemParts = [SYSTEM_PROMPT];
  if (safeMemories.length) systemParts.push(`\nUser info: ${safeMemories.map((m: string) => `- ${m.slice(0, 200)}`).join('\n')}`);
  if (safeContext.length) systemParts.push(`\nContext: ${safeContext.join('\n')}`);

  // Classify and fetch
  const { needsSearch, isWeather } = classifyQuery(message);
  const isCricket = /\b(score|match|run|wicket|goal|won|lost|playing|innings|century|virat|kohli|rohit|dhoni|bumrah|pant|gill|hardik|jadeja|ipl|cricket|football|world\s+cup|t20|odi|euro|olympics|batting|bowling|schedule|fixture|tournament|winner|champion|championship|trophy|final)\b/i.test(message.toLowerCase());
  const isNews = !isCricket && !isWeather && /\b(news|khabar|खबर|headlines|updates?|breaking|latest\s+(news|update)|aaj\s+kya|आज\s+क्या|kya\s+chal|क्या\s+चल|top\s+stories|current\s+affairs|समाचार|ताजा\s+खबर)\b/i.test(message.toLowerCase());
  if (isCricket) {
    try {
      const cricRes = await fetch('https://site.web.api.espn.com/apis/site/v2/sports/cricket/scorepanel', { signal: AbortSignal.timeout(6000) });
      if (cricRes.ok) {
        const cricData = await cricRes.json();
        const cricLines: string[] = [];
        for (const se of (cricData.scores || [])) {
          const lName = se.leagues?.[0]?.name || '';
          for (const ev of (se.events || [])) {
            const st = ev.status?.type?.detail || ev.status?.type?.description || '';
            const isLive = ev.status?.type?.state === 'in' || /\b(live|in progress)\b/i.test(st);
            const tag = isLive ? '🔴 LIVE' : '⚪';
            const parts: string[] = [];
            for (const comp of (ev.competitions || [])) {
              for (const team of (comp.competitors || [])) {
                const abbr = team.team?.abbreviation || '';
                const sc = team.score || '0';
                const ls = team.linescores || [];
                let overs = '', wkts = '';
                for (const l of ls) { if (l.overs) overs = l.overs; if (l.wkts) wkts = l.wkts; }
                let s = `${abbr} ${sc}`; if (wkts) s += `/${wkts}`; if (overs) s += ` (${overs} ov)`;
                parts.push(s);
              }
            }
            const scoreStr = parts.length > 0 ? parts.join(' vs ') : (ev.name || '');
            cricLines.push(`${tag} ${scoreStr} — ${st} (${lName})`);
          }
        }
        if (cricLines.length > 0) {
          const cricKw = message.toLowerCase().replace(/cricket|score|match|live|update|latest|kya|क्या|ka|का|batao|बताओ/gi, '').trim().split(/\s+/).filter(k => k.length > 2);
          let cricFiltered = cricLines;
          if (cricKw.length > 0) { const specific = cricLines.filter(l => cricKw.some(k => l.toLowerCase().includes(k))); if (specific.length > 0) cricFiltered = specific; }
          const live = cricFiltered.filter(l => l.startsWith('🔴'));
          const rest = cricFiltered.filter(l => !l.startsWith('🔴'));
          systemParts.push(`\nCRICKET SCORES (use this to answer, format clearly):\n${[...live, ...rest].slice(0, 10).join('\n')}`);
        }
      }
    } catch {}
  }
  if (isNews) {
    try {
      const isHindiNews = /[\u0900-\u097F]/.test(message) || /\b(hindi|हिंदी)\b/i.test(message);
      const newsFeeds = isHindiNews
        ? [
            { url: 'https://www.bhaskar.com/rss-feed/0.xml', source: 'Dainik Bhaskar' },
            { url: 'https://www.jagran.com/rss/top-news.xml', source: 'Jagran' },
          ]
        : [
            { url: 'https://www.thehindu.com/feeder/default.rss', source: 'The Hindu' },
            { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', source: 'NYT' },
          ];
      const newsItems: string[] = [];
      for (const feed of newsFeeds) {
        try {
          const newsRes = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
          if (!newsRes.ok) continue;
          const newsXml = await newsRes.text();
          const niRegex = /<item>([\s\S]*?)<\/item>/g;
          let ni;
          while ((ni = niRegex.exec(newsXml)) !== null) {
            const block = ni[1];
            let title = '';
            const ct = block.match(/<title><!\[CDATA\[(.*?)\]\]>/);
            const pt = block.match(/<title>(.*?)<\/title>/);
            if (ct) title = ct[1].trim();
            else if (pt) title = pt[1].trim();
            title = title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
            if (title && title !== 'undefined' && title.length > 15 && !title.includes('Latest News today')) {
              newsItems.push(`${title} — ${feed.source}`);
            }
          }
        } catch {}
      }
      // Deduplicate
      const seenN = new Set<string>();
      const uniqueNews = newsItems.filter(n => { const k = n.slice(0, 30).toLowerCase(); if (seenN.has(k)) return false; seenN.add(k); return true; });
      if (uniqueNews.length > 0) {
        systemParts.push(`\nLATEST NEWS HEADLINES (list these clearly as bullet points):\n${uniqueNews.slice(0, 8).map((n, i) => `${i + 1}. ${n}`).join('\n')}`);
      }
    } catch {}
  }
  if (isWeather) {
    // Check for lat/lon from client-side Geolocation
    const clientLat = typeof req.body.lat === 'number' ? req.body.lat : undefined;
    const clientLon = typeof req.body.lon === 'number' ? req.body.lon : undefined;
    const wd = await fetchWeather(message, clientLat, clientLon);
    if (wd) systemParts.push(`\n${wd}`); else { const sd = await smartSearch(message); if (sd) systemParts.push(`\n${sd}`); }
  }
  else if (needsSearch && !isCricket && !isNews) { const sd = await smartSearch(message); if (sd) systemParts.push(`\nREAL-TIME DATA (use this to answer):\n${sd}`); }

  const systemPrompt = systemParts.join('\n');

  // Build conversation messages array for APIs that support multi-turn
  const groqMessages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemPrompt }];
  for (const h of safeHistory) {
    groqMessages.push({ role: h.role, content: h.content });
  }
  groqMessages.push({ role: 'user', content: message });

  // Build Gemini contents array (multi-turn with images)
  const geminiContents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> = [];
  for (const h of safeHistory) {
    geminiContents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] });
  }
  // Current user message with images
  const currentUserParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: message }];
  if (safeImages.length > 0) {
    for (const img of safeImages) {
      const match = img.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
      if (match) currentUserParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
  }
  geminiContents.push({ role: 'user', parts: currentUserParts });

  if (stream) {
    const geminiRes = await callGeminiMulti(systemPrompt, geminiContents, true);
    if (geminiRes) { await streamGemini(geminiRes, res); return; }
    const groqRes = await callGroq(groqMessages, true);
    if (groqRes) { await streamGroq(groqRes, res); return; }
    res.setHeader('Content-Type', 'text/event-stream'); res.write(`data: ${JSON.stringify({ content: '⚠️ AI unavailable. Configure API keys.' })}\n\n`); res.write('data: [DONE]\n\n'); res.end(); return;
  }

  const geminiRes = await callGeminiMulti(systemPrompt, geminiContents, false);
  if (geminiRes) { try { const d = await geminiRes.json(); const c = d.candidates?.[0]?.content?.parts?.[0]?.text || ''; if (c) return res.status(200).json({ content: c }); } catch {} }
  const groqRes = await callGroq(groqMessages, false);
  if (groqRes) { try { const d = await groqRes.json(); const c = d.choices?.[0]?.message?.content || ''; if (c) return res.status(200).json({ content: c }); } catch {} }
  return res.status(503).json({ error: 'All AI providers unavailable.' });
}
