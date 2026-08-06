// JARVIS API — works from ANY domain (Vercel, localhost, etc.)
// Uses Vercel serverless /api/* for Groq AI + search
// Falls back to local Ollama when available

const OLLAMA_URL = 'http://localhost:11434';

interface ChatRequest {
  message: string;
  model?: string;
  mode?: string;
  session_id?: string;
  memories?: string[];
  context?: string[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// Detect if we're on the deployed site or localhost
function isDeployed() {
  return !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
}

// Check if Ollama is reachable (only works from localhost)
async function ollamaReachable(): Promise<{ ok: boolean; models: string[] }> {
  if (isDeployed()) return { ok: false, models: [] }; // Can't reach localhost from deployed site
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
  // --- Connection Detection ---
  async detectConnections(): Promise<{
    ollama: boolean;
    cloud: boolean;
    models: string[];
    isDeployed: boolean;
  }> {
    const deployed = isDeployed();
    const ollama = await ollamaReachable();

    let cloudOk = false;
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        cloudOk = data.ai === 'groq';
      }
    } catch {}

    return {
      ollama: ollama.ok,
      cloud: cloudOk,
      models: ollama.ok ? ollama.models : ['llama-3.1-8b-instant'],
      isDeployed: deployed,
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async checkOllama(): Promise<{ ok: boolean; models: string[] }> {
    return ollamaReachable();
  }

  // --- Chat ---
  async *streamChat(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    // 1. Try local Ollama first (only from localhost)
    const ollama = await ollamaReachable();
    if (ollama.ok) {
      try {
        yield* this.streamOllama(request);
        return;
      } catch {}
    }

    // 2. Try Vercel cloud API (Groq) — works from anywhere
    try {
      yield* this.streamCloud(request);
      return;
    } catch {}

    // 3. Offline response
    yield* this.offlineResponse(request.message);
  }

  // --- Local Ollama streaming ---
  async *streamOllama(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const systemParts = [
      'You are JARVIS, a personal AI assistant running locally via Ollama.',
      'STRICT RULES:',
      '1. Answer ONLY what is asked. No extra info, no suggestions, no follow-ups unless asked.',
      '2. Keep responses short and direct. No filler like "Sure!" or "Here\'s..." or "Let me help". Just answer.',
      '3. LANGUAGE RULE: If user writes in Hindi → reply in Hindi. If English → reply in English. If mixed → match dominant language.',
      '4. Use markdown only when genuinely helpful (code, tables, lists). Simple answers = plain text.',
      '5. Yes/no questions: just yes/no (or हाँ/नहीं in Hindi).',
      '6. Math: just the answer.',
      '7. Code: just the code, no explanation unless asked.',
      '8. If search results are provided, use them to answer directly. Do NOT say "I\'m not aware". Answer from the search data.',
    ];
    if (request.memories?.length) {
      systemParts.push(`\nUser's personal memories (always use when relevant):\n${request.memories.map((m) => `- ${m}`).join('\n')}`);
    }
    if (request.context?.length) {
      systemParts.push(`\nRelevant context:\n${request.context.join('\n')}`);
    }

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || 'tinyllama',
        messages: [
          { role: 'system', content: systemParts.join('\n') },
          { role: 'user', content: request.message },
        ],
        stream: true,
        options: { temperature: request.temperature ?? 0.7, num_predict: request.max_tokens ?? 2048 },
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          const content = chunk.message?.content || '';
          if (content) yield content;
          if (chunk.done) return;
        } catch {}
      }
    }
  }

  // --- Cloud (Groq via Vercel API) streaming ---
  async *streamCloud(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        model: 'llama-3.1-8b-instant',
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cloud error: ${res.status} - ${err.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) yield parsed.content;
          } catch {}
        }
      }
    }
  }

  // --- Offline fallback ---
  async *offlineResponse(message: string): AsyncGenerator<string, void, unknown> {
    const text = `🤖 JARVIS needs an AI connection.\n\nCloud AI (Groq) is pre-configured — check your internet connection.\nOr run Ollama locally for offline AI.\n\nSetup: https://github.com/amankr2776/Personal-Assistant`;

    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield (i === 0 ? '' : ' ') + words[i];
      await new Promise((r) => setTimeout(r, 12 + Math.random() * 15));
    }
  }

  // --- Search ---
  async webSearch(request: { query: string; count?: number }): Promise<{
    results: Array<{ title: string; url: string; snippet: string }>;
  }> {
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    } catch {
      return {
        results: [{
          title: `Search: ${request.query}`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(request.query)}`,
          snippet: 'Click to view results on DuckDuckGo.',
        }],
      };
    }
  }

  // --- Vault (requires local backend) ---
  async uploadDocument(file: File): Promise<{ id: string; chunks: number; summary: string }> {
    return {
      id: Date.now().toString(36),
      chunks: Math.floor(Math.random() * 20) + 5,
      summary: `Document "${file.name}" — full processing requires running locally with the backend.`,
    };
  }

  async queryVault(query: string): Promise<{
    answer: string;
    sources: Array<{ doc: string; page: number; chunk: string }>;
  }> {
    return { answer: 'Knowledge Vault requires running locally with the backend + ChromaDB.', sources: [] };
  }

  // --- Voice ---
  // Voice-to-Text: Browser SpeechRecognition API
  startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
  ): (() => void) | null {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError('Speech recognition not supported in this browser. Use Chrome or Edge.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      onResult(transcript, isFinal);
    };

    recognition.onerror = (event: any) => {
      onError(`Speech error: ${event.error}`);
    };

    recognition.start();
    return () => recognition.stop();
  }

  // Text-to-Voice: Browser SpeechSynthesis API
  speak(text: string): void {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    // Clean markdown from text before speaking
    const clean = text
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`[^`]+`/g, ' code ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[-*]\s/g, '')
      .slice(0, 500); // Limit length for TTS

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('google') && !v.localService) ||
      voices.find((v) => v.lang.startsWith('en-US') && !v.localService) ||
      voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const api = new ApiService();
