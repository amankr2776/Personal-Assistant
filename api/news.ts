import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecurityHeaders, checkRateLimitSync, handleOptions } from './_security';

interface NewsItem {
  title: string;
  source: string;
  url: string;
}

// Multiple RSS feeds — free, no API key
const FEEDS = {
  en: [
    { url: 'https://www.thehindu.com/feeder/default.rss', source: 'The Hindu' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', source: 'NYT' },
    { url: 'https://www.indiatoday.in/rss/1206586', source: 'India Today' },
  ],
  hi: [
    { url: 'https://www.bhaskar.com/rss-feed/0.xml', source: 'Dainik Bhaskar' },
    { url: 'https://www.jagran.com/rss/top-news.xml', source: 'Jagran' },
  ],
};

async function fetchRSSFeed(url: string, source: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      let title = '';
      const ctitle = block.match(/<title><!\[CDATA\[(.*?)\]\]>/);
      const ptitle = block.match(/<title>(.*?)<\/title>/);
      if (ctitle) title = ctitle[1].trim();
      else if (ptitle) title = ptitle[1].trim();

      // Decode HTML entities
      title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

      let link = '';
      const linkMatch = block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/) || block.match(/<link>(.*?)<\/link>/);
      if (linkMatch) link = linkMatch[1].trim();

      // Skip feed-level titles
      if (title && title !== 'undefined' && !title.includes('Latest News today') && title.length > 15 && title.length < 300) {
        items.push({ title, source, url: link });
      }
    }

    return items;
  } catch {
    return [];
  }
}

async function getNews(lang = 'en'): Promise<NewsItem[]> {
  const feeds = FEEDS[lang as keyof typeof FEEDS] || FEEDS.en;
  const allItems: NewsItem[] = [];

  for (const feed of feeds) {
    const items = await fetchRSSFeed(feed.url, feed.source);
    allItems.push(...items);
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  return allItems.filter(item => {
    const key = item.title.slice(0, 30).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

function formatNewsForAI(items: NewsItem[]): string {
  if (items.length === 0) return 'No news available right now.';
  return items.map((item, i) => {
    const source = item.source ? ` — ${item.source}` : '';
    return `${i + 1}. ${item.title}${source}`;
  }).join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(req, res, { allowMethods: ['GET', 'OPTIONS'] });
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (await checkRateLimitSync(req, res, 'news', 20)) return;

  // Validate lang parameter
  const lang = (req.query.lang as string || 'en').trim();
  if (!['en', 'hi'].includes(lang)) return res.status(400).json({ error: 'Invalid lang parameter' });
  const items = await getNews(lang);

  return res.status(200).json({ items, text: formatNewsForAI(items), count: items.length, source: 'rss' });
}
