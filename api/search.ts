import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecurityHeaders, checkRateLimitSync, handleOptions } from './_security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await checkRateLimitSync(req, res, 'search', 30)) return;

  const { query, count = 5 } = req.body || {};
  if (!query || typeof query !== 'string' || query.length > 200) return res.status(400).json({ error: 'Valid query required (max 200 chars)' });

  const safeCount = Math.min(Math.max(Number(count) || 5, 1), 10);
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  try {
    const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, { signal: AbortSignal.timeout(8000) });
    if (ddgRes.ok) {
      const data = await ddgRes.json();
      if (data.Abstract) results.push({ title: data.AbstractSource || 'DuckDuckGo', url: data.AbstractURL || '', snippet: data.Abstract.slice(0, 300) });
      if (data.RelatedTopics) for (const t of data.RelatedTopics.slice(0, safeCount)) { if (t.Text && t.FirstURL) results.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text.slice(0, 200) }); }
      if (data.Results) for (const r of data.Results.slice(0, safeCount)) results.push({ title: r.Text?.slice(0, 80) || 'Result', url: r.FirstURL || '', snippet: r.Text?.slice(0, 200) || '' });
    }
  } catch {}

  if (results.length === 0) {
    try {
      const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(5000) });
      if (wikiRes.ok) { const wd = await wikiRes.json(); if (wd.extract) results.push({ title: wd.title || 'Wikipedia', url: wd.content_urls?.desktop?.page || '', snippet: wd.extract.slice(0, 300) }); }
    } catch {}
  }

  return res.status(200).json({ results: results.slice(0, safeCount) });
}
