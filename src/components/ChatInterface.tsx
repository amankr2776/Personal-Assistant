import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, Paperclip, Bot, User, Globe, FileText, X, Volume2, Image, Film, File, Save, CheckCircle, AlertCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '../stores/useStore';
import { api, resolveYouTubeUrl, isMathQuery, evaluateMath } from '../services/api';
import { safeWindowOpen, sanitizeCommandInput, detectPromptInjection } from '../lib/url-safety';
import type { Message, AttachedFile, Reminder, TodoItem } from '../types';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function isMemoryCommand(text: string): { isMemory: boolean; content: string } {
  const patterns = [
    /^(remember|save|store|memorize|note\s*(that|down)?|yaad\s*rakh|याद\s*रख)\s*(that|this)?\s*/i,
    /^(याद\s*रखना|याद\s*रखो|सुरक्षित\s*करो|save\s*करो|याददाश्त\s*में\s*रखो)\s*/i,
  ];
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) {
      const content = text.slice(match[0].length).trim();
      return { isMemory: true, content: content || text };
    }
  }
  return { isMemory: false, content: '' };
}

function MessageBubble({ message, onSaveMemory }: { message: Message; onSaveMemory?: (text: string) => void }) {
  const isUser = message.role === 'user';
  const [saved, setSaved] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-jarvis-violet/20' : 'bg-jarvis-cyan/20'}`}>
        {isUser ? <User size={16} className="text-jarvis-violet" /> : <Bot size={16} className="text-jarvis-cyan" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'text-right' : 'text-left'}`}>
        {message.attachedFiles && message.attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
            {message.attachedFiles.map((f, i) => (
              <span key={i} className="text-[10px] bg-jarvis-border/50 text-jarvis-muted px-2 py-0.5 rounded flex items-center gap-1">
                {f.type.startsWith('image/') ? <Image size={10} /> : f.type.startsWith('video/') ? <Film size={10} /> : <File size={10} />}
                {f.name}
              </span>
            ))}
          </div>
        )}
        <div className={`rounded-xl px-4 py-3 ${isUser ? 'bg-jarvis-violet/10 border border-jarvis-violet/20' : 'bg-jarvis-surface border border-jarvis-border'}`}>
          {isUser ? (
            <p className="text-sm text-jarvis-text whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="markdown-content text-sm">
              <ReactMarkdown components={{ code({ className, children, ...props }) { const match = /language-(\w+)/.exec(className || ''); const isInline = !match; return !isInline ? <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" className="!bg-jarvis-bg !border-jarvis-border !rounded-lg !text-xs">{String(children).replace(/\n$/, '')}</SyntaxHighlighter> : <code className={className} {...props}>{children}</code>; } }}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.sources.map((source, i) => (
              <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 hover:border-jarvis-cyan/30 transition-colors group">
                <Globe size={12} className="text-jarvis-cyan" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-jarvis-text truncate group-hover:text-jarvis-cyan transition-colors">{source.title}</p>
                  <p className="text-[10px] text-jarvis-muted truncate">{source.snippet}</p>
                </div>
              </a>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <p className="text-[10px] text-jarvis-muted">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          {!isUser && message.content && (
            <>
              <button onClick={() => api.speak(message.content)} className="text-[10px] text-jarvis-muted hover:text-jarvis-cyan flex items-center gap-0.5 transition-colors"><Volume2 size={10} />Speak</button>
              {!isUser && (
                <button onClick={async () => { const clean = message.content.replace(/```[\s\S]*?```/g,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/[#*_\[\]]/g,''); if (navigator.share) { try { await navigator.share({ title: 'Aira Response', text: clean }); } catch {} } else { await navigator.clipboard.writeText(clean); } }} className="text-[10px] text-jarvis-muted hover:text-jarvis-cyan flex items-center gap-0.5 transition-colors"><Globe size={10} />Share</button>
              )}
              {onSaveMemory && !saved && (
                <button onClick={() => { onSaveMemory(message.content); setSaved(true); }} className="text-[10px] text-jarvis-muted hover:text-jarvis-success flex items-center gap-0.5 transition-colors"><Save size={10} />Save</button>
              )}
              {saved && <span className="text-[10px] text-jarvis-success flex items-center gap-0.5"><CheckCircle size={10} />Saved</span>}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [memoryToast, setMemoryToast] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  // Ref to track if we're already sending (prevents double-send)
  const isSendingRef = useRef(false);
  // Cached user location from Geolocation API (for location-aware weather)
  const userLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  // Request geolocation once on mount (for location-aware weather)
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { userLocationRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude }; },
      () => { /* User denied or unavailable — just skip */ },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }, []);

  const {
    sessions, activeSessionId, createSession, addMessage, isStreaming, streamingContent,
    setStreaming, setStreamingContent, updateLastAssistantMessage, activeModel, memories, addMemory,
  } = useStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingContent]);
  useEffect(() => { if (micError) { const t = setTimeout(() => setMicError(''), 7000); return () => clearTimeout(t); } }, [micError]);
  useEffect(() => { if (memoryToast) { const t = setTimeout(() => setMemoryToast(''), 3000); return () => clearTimeout(t); } }, [memoryToast]);

  const saveToMemory = useCallback((content: string, category?: string) => {
    addMemory({ id: generateId(), content: content.slice(0, 500), category: category || 'General', createdAt: Date.now(), updatedAt: Date.now() });
    setMemoryToast('💾 Saved to memory!');
  }, [addMemory]);

  const buildConversationHistory = useCallback((): Array<{ role: 'user' | 'assistant'; content: string }> => {
    const session = useStore.getState().sessions.find(s => s.id === useStore.getState().activeSessionId);
    if (!session) return [];
    return session.messages.filter(m => m.content.trim()).slice(-20).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 500) }));
  }, []);

  // Core send function — can be called from text input OR voice
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isSendingRef.current) return;
    isSendingRef.current = true;

    const state = useStore.getState();
    let sessionId = state.activeSessionId;
    if (!sessionId) sessionId = state.createSession();

    // Math evaluation — instant, no API call
    if (isMathQuery(text)) {
      const { result, isMath } = evaluateMath(text);
      if (isMath && result) {
        state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
        state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `🧮 **${result}**`, timestamp: Date.now() });
        isSendingRef.current = false;
        return;
      }
    }

    // Smart command: lowerText for matching
    const lowerText = text.toLowerCase().trim();

    // Translate command — "translate X to Y" / "X का Y में अनुवाद" / "anuvad" / "अनुवाद"
    const translateMatch = lowerText.match(/^(?:translate|anuvad|अनुवाद)\s+(.+?)(?:\s+(?:to|in|में|का)\s+(\w+))?$/i)
      || lowerText.match(/^(.+(?:का|की))\s+(?:अनुवाद|anuvad)\s+(?:में|in|to)?\s*(\w+)?$/i);
    if (translateMatch) {
      const srcText = translateMatch[1].trim();
      const targetLang = (translateMatch[2] || '').toLowerCase();
      // Detect langpair
      let langpair = 'en|hi'; // default: English → Hindi
      if (/hi|hindi|हिंदी/.test(targetLang)) langpair = 'en|hi';
      else if (/en|english|अंग्रेजी/.test(targetLang)) langpair = 'hi|en';
      else if (/fr|french/.test(targetLang)) langpair = 'en|fr';
      else if (/de|german/.test(targetLang)) langpair = 'en|de';
      else if (/es|spanish/.test(targetLang)) langpair = 'en|es';
      else if (/ja|japanese/.test(targetLang)) langpair = 'en|ja';
      else if (/zh|chinese/.test(targetLang)) langpair = 'en|zh';
      else if (/ar|arabic/.test(targetLang)) langpair = 'en|ar';
      // Auto-detect source: if text has Devanagari, flip default
      else if (/[\u0900-\u097F]/.test(srcText)) langpair = 'hi|en';

      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      try {
        const res = await fetch(`/api/translate?q=${encodeURIComponent(srcText)}&langpair=${langpair}`, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json();
          if (data.translated && data.translated !== srcText) {
            state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `🌐 **${data.translated}**`, timestamp: Date.now() });
          } else {
            state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `⚠️ Could not translate. Try: "translate hello to hindi"`, timestamp: Date.now() });
          }
        } else {
          state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `⚠️ Translation service unavailable.`, timestamp: Date.now() });
        }
      } catch {
        state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `⚠️ Translation failed. Check connection.`, timestamp: Date.now() });
      }
      isSendingRef.current = false;
      return;
    }

    // Smart command detection — redirect to services
    // "play X", "listen to X", "gaana X", "गाना X" → YouTube: auto-play in new tab
    const playMatch = lowerText.match(/^(play|listen\s+to|gaana|गाना|चलाओ|play\s+song|play\s+video|सुनो|chalao|बजाओ|चलाओ)\s+(.+)/i) ||
                       lowerText.match(/\b(play|चलाओ|बजाओ|सुनो|gaana|गाना)\s+(.+)/i);
    if (playMatch) {
      const searchQuery = playMatch[2].trim();
      try {
        const { url: ytUrl, isAutoplay, title } = await resolveYouTubeUrl(searchQuery);
        const opened = safeWindowOpen(ytUrl);
        state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
        const msg = opened
          ? (isAutoplay ? `🎵 Playing **${title || searchQuery}** on YouTube...` : `🎵 Searching YouTube for "${searchQuery}"...`)
          : `🎵 YouTube: [${title || searchQuery}](${ytUrl})`;
        state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: msg, timestamp: Date.now() });
      } catch {
        // Fallback — just open search
        const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        safeWindowOpen(ytUrl);
        state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
        state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `🎵 Searching YouTube for "${searchQuery}"...`, timestamp: Date.now() });
      }
      isSendingRef.current = false;
      return;
    }
    // "github" / "my github" / any mention → open profile
    if (/\b(github|गिटहब)\b/i.test(lowerText) || /^(my\s+repos|my\s+code|my\s+profile)/i.test(lowerText)) {
      const url = 'https://github.com/amankr2776';
      const opened = safeWindowOpen(url);
      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: opened ? `💻 Opening your GitHub profile...` : `💻 GitHub profile: ${url} (popup blocked — click the link)`, timestamp: Date.now() });
      isSendingRef.current = false;
      return;
    }
    // "linkedin" / any mention → open profile (also check memory for custom URL)
    if (/\b(linkedin|लिंक्डइन)\b/i.test(lowerText)) {
      // Try to find LinkedIn URL from memory first
      const linkedInMem = state.memories.find(m => m.content.toLowerCase().includes('linkedin.com/in/'));
      const linkedInMatch = linkedInMem?.content.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/);
      const url = linkedInMatch ? linkedInMatch[0] : 'https://linkedin.com/in/amankr2776';
      const opened = safeWindowOpen(url);
      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: opened ? `🔗 Opening your LinkedIn profile...` : `🔗 LinkedIn profile: ${url} (popup blocked — click the link)`, timestamp: Date.now() });
      isSendingRef.current = false;
      return;
    }
    // "remind me at X to Y" / "remind Y at X" / "याद दिलाना X पर Y"
    const remindMatch = lowerText.match(/^(?:remind\s+(?:me\s+)?|याद\s*दिलाना?\s+)(.+?)(?:\s+(?:at|by|on|पर|को)\s+(.+))?$/i)
      || lowerText.match(/^(?:remind\s+(?:me\s+)?at\s+(.+?)\s+to\s+(.+))$/i);
    if (remindMatch) {
      const rText = remindMatch[1] || text;
      const rTimeStr = remindMatch[2] || '';
      // Parse time
      let rTime = Date.now() + 3600000; // default 1 hour
      const inM = (rTimeStr || lowerText).match(/in\s+(\d+)\s*(min|hr|hour)/i);
      const atM = (rTimeStr || '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (inM) { rTime = Date.now() + parseInt(inM[1]) * (inM[2].startsWith('hr') ? 3600000 : 60000); }
      else if (atM) {
        let h = parseInt(atM[1]); const m = parseInt(atM[2] || '0'); const ap = atM[3]?.toLowerCase();
        if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
        const d = new Date(); d.setHours(h, m, 0, 0);
        if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
        rTime = d.getTime();
      }
      const reminder: Reminder = { id: generateId(), text: rText.replace(/^(to\s+)/i, ''), time: rTime, isRepeating: false, isDone: false, createdAt: Date.now() };
      state.addReminder(reminder);
      const timeStr = new Date(rTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `⏰ Reminder set! I'll remind you **"${reminder.text}"** at ${timeStr}.`, timestamp: Date.now() });
      isSendingRef.current = false;
      return;
    }
    // "add todo/task: X" / "add task X" / "टास्क जोड़ो X"
    const todoMatch = lowerText.match(/^(?:add\s+(?:todo|task)[:\s]+|add\s+todo\s+|टास्क\s*जोड़ो?\s+)(.+)/i);
    if (todoMatch) {
      const todo: TodoItem = { id: generateId(), text: todoMatch[1].trim(), done: false, priority: 'medium', category: 'General', createdAt: Date.now() };
      state.addTodo(todo);
      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `✅ Task added: **"${todo.text}"**`, timestamp: Date.now() });
      isSendingRef.current = false;
      return;
    }
    // "show reminders" / "my reminders" / "मेरे रिमाइंडर"
    if (/\b(show|my|list)\s*(?:reminders?|alarms?)\b/i.test(lowerText) || /मेरे?\s*रिमाइंडर/.test(lowerText)) {
      const pending = state.reminders.filter(r => !r.isDone);
      const msg = pending.length > 0
        ? `⏰ Your reminders:\n${pending.map((r, i) => `${i + 1}. ${r.text} — ${new Date(r.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`).join('\n')}`
        : 'No active reminders.';
      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: msg, timestamp: Date.now() });
      isSendingRef.current = false;
      return;
    }
    // "show todos/tasks" / "my tasks" / "मेरे टास्क"
    if (/\b(show|my|list)\s*(?:todos?|tasks?)\b/i.test(lowerText) || /मेरे?\s*टास्क/.test(lowerText)) {
      const pending = state.todos.filter(t => !t.done);
      const msg = pending.length > 0
        ? `📋 Your tasks:\n${pending.map((t, i) => `${i + 1}. ${t.text} [${t.priority}]`).join('\n')}`
        : 'No pending tasks.';
      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: msg, timestamp: Date.now() });
      isSendingRef.current = false;
      return;
    }
    // "run code" / "code editor" / "open code" / "कोड" → switch to code panel
    if (/^(run\s+code|code\s+editor|open\s+code|code\s+runner|कोड\s+एडिटर|कोड\s+चलाओ|code\s+panel)/i.test(lowerText) || /^(code|कोड)$/i.test(lowerText)) {
      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `💻 Opening Code Execution panel!`, timestamp: Date.now() });
      useStore.getState().setActivePanel('code');
      isSendingRef.current = false;
      return;
    }
    // "draw X" / "generate image X" / "चित्र बनाओ X" → image generator
    const drawMatch = lowerText.match(/^(?:generate\s+image|draw|create\s+image|make\s+image|चित्र\s*बनाओ|तस्वीर\s*बनाओ|image\s+gen)\s+(.+)/i);
    if (drawMatch) {
      const imagePrompt = drawMatch[1].trim();
      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `🎨 Generating image: **"${imagePrompt}"** — opening Image Generator...`, timestamp: Date.now() });
      useStore.getState().setActivePanel('images');
      isSendingRef.current = false;
      return;
    }

    // Check explicit "remember" command
    const { isMemory, content: memoryContent } = isMemoryCommand(text);
    if (isMemory && memoryContent) {
      saveToMemory(memoryContent);
      state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
      state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: `✅ Saved to memory: "${memoryContent.slice(0, 100)}"`, timestamp: Date.now() });
      isSendingRef.current = false;
      return;
    }

    let enhancedMessage = text;
    const imageDataURIs: string[] = [];
    const fileParts: string[] = [];

    state.addMessage(sessionId, { id: generateId(), role: 'user', content: text, timestamp: Date.now() });
    state.addMessage(sessionId, { id: generateId(), role: 'assistant', content: '', timestamp: Date.now() });

    const model = state.activeModel || 'llama-3.1-8b-instant';
    state.setStreaming(true); state.setStreamingContent('');
    let fullContent = '';
    const memoryContext = state.memories.map((m) => `${m.category}: ${m.content}`);
    const history = buildConversationHistory();

    try {
      for await (const chunk of api.streamChat({
        message: enhancedMessage, model, mode: 'cloud', memories: memoryContext,
        temperature: 0.7, max_tokens: 4096,
        images: imageDataURIs.length > 0 ? imageDataURIs : undefined,
        history,
        lat: userLocationRef.current?.lat,
        lon: userLocationRef.current?.lon,
      })) {
        fullContent += chunk; state.setStreamingContent(fullContent); state.updateLastAssistantMessage(sessionId, fullContent);
      }
    } catch (error) {
      fullContent += '\n\n⚠️ Connection error. Please try again.';
      state.updateLastAssistantMessage(sessionId, fullContent);
    }
    state.setStreaming(false); state.setStreamingContent('');

    // AUTO-SPEAK the AI response
    if (fullContent) {
      const isHindi = /[\u0900-\u097F]/.test(fullContent.slice(0, 100));
      api.speak(fullContent, isHindi ? 'hi' : 'en');
    }

    // AI-assisted auto-memory extraction
    if (text.length > 5 && fullContent.length > 10) {
      const currentMemories = useStore.getState().memories.map(m => `${m.category}: ${m.content}`);
      api.extractMemories(text, fullContent, currentMemories).then(extracted => {
        if (extracted.length > 0) {
          for (const mem of extracted) {
            const { addMemory: addMem } = useStore.getState();
            addMem({ id: generateId(), content: mem.content.slice(0, 500), category: mem.category, createdAt: Date.now(), updatedAt: Date.now() });
          }
          setMemoryToast(`💾 Auto-saved ${extracted.length} fact${extracted.length > 1 ? 's' : ''} to memory!`);
        }
      }).catch(() => {});
    }

    isSendingRef.current = false;
  }, [saveToMemory, buildConversationHistory]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    setAttachedFiles([]);
    await sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newFiles: AttachedFile[] = [];
    for (const file of Array.from(files)) {
      const af: AttachedFile = { name: file.name, type: file.type, size: file.size };
      if (file.type.startsWith('text/') || /\.(txt|md|csv|json|py|js|ts|html|css|xml|yaml|yml|log|sh|bat|sql|java|c|cpp|h|rb|go|rs|swift|kt|jsx|tsx)$/i.test(file.name)) {
        try { af.content = await file.text(); } catch {}
      } else if (file.type.startsWith('image/')) {
        try { af.content = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); }); } catch {}
      }
      newFiles.push(af);
    }
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  }

  function toggleMic() {
    setMicError('');
    if (micActive) {
      // User tapped to manually stop → stop recording, audio will be processed
      stopListeningRef.current?.();
      stopListeningRef.current = null;
      setMicActive(false);
      return;
    }
    setMicActive(true);

    const stop = api.startListeningAuto(
      (text, isFinal) => {
        if (isFinal && text && text !== '...') {
          // Transcription complete → AUTO-SEND, no manual step
          setMicActive(false);
          stopListeningRef.current = null;
          setInput(text);
          sendMessage(text);
        } else if (!isFinal && text) {
          // Interim result — show in input field
          setInput(text);
        }
      },
      (error) => {
        setMicActive(false);
        stopListeningRef.current = null;
        if (error) setMicError(error);
      },
    );

    if (!stop) { setMicActive(false); setMicError('Voice not available. Type your message instead.'); return; }
    stopListeningRef.current = stop;
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <AnimatePresence>
        {memoryToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 right-4 z-10 bg-jarvis-success/20 border border-jarvis-success/30 text-jarvis-success text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
          >
            <CheckCircle size={12} /> {memoryToast}
          </motion.div>
        )}
        {micError && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-500/20 border border-red-500/30 text-red-400 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 max-w-[90%]"
          >
            <AlertCircle size={14} className="flex-shrink-0" /> <span>{micError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {!activeSession && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
            <Bot size={48} className="text-jarvis-cyan/30 mx-auto mb-4" />
            <p className="text-jarvis-text text-lg font-heading font-semibold">Start a conversation</p>
            <p className="text-jarvis-muted text-sm mt-1 mb-4">Type, speak, or attach files</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={() => setInput('What can you do?')} className="text-xs bg-jarvis-cyan/10 text-jarvis-cyan border border-jarvis-cyan/20 rounded-lg px-3 py-1.5 hover:bg-jarvis-cyan/20 transition-colors">What can you do?</button>
              <button onClick={() => setInput('Write a Python function to sort a list')} className="text-xs bg-jarvis-violet/10 text-jarvis-violet border border-jarvis-violet/20 rounded-lg px-3 py-1.5 hover:bg-jarvis-violet/20 transition-colors">Write code</button>
              <button onClick={() => setInput('पटना का मौसम कैसा है?')} className="text-xs bg-jarvis-success/10 text-jarvis-success border border-jarvis-success/20 rounded-lg px-3 py-1.5 hover:bg-jarvis-success/20 transition-colors">पटना मौसम</button>
            </div>
          </motion.div>
        </div>
      )}

      {activeSession && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => <MessageBubble key={msg.id} message={msg} onSaveMemory={saveToMemory} />)}
          {isStreaming && (
            <div className="flex items-center gap-2 px-4">
              <motion.div className="w-2 h-2 rounded-full bg-jarvis-cyan" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
              <span className="text-xs text-jarvis-muted">Generating...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="border-t border-jarvis-border p-4">
        <AnimatePresence>
          {attachedFiles.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2 mb-3">
              {attachedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5">
                  {file.type.startsWith('image/') ? <Image size={14} className="text-green-400" /> : <FileText size={14} className="text-jarvis-cyan" />}
                  <span className="text-xs text-jarvis-text">{file.name}</span>
                  {file.content && <span className="text-[10px] text-jarvis-success">✓</span>}
                  <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))} className="text-jarvis-muted hover:text-jarvis-error"><X size={12} /></button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {micActive && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 mb-2 px-1">
              <motion.div className="w-2 h-2 rounded-full bg-red-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />
              <span className="text-xs text-red-400">🔴 Listening... speak now, auto-sends when you stop</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="btn-icon" title="Attach files"><Paperclip size={18} /></button>
          <input ref={fileInputRef} type="file" multiple onChange={handleFileAttach} className="hidden" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mp3,.wav,.csv,.json,.py,.js,.ts,.html,.css,.md,.xlsx,.pptx,.zip" />
          <div className="flex-1 relative">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={micActive ? "🔴 Listening..." : "Ask JARVIS anything..."}
              rows={1}
              className={`w-full bg-jarvis-bg border ${micActive ? 'border-red-500/60 ring-1 ring-red-500/20' : 'border-jarvis-border'} rounded-xl px-4 py-3 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 focus:outline-none focus:border-jarvis-cyan/40 focus:ring-1 focus:ring-jarvis-cyan/20 resize-none max-h-32 transition-colors`}
              style={{ minHeight: '44px' }}
            />
          </div>
          <button onClick={toggleMic} className={`btn-icon relative ${micActive ? 'text-red-400 bg-red-400/10' : ''}`} title={micActive ? 'Tap to stop recording' : 'Tap to speak — auto-sends when you stop'}>
            {micActive ? (
              <>
                <Mic size={18} />
                <motion.div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />
              </>
            ) : <MicOff size={18} />}
          </button>
          <button onClick={handleSend} disabled={!input.trim() || isStreaming} className={`btn-icon ${input.trim() && !isStreaming ? 'text-jarvis-cyan hover:bg-jarvis-cyan/10' : 'opacity-50 cursor-not-allowed'}`}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
