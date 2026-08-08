// Shared security utilities for all Vercel serverless API endpoints
import type { VercelRequest, VercelResponse } from '@vercel/node';
export { checkRateLimit, getClientIP } from './_rate-limit';

// ========== SECURITY HEADERS ==========
// Deployment origin for CORS — restrict to known domains
const ALLOWED_ORIGINS = [
  'https://jarvis-murex-five.vercel.app',
  'http://localhost:1420',
  'http://localhost:5173',
  'http://127.0.0.1:1420',
];

export function setSecurityHeaders(req: VercelRequest, res: VercelResponse, options?: {
  allowMethods?: string[];
  enableCORS?: boolean;
}): void {
  const origin = req.headers.origin || '';
  const isAllowedOrigin = !origin || ALLOWED_ORIGINS.includes(origin) ||
    origin.match(/^https:\/\/[a-z0-9-]+-hackonauts\.vercel\.app$/);

  if (options?.enableCORS !== false) {
    res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : ALLOWED_ORIGINS[0]);
    res.setHeader('Access-Control-Allow-Methods', (options?.allowMethods || ['GET', 'POST', 'OPTIONS']).join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

// ========== INPUT VALIDATION ==========
export function sanitizeString(str: string, maxLen: number = 500): string {
  return str.slice(0, maxLen).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' }[c] || c));
}

export function isValidQuery(q: unknown, maxLen: number = 500): q is string {
  return typeof q === 'string' && q.trim().length > 0 && q.length <= maxLen;
}

// ========== RATE LIMIT CHECK + 429 ==========
export async function isRateLimited(req: VercelRequest, res: VercelResponse, endpoint: string, limit?: number): Promise<boolean> {
  const { checkRateLimit, getClientIP } = await import('./_rate-limit');
  const ip = getClientIP(req);
  if (await checkRateLimit(req, endpoint, limit)) {
    res.status(429).json({ error: 'Too many requests. Please wait.' });
    return true;
  }
  return false;
}

// ========== HANDLE OPTIONS PREFLIGHT ==========
export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    setSecurityHeaders(req, res);
    res.status(200).end();
    return true;
  }
  return false;
}

// Old sync function name kept for backward compat — now async
// This is used by existing endpoints that call checkRateLimit
export async function checkRateLimitSync(req: VercelRequest, res: VercelResponse, endpoint: string, limit?: number): Promise<boolean> {
  return isRateLimited(req, res, endpoint, limit);
}
