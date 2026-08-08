import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecurityHeaders, checkRateLimitSync, handleOptions } from './_security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(req, res);
  if (handleOptions(req, res)) return;
  if (await checkRateLimitSync(req, res, 'health', 60)) return;

  const hasGemini = !!(process.env.GEMINI_API_KEY);
  const hasGroq = !!(process.env.GROQ_API_KEY);

  return res.status(200).json({
    status: 'ok',
    ai: hasGemini ? 'gemini' : hasGroq ? 'groq' : 'not_configured',
    model: hasGemini ? 'gemini-3.1-flash-lite' : 'llama-3.1-8b-instant',
    fallback: hasGroq ? 'groq' : null,
    timestamp: new Date().toISOString(),
  });
}
