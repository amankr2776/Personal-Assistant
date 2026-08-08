from http.server import BaseHTTPRequestHandler
import json
import asyncio
import io
import re

try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False

# Allowed CORS origins (no wildcards)
ALLOWED_ORIGINS = [
    'https://jarvis-murex-five.vercel.app',
    'http://localhost:1420',
    'http://localhost:5173',
    'http://127.0.0.1:1420',
]

def _get_cors_origin(origin: str) -> str:
    """Return the origin if allowed, otherwise the first default."""
    if not origin:
        return ALLOWED_ORIGINS[0]
    if origin in ALLOWED_ORIGINS:
        return origin
    # Allow Vercel preview URLs
    if origin.startswith('https://') and '-hackonauts.vercel.app' in origin:
        return origin
    return ALLOWED_ORIGINS[0]


# Indian female neural voices — sweet and natural
VOICES = {
    "en": "en-IN-NeerjaNeural",   # Sweet Indian English female
    "hi": "hi-IN-SwaraNeural",    # Sweet Hindi female
}

# Rate and volume adjustments for sweetness
RATE = "+10%"     # Slightly faster for natural feel
VOLUME = "+0%"    # Normal volume

# Rate limiting (in-memory, per-IP)
_rate_limiter = {}
RATE_LIMIT = 15  # 15 TTS requests per minute per IP
RATE_WINDOW = 60000


def _is_rate_limited(ip: str) -> bool:
    import time
    now = int(time.time() * 1000)
    entry = _rate_limiter.get(ip)
    if not entry or now > entry['resetAt']:
        _rate_limiter[ip] = {'count': 1, 'resetAt': now + RATE_WINDOW}
        return False
    entry['count'] += 1
    return entry['count'] > RATE_LIMIT


def clean_text(text: str) -> str:
    """Remove markdown, code blocks, emojis, etc. for TTS"""
    # Remove code blocks
    text = re.sub(r'```[\s\S]*?```', ' code block ', text)
    # Remove inline code
    text = re.sub(r'`[^`]+`', ' code ', text)
    # Remove bold/italic markdown
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    # Remove headings
    text = re.sub(r'#{1,6}\s', '', text)
    # Remove links
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove list markers
    text = re.sub(r'[-*]\s', '', text)
    # Remove emojis and special chars
    text = re.sub(r'[✅💾⚠️🤖🔴🎤🇮🇳🇬🇧🎙️🗣️🌙☀️🌤️🌆🏏🐍💪📡💻❌✓❯→←↑↓]', '', text)
    # Remove bullet points and numbering
    text = re.sub(r'^\d+\.\s', '', text, flags=re.MULTILINE)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Truncate to safe TTS length (edge-tts can handle up to ~5000 chars)
    return text[:3000]


async def generate_audio(text: str, voice: str) -> bytes:
    """Generate audio using edge-tts with neural voice"""
    communicate = edge_tts.Communicate(
        text, voice,
        rate=RATE,
        volume=VOLUME,
    )
    buffer = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buffer.write(chunk["data"])
    return buffer.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', _get_cors_origin(self.headers.get('Origin', '')))
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
        # Security headers
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        self.end_headers()

    def do_POST(self):
        # Rate limiting
        client_ip = self.client_address[0] if self.client_address else 'unknown'
        if _is_rate_limited(client_ip):
            self.send_response(429)
            self.send_header('Content-Type', 'application/json')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Too many requests'}).encode())
            return

        # CORS + Security headers
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', _get_cors_origin(self.headers.get('Origin', '')))
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

        if not HAS_EDGE_TTS:
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': 'edge-tts not available',
                'fallback': True
            }).encode())
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            # SECURITY: Limit request body size (max 10KB for TTS)
            if content_length > 10240:
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Request too large', 'fallback': True}).encode())
                return
            raw = self.rfile.read(content_length) if content_length > 0 else b'{}'
            body = json.loads(raw)

            text = body.get('text', '')
            lang = body.get('lang', 'en')

            if not text or len(text.strip()) < 1:
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Text required'}).encode())
                return

            # SECURITY: Validate lang parameter
            if lang not in ('en', 'hi'):
                lang = 'en'

            # SECURITY: Truncate text to prevent abuse
            if len(text) > 5000:
                text = text[:5000]

            # Clean text for TTS
            cleaned = clean_text(text)
            if not cleaned:
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No speakable text'}).encode())
                return

            # Select voice
            voice = VOICES.get(lang, VOICES['en'])

            # Generate audio
            audio_data = asyncio.run(generate_audio(cleaned, voice))

            if not audio_data or len(audio_data) < 100:
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Audio generation failed'}).encode())
                return

            # Return audio as MP3 binary
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Length', str(len(audio_data)))
            self.end_headers()
            self.wfile.write(audio_data)

        except asyncio.TimeoutError:
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'TTS timeout', 'fallback': True}).encode())
        except Exception as e:
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            # SECURITY: Don't expose internal error details
            self.wfile.write(json.dumps({'error': 'TTS failed', 'fallback': True}).encode())

    def log_message(self, format, *args):
        # Suppress default logging to keep Vercel logs clean
        pass
