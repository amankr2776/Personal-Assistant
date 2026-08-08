import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecurityHeaders, checkRateLimitSync, handleOptions, getClientIP } from './_security';

const GROQ_KEY = process.env.GROQ_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await checkRateLimitSync(req, res, 'transcribe', 10)) return; // Strict: 10/min for expensive Whisper

  if (!GROQ_KEY) return res.status(503).json({ error: 'Groq API not configured' });

  try {
    // Audio comes as base64 in body
    const { audio, mimeType } = req.body || {};
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'Audio data required (base64)' });
    }

    // Decode base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    if (audioBuffer.length < 100) {
      return res.status(400).json({ error: 'Audio too short' });
    }
    if (audioBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Audio too large (max 10MB)' });
    }

    // Determine file extension from mimeType — validate
    const validMimeTypes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/mpeg', 'audio/ogg'];
    const safeMimeType = validMimeTypes.some(m => mimeType?.includes(m)) ? mimeType : 'audio/webm';
    const ext = safeMimeType.includes('webm') ? 'webm' : safeMimeType.includes('mp4') ? 'mp4' : safeMimeType.includes('wav') ? 'wav' : 'webm';
    const filename = `recording.${ext}`;

    // Send to Groq Whisper
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: safeMimeType }), filename);
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'json');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}` },
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!whisperRes.ok) {
      return res.status(502).json({ error: 'Speech transcription failed', status: whisperRes.status });
    }

    const data = await whisperRes.json();
    const text = data.text?.trim() || '';

    if (!text) {
      return res.status(200).json({ text: '', confidence: 0 });
    }

    return res.status(200).json({ text, confidence: 0.9 });
  } catch (err: any) {
    // SECURITY: Don't expose internal error details
    return res.status(500).json({ error: 'Transcription failed' });
  }
}
