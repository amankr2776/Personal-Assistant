import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecurityHeaders, checkRateLimitSync, handleOptions } from './_security';

// YouTube search — multiple methods for maximum reliability
// 1. YouTube Data API v3 (if YOUTUBE_API_KEY env var set)
// 2. Piped API (public, no key needed) — primary fallback
// 3. Invidious API — secondary fallback

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

interface VideoResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  url: string;
}

// Parse ISO 8601 duration (PT1H2M3S → 1:02:03)
function parseISO8601(d: string): string {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || '0');
  const min = parseInt(m[2] || '0');
  const s = parseInt(m[3] || '0');
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
}

// Format seconds to mm:ss or h:mm:ss
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ========== Method 1: YouTube Data API v3 ==========
async function searchYouTubeAPI(query: string, maxResults = 8): Promise<VideoResult[]> {
  if (!YOUTUBE_API_KEY) return [];
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=${maxResults}&type=video&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const results: VideoResult[] = [];
    for (const item of (data.items || [])) {
      results.push({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
        duration: '',
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      });
    }
    // Try to get durations
    if (results.length > 0) {
      const ids = results.map(r => r.id).join(',');
      try {
        const dRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${YOUTUBE_API_KEY}`, { signal: AbortSignal.timeout(5000) });
        if (dRes.ok) {
          const dData = await dRes.json();
          for (const item of (dData.items || [])) {
            const r = results.find(r => r.id === item.id);
            if (r && item.contentDetails?.duration) r.duration = parseISO8601(item.contentDetails.duration);
          }
        }
      } catch {}
    }
    return results;
  } catch { return []; }
}

// ========== Method 2: Piped API (public, no key needed) ==========
async function searchPiped(query: string, maxResults = 8): Promise<VideoResult[]> {
  const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://piped-api.privacy.com.de',
    'https://api.piped.projectsegfau.lt',
  ];
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=videos`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.items || data.items.length === 0) continue;
      const results: VideoResult[] = [];
      for (const item of data.items.slice(0, maxResults)) {
        if (item.type !== 'stream' || !item.url) continue;
        // Extract video ID from Piped URL (/watch?v=XXXXX)
        const idMatch = item.url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (!idMatch) continue;
        results.push({
          id: idMatch[1],
          title: item.title || '',
          channel: item.uploaderName || '',
          thumbnail: item.thumbnail || `https://img.youtube.com/vi/${idMatch[1]}/mqdefault.jpg`,
          duration: formatDuration(item.duration || 0),
          url: `https://www.youtube.com/watch?v=${idMatch[1]}`,
        });
      }
      if (results.length > 0) return results;
    } catch { continue; }
  }
  return [];
}

// ========== Method 3: Invidious API ==========
async function searchInvidious(query: string, maxResults = 8): Promise<VideoResult[]> {
  const INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.fdn.fr',
    'https://vid.puffian.us',
  ];
  for (const instance of INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;
      const results: VideoResult[] = [];
      for (const item of data.slice(0, maxResults)) {
        if (item.type !== 'video' || !item.videoId) continue;
        results.push({
          id: item.videoId,
          title: item.title || '',
          channel: item.author || '',
          thumbnail: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
          duration: formatDuration(item.lengthSeconds || 0),
          url: `https://www.youtube.com/watch?v=${item.videoId}`,
        });
      }
      if (results.length > 0) return results;
    } catch { continue; }
  }
  return [];
}

// ========== Method 4: Scrape YouTube search HTML (ALWAYS WORKS) ==========
async function searchYouTubeScrape(query: string, maxResults = 5): Promise<VideoResult[]> {
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Extract video IDs from /watch?v=XXXXXXXXXXX patterns
    const idRegex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
    const seen = new Set<string>();
    const ids: string[] = [];
    let match;
    while ((match = idRegex.exec(html)) !== null) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        ids.push(match[1]);
      }
      if (ids.length >= maxResults) break;
    }
    if (ids.length === 0) return [];

    // Enrich with oembed data (title, channel) — free, no key needed
    const results: VideoResult[] = [];
    for (const id of ids) {
      let title = '';
      let channel = '';
      try {
        const oRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`, {
          signal: AbortSignal.timeout(3000),
        });
        if (oRes.ok) {
          const oData = await oRes.json();
          title = oData.title || '';
          channel = oData.author_name || '';
        }
      } catch {}
      results.push({
        id,
        title: title || `Video ${id}`,
        channel,
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        duration: '',
        url: `https://www.youtube.com/watch?v=${id}`,
      });
    }
    return results;
  } catch { return []; }
}

// Main search — try each method in order
async function searchYouTube(query: string, maxResults = 8): Promise<{ results: VideoResult[]; source: string }> {
  // 1. Try YouTube Data API (best quality, needs key)
  const apiResults = await searchYouTubeAPI(query, maxResults);
  if (apiResults.length > 0) return { results: apiResults, source: 'youtube-api' };

  // 2. Try Piped (fast, reliable, no key needed)
  const pipedResults = await searchPiped(query, maxResults);
  if (pipedResults.length > 0) return { results: pipedResults, source: 'piped' };

  // 3. Try Invidious (good fallback)
  const invResults = await searchInvidious(query, maxResults);
  if (invResults.length > 0) return { results: invResults, source: 'invidious' };

  // 4. Scrape YouTube search HTML — ALWAYS WORKS
  const scrapeResults = await searchYouTubeScrape(query, maxResults);
  if (scrapeResults.length > 0) return { results: scrapeResults, source: 'scrape' };

  return { results: [], source: 'none' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(req, res, { allowMethods: ['GET', 'POST', 'OPTIONS'] });
  if (handleOptions(req, res)) return;
  if (await checkRateLimitSync(req, res, 'youtube', 20)) return;

  if (req.method === 'GET') {
    const query = (req.query.q as string || '').trim();
    if (!query || query.length > 200) return res.status(400).json({ error: 'Query required (max 200 chars)' });
    const result = await searchYouTube(query, 8);
    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    const { action, query, videoId } = req.body || {};
    if (action === 'search') {
      if (!query || typeof query !== 'string' || query.length > 200) return res.status(400).json({ error: 'Query required (max 200 chars)' });
      const result = await searchYouTube(query, 8);
      return res.status(200).json(result);
    }
    if (action === 'details' && videoId) {
      // Validate videoId format (YouTube IDs are 11 chars: a-zA-Z0-9_-)
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).json({ error: 'Invalid video ID' });
      try {
        const oRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { signal: AbortSignal.timeout(5000) });
        if (oRes.ok) {
          const oData = await oRes.json();
          return res.status(200).json({ id: videoId, title: oData.title, channel: oData.author_name, thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, url: `https://www.youtube.com/watch?v=${videoId}` });
        }
      } catch {}
      return res.status(200).json({ id: videoId, url: `https://www.youtube.com/watch?v=${videoId}` });
    }
    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
