import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    status: 'ok',
    ai: process.env.GROQ_API_KEY ? 'groq' : 'not_configured',
    model: 'llama-3.1-8b-instant',
    timestamp: new Date().toISOString(),
  });
}
