// Server-side Firebase ID Token Verification for Vercel Serverless
// Verifies JWT tokens issued by Firebase Auth without requiring firebase-admin SDK

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Firebase JWT public key cache
let cachedKeys: { keys: Record<string, string>; expiry: number } | null = null;

const FIREBASE_KEY_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

async function getFirebasePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedKeys && cachedKeys.expiry > now) return cachedKeys.keys;

  try {
    const res = await fetch(FIREBASE_KEY_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('Failed to fetch Firebase public keys');
    const keys = await res.json() as Record<string, string>;
    // Cache for 1 hour
    cachedKeys = { keys, expiry: now + 3600000 };
    return keys;
  } catch {
    throw new Error('Firebase key fetch failed');
  }
}

// Simple JWT decode (header + payload) without verification
function decodeJwt(token: string): { header: any; payload: any; signature: string } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  return {
    header: JSON.parse(atob(parts[0])),
    payload: JSON.parse(atob(parts[1])),
    signature: parts[2],
  };
}

// Verify Firebase ID Token
export async function verifyFirebaseToken(token: string, projectId: string): Promise<{ uid: string; email: string | null; name: string | null }> {
  const { header, payload } = decodeJwt(token);

  // Validate JWT header
  if (header.alg !== 'RS256') throw new Error('Unsupported algorithm');
  if (!header.kid) throw new Error('Missing key ID');

  // Get Firebase public keys
  const keys = await getFirebasePublicKeys();
  const publicKey = keys[header.kid];
  if (!publicKey) throw new Error('Key ID not found in Firebase keys');

  // Validate payload claims
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error('Invalid issuer');
  if (payload.aud !== projectId)
    throw new Error('Invalid audience');
  if (payload.exp < now)
    throw new Error('Token expired');
  if (payload.iat > now + 300) // Allow 5 min clock skew
    throw new Error('Token issued in the future');
  if (!payload.sub)
    throw new Error('Missing subject (uid)');

  // Verify RSA signature using Web Crypto API (available in Vercel runtime)
  const publicKeyPem = publicKey
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, '');
  const publicKeyBuffer = Uint8Array.from(atob(publicKeyPem), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureInput = token.split('.').slice(0, 2).join('.');
  const signatureBuffer = Uint8Array.from(atob(payload.exp.toString()), c => c.charCodeAt(0));

  // Decode base64url signature
  const sigParts = token.split('.');
  const sigB64 = sigParts[2].replace(/-/g, '+').replace(/_/g, '/');
  const sigBuffer = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));

  const dataBuffer = new TextEncoder().encode(signatureInput);

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    sigBuffer,
    dataBuffer
  );

  if (!isValid) throw new Error('Invalid signature');

  return {
    uid: payload.sub as string,
    email: payload.email || null,
    name: payload.name || null,
  };
}

// Extract and verify token from request
export async function authenticateRequest(
  req: VercelRequest,
  res: VercelResponse,
  projectId: string
): Promise<{ uid: string; email: string | null } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await verifyFirebaseToken(token, projectId);
    return { uid: decoded.uid, email: decoded.email };
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

// Optional authentication (doesn't block if no token, but extracts uid if present)
export async function optionalAuth(
  req: VercelRequest,
  projectId: string
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const decoded = await verifyFirebaseToken(token, projectId);
    return decoded.uid;
  } catch {
    return null;
  }
}
