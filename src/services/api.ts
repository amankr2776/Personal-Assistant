// JARVIS API — works from ANY domain (Vercel, localhost, etc.)
// Uses Vercel serverless /api/* for Gemini/Groq AI + search
// Falls back to local Ollama when available
// All requests include Firebase Auth token when available

import { evaluate } from 'mathjs';

const OLLAMA_URL = 'http://localhost:11434';

// ===== AUTH TOKEN INJECTION =====
// Gets the current Firebase ID token without circular imports
let _getIdToken: (() => Promise<string | null>) | null = null;
export function setIdTokenGetter(getter: () => Promise<string | null>) {
  _getIdToken = getter;
}
async function getAuthToken(): Promise<string | null> {
  try { return _getIdToken ? await _getIdToken() : null; } catch { return null; }
}

// Helper: create headers with auth token
async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra,
  };
}

interface ChatRequest {
  message: string;
  model?: string;
  mode?: string;
  session_id?: string;
  memories?: string[];
  context?: string[];
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  images?: string[];
  lat?: number;
  lon?: number;
}

function isDeployed() {
  return !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
}

async function ollamaReachable(): Promise<{ ok: boolean; models: string[] }> {
  if (isDeployed()) return { ok: false, models: [] };
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ok: false, models: [] };
    const data = await res.json();
    return { ok: true, models: (data.models || []).map((m: { name: string }) => m.name) };
  } catch {
    return { ok: false, models: [] };
  }
}

