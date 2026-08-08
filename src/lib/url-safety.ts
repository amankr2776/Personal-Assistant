// URL Safety — Whitelist of allowed domains for window.open()
// Prevents prompt injection from opening malicious URLs

const ALLOWED_DOMAINS = [
  // YouTube
  'www.youtube.com', 'youtube.com', 'm.youtube.com',
  // GitHub
  'github.com', 'www.github.com',
  // LinkedIn
  'linkedin.com', 'www.linkedin.com',
  // Search engines (for search results)
  'duckduckgo.com', 'www.duckduckgo.com',
  // WhatsApp
  'web.whatsapp.com',
  // News sources (for article links)
  'thehindu.com', 'www.thehindu.com',
  'nytimes.com', 'www.nytimes.com',
  'espncricinfo.com', 'www.espncricinfo.com',
  // Wikipedia
  'wikipedia.org', 'en.wikipedia.org', 'hi.wikipedia.org',
  // Pollinations.ai (image generation)
  'image.pollinations.ai',
];

export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS (and HTTP for localhost in dev)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost') return false;
    // Check domain whitelist
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false; // Invalid URL
  }
}

export function safeWindowOpen(url: string, target: string = '_blank'): Window | null {
  if (!isUrlSafe(url)) {
    console.warn('Blocked unsafe URL:', url.replace(/[?&].*/, ''));
    return null;
  }
  return window.open(url, target, 'noopener,noreferrer');
}

// Prompt injection defense — sanitize AI output before processing smart commands
// Detects common injection patterns that try to trigger commands

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\<\s*system\s*\>/i,
  /execute\s+command/i,
  /run\s+the\s+following/i,
  /open\s+this\s+url/i,
  /navigate\s+to/i,
  /click\s+this\s+link/i,
];

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

// Sanitize text that will be used in smart commands (YouTube, GitHub, etc.)
export function sanitizeCommandInput(text: string): string {
  return text
    .replace(/[<>]/g, '')           // Remove HTML brackets
    .replace(/javascript:/gi, '')    // Remove javascript: protocol
    .replace(/data:/gi, '')          // Remove data: protocol
    .replace(/on\w+=/gi, '')         // Remove event handlers
    .slice(0, 200);                  // Limit length
}
