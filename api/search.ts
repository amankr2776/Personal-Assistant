import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, count = 5 } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const results: Array<{ title: string; url: string; snippet: string }> = [];

  try {
    // DuckDuckGo Instant Answer API (proper JSON, no scraping)
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'User-Agent': 'JARVIS/1.0' }, signal: AbortSignal.timeout(8000) }
    );

    if (ddgRes.ok) {
      const data = await ddgRes.json();

      // Abstract (main answer)
      if (data.Abstract) {
        results.push({
          title: data.AbstractSource || 'DuckDuckGo',
          url: data.AbstractURL || '',
          snippet: data.Abstract.slice(0, 300),
        });
      }

      // Infobox
      if (data.infobox?.content?.length) {
        for (const item of data.infobox.content.slice(0, 3)) {
          if (item.value) {
            results.push({
              title: item.label || 'Info',
              url: data.infobox.url || '',
              snippet: `${item.label}: ${item.value}`,
            });
          }
        }
      }

      // Related topics
      if (data.RelatedTopics?.length) {
        for (const topic of data.RelatedTopics.slice(0, count)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.slice(0, 80),
              url: topic.FirstURL,
              snippet: topic.Text.slice(0, 200),
            });
          }
        }
      }

      // Results from the 'Results' field
      if (data.Results?.length) {
        for (const r of data.Results.slice(0, count)) {
          results.push({
            title: r.Text?.slice(0, 80) || 'Result',
            url: r.FirstURL || '',
            snippet: r.Text?.slice(0, 200) || '',
          });
        }
      }
    }
  } catch {}

  // If no results from DDG API, try Brave Search (if key available) or return fallback
  if (results.length === 0) {
    try {
      // Fallback: Wikipedia API for factual queries
      const wikiRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        if (wikiData.extract) {
          results.push({
            title: wikiData.title || 'Wikipedia',
            url: wikiData.content_urls?.desktop?.page || '',
            snippet: wikiData.extract.slice(0, 300),
          });
        }
      }
    } catch {}
  }

  if (results.length === 0) {
    results.push({
      title: `Search: ${query}`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: 'Click to view search results on DuckDuckGo.',
    });
  }

  return res.status(200).json({ results: results.slice(0, count) });
}