class ApiService {
  async detectConnections(): Promise<{
    ollama: boolean; cloud: boolean; models: string[]; isDeployed: boolean;
  }> {
    const deployed = isDeployed();
    const ollama = await ollamaReachable();
    let cloudOk = false;
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
      if (res.ok) { const data = await res.json(); cloudOk = data.ai === 'gemini' || data.ai === 'groq'; }
    } catch {}
    return { ollama: ollama.ok, cloud: cloudOk, models: ollama.ok ? ollama.models : ['llama-3.1-8b-instant'], isDeployed: deployed };
  }

  async checkHealth(): Promise<boolean> {
    try { const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) }); return res.ok; } catch { return false; }
  }

  async checkOllama(): Promise<{ ok: boolean; models: string[] }> { return ollamaReachable(); }

  async *streamChat(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    try { yield* this.streamCloud(request); return; } catch {}
    const ollama = await ollamaReachable();
    if (ollama.ok) { try { yield* this.streamOllama(request); return; } catch {} }
    yield* this.offlineResponse(request.message);
  }

  async *streamOllama(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const systemParts = [
      'You are Aira, a warm, intelligent, and caring personal AI assistant for Aman Kumar. You are female — a girl assistant. Use warm, caring, feminine language. Be supportive and encouraging.',
      'Answer ONLY what is asked. You MUST reply ONLY in English or Hindi (Devanagari script). NEVER use any other language. Hindi question → Hindi reply. English question → English reply.',
      'If search data provided, use it. Never say "I don\'t have access".',
      `Today: ${new Date().toISOString().split('T')[0]}`,
      'NEVER DISCLOSE MEMORY SOURCE: When using user memories/info, NEVER say "you told me", "from memory", "you mentioned earlier", "stored in memory", "as per our previous conversation" etc. Just answer naturally as if you always knew it.',
    ];
    if (request.memories?.length) systemParts.push(`\nUser memories:\n${request.memories.map(m => `- ${m}`).join('\n')}`);
    if (request.context?.length) systemParts.push(`\nContext:\n${request.context.join('\n')}`);
    const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemParts.join('\n') }];
    if (request.history) for (const msg of request.history) messages.push({ role: msg.role, content: msg.content });
    messages.push({ role: 'user', content: request.message });
    const res = await fetch(`${OLLAMA_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: request.model || 'tinyllama', messages, stream: true, options: { temperature: request.temperature ?? 0.7, num_predict: request.max_tokens ?? 2048 } }) });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const reader = res.body?.getReader(); if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder(); let buffer = '';
    while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) { if (!line.trim()) continue; try { const chunk = JSON.parse(line); const c = chunk.message?.content || ''; if (c) yield c; if (chunk.done) return; } catch {} } }
  }

  async *streamCloud(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const body: Record<string, unknown> = { ...request, model: 'llama-3.1-8b-instant', stream: true };
    if (request.images?.length) body.images = request.images;
    if (request.history?.length) body.history = request.history;
    if (request.lat !== undefined) body.lat = request.lat;
    if (request.lon !== undefined) body.lon = request.lon;
    const headers = await authHeaders();
    const res = await fetch('/api/chat', { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) { const err = await res.text(); throw new Error(`Cloud error: ${res.status} - ${err.slice(0, 200)}`); }
    const reader = res.body?.getReader(); if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder(); let buffer = '';
    while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) { if (line.startsWith('data: ')) { const data = line.slice(6); if (data === '[DONE]') return; try { const p = JSON.parse(data); if (p.content) yield p.content; } catch {} } } }
  }

  async *offlineResponse(message: string): AsyncGenerator<string, void, unknown> {
    const text = '🤖 JARVIS needs an AI connection. Check internet or configure API keys.';
    const words = text.split(' '); for (let i = 0; i < words.length; i++) { yield (i === 0 ? '' : ' ') + words[i]; await new Promise(r => setTimeout(r, 15)); }
  }

  // --- AI-assisted auto-memory extraction (AGGRESSIVE — mandatory personal info) ---
  async extractMemories(userMessage: string, aiResponse: string, existingMemories: string[]): Promise<Array<{ content: string; category: string }>> {
    const msg = userMessage.toLowerCase();
    // Skip very short greetings/thanks only
    const skipWords = ['hello', 'hi', 'hey', 'namaste', 'नमस्ते', 'thanks', 'bye', 'ok', 'yes', 'no'];
    if (skipWords.some(w => msg === w || msg === w + '.' || msg === w + '!')) return [];

    // MANDATORY TRIGGERS: Always extract if user mentions these personal patterns
    const mandatoryPatterns = [
      /\b(my name is|i am|i'm|मैं\s+हूँ|मेरा\s+नाम|मेरी\s+उम्र|मेरी\s+पढ़ाई|मेरा\s+काम)\b/i,
      /\b(i live in|i stay at|i'm from|मैं\s+रहता|मेरा\s+शहर|मेरा\s+गाँव)\b/i,
      /\b(i study|i study in|i'm studying|मैं\s+पढ़ता|मेरा\s+कॉलेज|मेरी\s+कक्षा|मेरा\s+विषय)\b/i,
      /\b(i work|i work at|my company|my job|मेरी\s+नौकरी|मेरी\s+कंपनी)\b/i,
      /\b(my project|our project|project name|प्रोजेक्ट)\b/i,
      /\b(exam|exam date|test on|practical|viva|semester|sessional)\b/i,
      /\b(my class|my batch|my section|my roll|कक्षा|रोल|बैच)\b/i,
      /\b(my birthday|born on|जन्मदिन|जन्म\s+तिथि)\b/i,
      /\b(my phone|my email|my contact|मेरा\s+नंबर|मेरी\s+ईमेल)\b/i,
      /\b(my favorite|my fav|i like|i love|मुझे\s+पसंद|मेरा\s+पसंदीदा)\b/i,
      /\b(i have|i've got|मेरे\s+पास|mujhe|मुझे)\b/i,
      /\b(doctor|hospital|medicine|दवा|अस्पताल|डॉक्टर)\b/i,
      /\b(interview|placement|offer letter|job)\b/i,
      /\b(deadline|due date|submit by|अंतिम\s+तिथि)\b/i,
    ];
    const isMandatory = mandatoryPatterns.some(p => p.test(msg));

    // Skip pure factual questions that aren't about the user
    if (!isMandatory && /^(what|who|where|when|how|why|which|can you|could you|would you|is there|are there|do you)\b/i.test(msg.trim()) && !/\b(my|me|i am|i'm|i have|i like|i live|i study|i work|i want|i need|मेरा|मेरी|मुझे|मैं)\b/i.test(msg)) return [];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Extract personal facts about the user that are worth remembering for future conversations.

User said: "${userMessage}"
AI replied: "${aiResponse.slice(0, 300)}"
Existing memories: ${existingMemories.length > 0 ? existingMemories.join('; ') : 'none'}

Rules:
- ONLY extract facts about the USER (not general knowledge, not AI's own words)
- Skip things already in existing memories (check for semantic duplicates too)
- Skip temporary/one-time things (current weather, today's news, casual greetings, generic compliments)
- MANDATORY — ALWAYS extract these if mentioned:
  • Name, age, birthday, location (city/village/state)
  • Education: school, college, university, class, semester, branch, roll number
  • Projects: project name, technology, deadline, team, status, description
  • Exam dates, test dates, practicals, vivas, submission deadlines
  • Work: company, role, salary, interview dates, offer letters
  • Health: conditions, medications, doctor appointments
  • Family: names, relationships, events
  • Finance: bank, income, expenses, goals
  • Preferences: favorites, dislikes, habits
  • Goals, plans, important dates
  • Contact info: phone, email, social media
- Output format: one fact per line as "CATEGORY: fact" (categories: Personal, Work, Study, Health, Finance, General)
- If nothing worth remembering, output exactly: NONE`,
          stream: false, memories: existingMemories,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const text = data.content || '';
      if (text.trim() === 'NONE' || text.trim() === '') return [];
      const results: Array<{ content: string; category: string }> = [];
      const lines = text.split('\n').map(l => l.trim()).filter(l => l && l !== 'NONE');
      for (const line of lines) {
        const match = line.match(/^(Personal|Work|Study|Health|Finance|General):\s*(.+)/i);
        if (match && match[2] && match[2].length > 5 && match[2].length < 200) {
          const fact = match[2].trim();
          if (!existingMemories.some(m => m.toLowerCase().includes(fact.toLowerCase().slice(0, 15)))) {
            results.push({ content: fact, category: match[1] });
          }
        }
      }
      // Allow more extractions for mandatory content (up to 5)
      return results.slice(0, isMandatory ? 5 : 3);
    } catch { return []; }
  }

  // --- Search ---
  async webSearch(request: { query: string; count?: number }): Promise<{ results: Array<{ title: string; url: string; snippet: string }> }> {
    try {
      const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    } catch {
      return { results: [{ title: `Search: ${request.query}`, url: `https://duckduckgo.com/?q=${encodeURIComponent(request.query)}`, snippet: 'Click to view results on DuckDuckGo.' }] };
    }
  }

  // --- Vault ---
  async uploadDocument(file: File): Promise<{ id: string; chunks: number; summary: string; content?: string; imageData?: string }> {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const isTextFile = file.type.startsWith('text/') || /\.(txt|md|csv|json|py|js|ts|html|css|xml|yaml|yml|log|sh|bat|sql|java|c|cpp|h|rb|go|rs|swift|kt|jsx|tsx)$/i.test(file.name);
    if (isTextFile) {
      try {
        const content = await file.text(); const truncated = content.slice(0, 15000);
        let summary = `${file.name} — ${content.split('\n').length} lines`;
        try { const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Summarize in 2-3 sentences. File: ${file.name}\n\n${content.slice(0, 4000)}`, stream: false }) }); if (res.ok) { const d = await res.json(); if (d.content) summary = d.content; } } catch {}
        return { id, chunks: Math.ceil(content.length / 500), summary, content: truncated };
      } catch { return { id, chunks: 0, summary: `Failed to read ${file.name}` }; }
    }
    if (file.type.startsWith('image/')) {
      try {
        const imageData = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file); });
        let summary = `Image: ${file.name}`;
        try { const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Describe this image in 2-3 sentences.', images: [imageData], stream: false }) }); if (res.ok) { const d = await res.json(); if (d.content) summary = d.content; } } catch {}
        return { id, chunks: 1, summary, imageData };
      } catch { return { id, chunks: 0, summary: `Failed to read image` }; }
    }
    // PDF parsing — extract text from all pages (dynamic import to reduce bundle size)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfjs = await import('pdfjs-dist');
        // Set up worker for pdfjs v5
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), useSystemFonts: true }).promise;
        const pageTexts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          pageTexts.push(pageText);
        }
        const content = pageTexts.join('\n\n--- Page ---\n\n').slice(0, 15000);
        let summary = `PDF: ${file.name} — ${pdf.numPages} pages`;
        try { const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Summarize in 2-3 sentences. File: ${file.name}\n\n${content.slice(0, 4000)}`, stream: false }) }); if (res.ok) { const d = await res.json(); if (d.content) summary = d.content; } } catch {}
        return { id, chunks: pdf.numPages, summary, content };
      } catch (e) { console.error('PDF parse error:', e); return { id, chunks: 0, summary: `Failed to parse PDF: ${file.name}` }; }
    }
    // DOCX parsing — extract text using mammoth (dynamic import)
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
      try {
        const mammothModule = await import('mammoth');
        const mammoth = mammothModule.default || mammothModule;
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const content = result.value.slice(0, 15000);
        let summary = `DOCX: ${file.name} — ${content.split('\n').length} lines`;
        try { const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Summarize in 2-3 sentences. File: ${file.name}\n\n${content.slice(0, 4000)}`, stream: false }) }); if (res.ok) { const d = await res.json(); if (d.content) summary = d.content; } } catch {}
        return { id, chunks: Math.ceil(content.length / 500), summary, content };
      } catch (e) { console.error('DOCX parse error:', e); return { id, chunks: 0, summary: `Failed to parse DOCX: ${file.name}` }; }
    }
    return { id, chunks: 0, summary: `${file.name} — upload supported for text/code/image/PDF/DOCX files` };
  }

  async queryVault(query: string, documents: Array<{ filename: string; content?: string; imageData?: string; summary?: string }>): Promise<{ answer: string; sources: Array<{ doc: string; page: number; chunk: string }> }> {
    const docContexts: string[] = []; const sources: Array<{ doc: string; page: number; chunk: string }> = []; const images: string[] = [];
    for (const doc of documents) {
      if (doc.content && doc.content.length > 20) {
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const lines = doc.content.split('\n'); const relevant: string[] = [];
        for (let i = 0; i < lines.length; i++) { if (queryWords.some(w => lines[i].toLowerCase().includes(w))) { const s = Math.max(0, i - 3), e = Math.min(lines.length, i + 4); for (let j = s; j < e; j++) if (!relevant.includes(lines[j])) relevant.push(lines[j]); } }
        const ctx = relevant.length > 0 ? relevant.join('\n').slice(0, 3000) : doc.content.slice(0, 2000);
        docContexts.push(`=== ${doc.filename} ===\n${ctx}`); sources.push({ doc: doc.filename, page: 1, chunk: ctx.slice(0, 100) + '...' });
      }
      if (doc.imageData) { images.push(doc.imageData); sources.push({ doc: doc.filename, page: 1, chunk: 'Image' }); }
    }
    if (!docContexts.length && !images.length) return { answer: 'No readable documents found. Make sure the uploaded file has extractable text.', sources: [] };
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Answer about uploaded docs: ${query}\n\nDOCUMENT CONTEXT:\n${docContexts.join('\n\n')}`, images: images.length ? images : undefined, stream: false, memories: [] }) });
      if (res.ok) { const d = await res.json(); if (d.content) return { answer: d.content, sources }; }
    } catch {}
    return { answer: 'Could not query documents. Check connection and try again.', sources: [] };
  }

  // ========================================
  // --- Voice: MediaRecorder + SILENCE DETECTION → Groq Whisper
  // --- Tap to start speaking → auto-stops on silence → auto-transcribes → onResult(text, true)
  // ========================================
  startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    _lang?: string,
  ): (() => void) | null {
    let cancelled = false;  // Only set when truly cancelling (unmount)
    let mediaStream: MediaStream | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let audioContext: AudioContext | null = null;
    let analyserNode: AnalyserNode | null = null;
    let silenceRafId: number | null = null;
    const chunks: Blob[] = [];

    // Silence detection state
    let speechDetected = false;
    let lastSpeechTime = 0;
    let recordingStartTime = 0;
    const SPEECH_THRESHOLD = 5;     // avg freq amplitude to count as speech (lower = more sensitive)
    const SILENCE_TIMEOUT = 2000;   // ms of silence after speech → auto-stop (2s)
    const MIN_RECORD_TIME = 800;    // ms minimum before allowing auto-stop
    const MAX_RECORD_TIME = 15000;  // safety: auto-stop after 15s no matter what

    async function startRecording() {
      if (cancelled) return;

      // 1. Get mic stream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
      } catch (err: any) {
        if (cancelled) return;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          onError('🎤 Mic blocked. Click the 🔒 lock icon → Site settings → Microphone → Allow');
        } else if (err.name === 'NotFoundError') {
          onError('No microphone found. Connect a mic and try again.');
        } else {
          onError('Could not access microphone. Check browser permissions.');
        }
        return;
      }

      if (cancelled) { mediaStream.getTracks().forEach(t => t.stop()); return; }

      // 2. Set up silence detection via AudioContext + AnalyserNode
      try {
        audioContext = new AudioContext();
        await audioContext.resume();
        const source = audioContext.createMediaStreamSource(mediaStream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 512;
        analyserNode.smoothingTimeConstant = 0.4;
        source.connect(analyserNode);
        // Don't connect to destination — we only want analysis, not playback
      } catch (e) {
        console.warn('Silence detection unavailable (AudioContext):', e);
        audioContext = null;
        analyserNode = null;
      }

      // 3. Set up MediaRecorder
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      let mimeType = '';
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
      }
      if (!mimeType) mimeType = 'audio/webm';

      try {
        mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
      } catch {
        try { mediaRecorder = new MediaRecorder(mediaStream); mimeType = ''; } catch { onError('Recording not supported.'); return; }
      }

      // 4. Collect chunks
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // 5. When recording stops — transcribe via Whisper
      mediaRecorder.onstop = async () => {
        // Clean up silence detection
        if (silenceRafId !== null) cancelAnimationFrame(silenceRafId);
        if (audioContext) { try { await audioContext.close(); } catch {} audioContext = null; }
        if (cancelled) return;

        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        chunks.length = 0;
        mediaStream?.getTracks().forEach(t => t.stop());

        if (blob.size < 200) {
          onError('No audio recorded. Speak louder or closer to mic.');
          return;
        }

        // Show "processing" state
        onResult('...', false);

        // Convert to base64 and send to Whisper
        const reader = new FileReader();
        reader.onload = async () => {
          if (cancelled) return;
          try {
            const base64 = (reader.result as string).split(',')[1];

            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64, mimeType: mimeType || 'audio/webm' }),
              signal: AbortSignal.timeout(30000),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.warn('Whisper transcription failed:', errData);
              onError('Voice transcription failed. Please try again.');
              return;
            }

            const data = await res.json();
            const text = data.text?.trim() || '';

            if (text && text !== '...' && text.length > 0) {
              onResult(text, true);
            } else {
              onError('No speech detected. Try speaking louder.');
            }
          } catch (err) {
            console.error('Transcription error:', err);
            onError('Voice transcription error. Please try again.');
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.onerror = () => {
        if (!cancelled) onError('Recording error. Please try again.');
      };

      // 6. Start recording!
      recordingStartTime = Date.now();
      speechDetected = false;
      lastSpeechTime = 0;
      mediaRecorder.start(500); // Collect chunks every 500ms

      // 6b. Safety: auto-stop after MAX_RECORD_TIME no matter what
      setTimeout(() => {
        if (!cancelled && mediaRecorder?.state === 'recording') {
            // Max recording time reached — auto-stopping
          try { mediaRecorder.stop(); } catch {}
        }
      }, MAX_RECORD_TIME);

      // 7. Start silence detection loop
      if (analyserNode) {
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

        const checkAudioLevel = () => {
          if (cancelled || !mediaRecorder || mediaRecorder.state !== 'recording') return;

          analyserNode!.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;

          if (avg > SPEECH_THRESHOLD) {
            speechDetected = true;
            lastSpeechTime = Date.now();
          }

          // Auto-stop: silence after speech detected
          if (speechDetected &&
              lastSpeechTime > 0 &&
              Date.now() - lastSpeechTime > SILENCE_TIMEOUT &&
              Date.now() - recordingStartTime > MIN_RECORD_TIME) {
            // Silence detected — auto-stopping recording
            try { mediaRecorder.stop(); } catch {}
            return; // Stop the loop
          }

          silenceRafId = requestAnimationFrame(checkAudioLevel);
        };

        silenceRafId = requestAnimationFrame(checkAudioLevel);
      }
    }

    startRecording();

    // Return stop function — when called, stops recording and lets onstop process audio
    return () => {
      // Clean up silence detection
      if (silenceRafId !== null) cancelAnimationFrame(silenceRafId);
      if (audioContext) { try { audioContext.close(); } catch {} }
      // Stop the recorder — this triggers onstop which sends audio to Whisper
      try { if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); } catch {}
      // Safety: stop mic tracks after a short delay (in case onstop doesn't fire)
      setTimeout(() => { mediaStream?.getTracks().forEach(t => t.stop()); }, 500);
    };
  }

  // Called when component unmounts — truly cancel, don't process
  cancelListening(): void {
    // This is a no-op now since startListening returns its own cleanup
  }

  startListeningAuto(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    _preferredLang?: string,
  ): (() => void) | null {
    return this.startListening(onResult, onError);
  }

  // ========================================
  // --- Text-to-Voice: AIRA via Edge Neural TTS ---\
  // --- en-IN-NeerjaNeural (sweet Indian English female) ---\
  // --- hi-IN-SwaraNeural (sweet Hindi female) ---\
  // --- Fallback: browser SpeechSynthesis ---\
  // --- CHUNKED: Speaks full long responses, not just 600 chars ---\
  // ========================================
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private _speechQueue: string[] = [];
  private _isSpeakingFull = false; // true while we have chunks to speak

  // Speaking state for lip sync
  private _isSpeaking = false;
  get isSpeaking(): boolean { return this._isSpeaking; }
  private setSpeaking(val: boolean): void {
    this._isSpeaking = val;
    window.dispatchEvent(new CustomEvent('aira-speak', { detail: val }));
  }

  // Split text into speakable chunks at sentence boundaries (~800 chars each)
  private splitIntoChunks(text: string, maxChunkLen = 800): string[] {
    if (text.length <= maxChunkLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxChunkLen) {
        chunks.push(remaining.trim());
        break;
      }
      // Find a sentence boundary within maxChunkLen
      let splitAt = -1;
      // Look for sentence-ending punctuation: । . ! ? ; 
      for (let i = maxChunkLen; i > maxChunkLen * 0.4; i--) {
        const ch = remaining[i];
        if (ch === '.' || ch === '!' || ch === '?' || ch === '।' || ch === ';' || ch === '\n') {
          splitAt = i + 1;
          break;
        }
      }
      // If no sentence boundary found, try comma/colon
      if (splitAt === -1) {
        for (let i = maxChunkLen; i > maxChunkLen * 0.4; i--) {
          const ch = remaining[i];
          if (ch === ',' || ch === ':' || ch === '—' || ch === '–') {
            splitAt = i + 1;
            break;
          }
        }
      }
      // Last resort: hard split at maxChunkLen
      if (splitAt === -1) splitAt = maxChunkLen;
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt);
    }
    return chunks.filter(c => c.length > 0);
  }

  // Clean text for TTS (remove markdown, code, emojis)
  private cleanForTTS(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`[^`]+`/g, ' code ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[-*]\s/g, '')
      .replace(/[✅💾⚠️🤖🔴🎤🇮🇳🇬🇧🎙️🗣️🌙☀️🌤️🌆🏏🐍💪📡💻❌✓→←↑↓]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  speak(text: string, lang?: string): void {
    // Stop any current speech
    this.stopSpeaking();

    // Clean full text for TTS (no truncation!)
    const clean = this.cleanForTTS(text);
    if (!clean) return;

    const isHindi = lang === 'hi' || /[\u0900-\u097F]/.test(text.slice(0, 100));
    const ttsLang = isHindi ? 'hi' : 'en';

    // Split into chunks for sequential speaking
    this._speechQueue = this.splitIntoChunks(clean);
    this._isSpeakingFull = true;
    this.setSpeaking(true);

    // Start speaking the first chunk
    this._speakNextChunk(ttsLang, lang);
  }

  private _speakNextChunk(ttsLang: string, origLang?: string): void {
    if (this._speechQueue.length === 0 || !this._isSpeakingFull) {
      // All chunks done
      this._isSpeakingFull = false;
      this.setSpeaking(false);
      return;
    }

    const chunk = this._speechQueue.shift()!;
    
    // Try Edge TTS for this chunk, then browser fallback
    this.speakEdgeTTS(chunk, ttsLang).then(() => {
      // This chunk finished playing (onended already fired)
      // Speak next chunk
      if (this._isSpeakingFull) {
        this._speakNextChunk(ttsLang, origLang);
      }
    }).catch(() => {
      // Edge TTS failed for this chunk — try browser fallback for remaining text
      console.warn('Edge TTS failed, using browser SpeechSynthesis fallback for remaining text');
      const remainingText = [chunk, ...this._speechQueue].join(' ');
      this._speechQueue = [];
      this._isSpeakingFull = false;
      this.speakBrowser(remainingText, origLang);
    });
  }

  private async speakEdgeTTS(cleanText: string, lang: string): Promise<void> {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, lang }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.fallback) throw new Error('Server says fallback');
        throw new Error(`TTS error: ${res.status}`);
      }

      // Check if we got audio back
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('audio') && !contentType.includes('mpeg')) {
        throw new Error('Not audio response');
      }

      const blob = await res.blob();
      if (blob.size < 100) throw new Error('Audio too small');

      const url = URL.createObjectURL(blob);
      this.currentAudioUrl = url;

      const audio = new Audio(url);
      this.currentAudio = audio;

      // Return a promise that resolves when audio ends
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          this.currentAudio = null;
          if (this.currentAudioUrl) { URL.revokeObjectURL(this.currentAudioUrl); this.currentAudioUrl = null; }
          resolve();
        };
        audio.onerror = () => {
          this.currentAudio = null;
          if (this.currentAudioUrl) { URL.revokeObjectURL(this.currentAudioUrl); this.currentAudioUrl = null; }
          reject(new Error('Audio playback error'));
        };
        audio.play().catch(reject);
      });
    } catch (e) {
      if (this.currentAudioUrl) { URL.revokeObjectURL(this.currentAudioUrl); this.currentAudioUrl = null; }
      this.currentAudio = null;
      throw e;
    }
  }

  private speakBrowser(text: string, lang?: string): void {
    if (!('speechSynthesis' in window)) { this.setSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const isHindi = lang === 'hi' || /[\u0900-\u097F]/.test(text.slice(0, 100));
    const PREFERRED_VOICES = isHindi
      ? ['Swara', 'Lekha', 'Heera', 'hi-IN']
      : ['Heera', 'Lekha', 'Zira', 'Eva', 'en-IN', 'en-GB'];

    const voices = window.speechSynthesis.getVoices();
    const femaleVoices = voices.filter(v => {
      const n = v.name.toLowerCase();
      return !n.includes('male') && !n.includes('david') && !n.includes('mark') &&
             !n.includes('james') && !n.includes('hemant') && !n.includes('daniel');
    });

    let matched: SpeechSynthesisVoice | null = null;
    for (const pattern of PREFERRED_VOICES) {
      const lp = pattern.toLowerCase();
      matched = femaleVoices.find(v => v.name.toLowerCase().includes(lp) && !v.localService) || null;
      if (matched) break;
      matched = femaleVoices.find(v => v.name.toLowerCase().includes(lp)) || null;
      if (matched) break;
    }

    if (matched) {
      utterance.voice = matched;
    } else {
      utterance.lang = isHindi ? 'hi-IN' : 'en-IN';
      const prefix = isHindi ? 'hi' : 'en';
      matched = femaleVoices.find(v => v.lang.startsWith(prefix) && !v.localService) ||
                femaleVoices.find(v => v.lang.startsWith(prefix)) || null;
      if (matched) utterance.voice = matched;
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => this.setSpeaking(false);
    utterance.onerror = () => this.setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    // Clear queued chunks
    this._speechQueue = [];
    this._isSpeakingFull = false;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.setSpeaking(false);
  }
}

export const api = new ApiService();

// ========================================
// Math evaluator — instant local math, no API call needed
// ========================================

export function isMathQuery(text: string): boolean {
  const t = text.trim().toLowerCase();
  // Pure math: "25 * 48", "2^10", "sqrt(144)"
  if (/^[\d\s+\-*/().^%√πe,]+$/.test(t.replace(/sqrt|sin|cos|tan|log|ln|abs|pi|e\b/g, ''))) return true;
  // "calculate X", "compute X", "what is 5+3", "हिसाब 5+3"
  if (/^(calculate|compute|solve|eval|what is|what's|कितना होता है|हिसाब)\s/i.test(t)) return true;
  // "factorial of 10", "10 factorial"
  if (/factorial|factorial\s+of/i.test(t)) return true;
  // Percentage: "15% of 200"
  if (/\d+\s*%\s*of\s*\d+/i.test(t)) return true;
  return false;
}

export function evaluateMath(text: string): { result: string; isMath: boolean } {
  try {
    let expr = text.trim().toLowerCase();
    // Clean natural language wrappers
    expr = expr.replace(/^(calculate|compute|solve|eval|what is|what's|=|कितना होता है|हिसाब)\s*/i, '');
    // "factorial of 10" → "10!"
    expr = expr.replace(/factorial\s+of\s+(\d+)/gi, '$1!');
    expr = expr.replace(/(\d+)\s+factorial/gi, '$1!');
    // "15% of 200" → "15/100*200"
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/gi, '($1/100)*$2');
    // "√" → "sqrt"
    expr = expr.replace(/√/g, 'sqrt');
    // "π" → "pi"
    expr = expr.replace(/π/g, 'pi');
    // "x" → "*" for things like "25x48" (but not variable names)
    expr = expr.replace(/(\d)[x×](\d)/g, '$1*$2');
    // "^" → power
    expr = expr.replace(/\^/g, '^');
    // "!" → factorial
    if (/(\d+)!/.test(expr)) {
      const factMatch = expr.match(/(\d+)!/);
      if (factMatch) {
        const n = parseInt(factMatch[1]);
        let f = 1; for (let i = 2; i <= n; i++) f *= i;
        expr = expr.replace(/(\d+)!/, f.toString());
      }
    }

    const result = evaluate(expr);
    if (typeof result === 'number' && isFinite(result)) {
      // Format: integers stay integers, floats get 6 decimal max
      const formatted = Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(6)).toString();
      return { result: formatted, isMath: true };
    }
    return { result: '', isMath: false };
  } catch {
    return { result: '', isMath: false };
  }
}

// ========================================
// YouTube URL resolver — shared by Chat, Home, Voice
// Specific song → auto-play on YouTube (scrape API to get video ID)
// General/artist → just search page
// ========================================
export function isYouTubeGeneralQuery(query: string): boolean {
  const q = query.toLowerCase().trim();
  // Collection/artist patterns → just search, don't auto-play
  if (/\b(songs|hits|mix|playlist|collection|album|compilation|medley|tracklist)\b/i.test(q)) return true;
  if (/\b(top\s+\d|best\s+of|latest\s+songs|new\s+songs|old\s+songs|all\s+songs)\b/i.test(q)) return true;
  // Genre/category words → just search
  if (/\b(bollywood|punjabi|bhojpuri|lofi|rap|classical|devotional|ghazal|jazz|rock|pop|edm|country)\b/i.test(q)) return true;
  // Hindi general words
  if (/(गाने\s*सुनो|सब\s*गाने|संग्रह)/.test(q)) return true;
  return false;
}

export async function resolveYouTubeUrl(query: string): Promise<{ url: string; isAutoplay: boolean; title?: string }> {
  // General/artist → just search page (no API call needed)
  if (isYouTubeGeneralQuery(query)) {
    return {
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      isAutoplay: false,
    };
  }

  // Specific song → try API to find exact video, then auto-play it
  try {
    const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length > 0 && data.results[0].id) {
        return {
          // Direct video URL with autoplay — opens in new tab and plays immediately
          url: `https://www.youtube.com/watch?v=${data.results[0].id}&autoplay=1`,
          isAutoplay: true,
          title: data.results[0].title,
        };
      }
    }
  } catch {}

  // Fallback: open YouTube search page with autoplay on first result
  // YouTube search page auto-plays the first result when you click it
  return {
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    isAutoplay: false,
  };
}
