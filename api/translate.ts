import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecurityHeaders, checkRateLimitSync, handleOptions } from './_security';

// MyMemory Translation API — free, no key required
// https://api.mymemory.translated.net/get?q=text&langpair=en|hi

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(req, res, { allowMethods: ['GET', 'OPTIONS'] });
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (await checkRateLimitSync(req, res, 'translate', 30)) return;

  const { q, langpair } = req.query;
  if (!q || !langpair) return res.status(400).json({ error: 'Missing q (text) or langpair (e.g. en|hi)' });

  const text = String(q).slice(0, 500);
  const pair = String(langpair);
  // Validate langpair format (e.g., "en|hi")
  if (!/^[a-z]{2,3}(-[a-z]{2,4})?\|[a-z]{2,3}(-[a-z]{2,4})?$/i.test(pair)) {
    return res.status(400).json({ error: 'Invalid langpair format. Use: en|hi' });
  }

  try {
    const apiRes = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!apiRes.ok) return res.status(502).json({ error: 'Translation API error' });

    const data = await apiRes.json();
    const translated = data?.responseData?.translatedText || '';

    if (!translated || translated === text) {
      return res.status(200).json({ translated: text, match: 0 });
    }

    const match = parseFloat(data?.responseData?.match || '0');
    return res.status(200).json({ translated, match });
  } catch (err) {
    return res.status(500).json({ error: 'Translation failed' });
  }
}
