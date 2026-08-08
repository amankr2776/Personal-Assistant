// Persistent Rate Limiting using Vercel KV (Redis)
// Survives serverless cold starts and works across all instances
// Falls back to in-memory if KV is not configured

import type { VercelRequest } from '@vercel/node';

// In-memory fallback (used when Vercel KV is not available)
const memoryLimiter = new Map<string, Map<string, { count: number; resetAt: number }>>>();

function isMemoryLimited(ip: string, endpoint: string, limit: number, windowMs: number): boolean {
  if (!memoryLimiter.has(endpoint)) memoryLimiter.set(endpoint, new Map());
  const limiter = memoryLimiter.get(endpoint)!;
  const now = Date.now();
  const entry = limiter.get(ip);
  if (!entry || now > entry.resetAt) {
    limiter.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// Vercel KV rate limiting (persistent across cold starts)
async function isKvLimited(ip: string, endpoint: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const { kv } = await import('@vercel/kv');
    const key = `ratelimit:${endpoint}:${ip}`;
    const current = await kv.get<number>(key);

    if (current === null || current === undefined) {
      await kv.set(key, 1, { px: windowMs }); // px = expire in milliseconds
      return false;
    }

    if (current >= limit) return true;

    await kv.incr(key);
    return false;
  } catch {
    // KV not available — fall back to in-memory
    return isMemoryLimited(ip, endpoint, limit, windowMs);
  }
}

export function getClientIP(req: VercelRequest): string {
  return (req.headers['x-forwarded-for'] as string || '').split(',')[0]?.trim() || 'unknown';
}

// Check rate limit — uses Vercel KV if available, falls back to in-memory
export async function checkRateLimit(
  req: VercelRequest,
  endpoint: string,
  limit: number = 30,
  windowMs: number = 60000
): Promise<boolean> {
  const ip = getClientIP(req);

  // Try KV first (persistent), fall back to memory
  try {
    return await isKvLimited(ip, endpoint, limit, windowMs);
  } catch {
    return isMemoryLimited(ip, endpoint, limit, windowMs);
  }
}
