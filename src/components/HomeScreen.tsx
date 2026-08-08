import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Sparkles, Brain, Search, FileText, Volume2, X, Save, CheckCircle } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { api, resolveYouTubeUrl, isMathQuery, evaluateMath } from '../services/api';
import { safeWindowOpen } from '../lib/url-safety';
import AiraCharacter from './AiraCharacter';
import ReactMarkdown from 'react-markdown';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return { text: 'Good Night', emoji: '🌙' };
  if (hour < 12) return { text: 'Good Morning', emoji: '☀️' };
  if (hour < 18) return { text: 'Good Afternoon', emoji: '🌤️' };
  return { text: 'Good Evening', emoji: '🌆' };
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function HomeScreen() {
  const { createSession, setActivePanel, memories, addMemory } = useStore();
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  // Cached user location from Geolocation API (for location-aware weather)
  const userLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  // Request geolocation once on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { userLocationRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude }; },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }, []);
  const [time, setTime] = useState(formatTime());
  const [memoryToast, setMemoryToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const isAskingRef = useRef(false);

  const greeting = getGreeting();

  useEffect(() => {
    const iv = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (memoryToast) { const t = setTimeout(() => setMemoryToast(''), 3000); return () => clearTimeout(t); }
  }, [memoryToast]);

  // Ask JARVIS directly — can be called from text input OR voice
  async function handleAsk(q?: string) {
    const question = (q || query).trim();
    if (!question || isAskingRef.current) return;

    // Smart command detection — redirect to services
    const lowerQ = question.toLowerCase().trim();
    // "play X", "listen to X", "gaana X", "गाना X", "सुनो X" → YouTube: auto-play in new tab
    const playMatch = lowerQ.match(/^(play|listen\s+to|gaana|गाना|चलाओ|play\s+song|play\s+video|सुनो|chalao|बजाओ|चलाओ)\s+(.+)/i) ||
                       lowerQ.match(/\b(play|चलाओ|बजाओ|सुनो|gaana|गाना)\s+(.+)/i);
    if (playMatch) {
      const searchQuery = playMatch[2].trim();
      setIsThinking(true);
      try {
        const { url: ytUrl, isAutoplay, title } = await resolveYouTubeUrl(searchQuery);
        const opened = safeWindowOpen(ytUrl);
        if (!opened) setAnswer(`🎵 YouTube: [${ytUrl}](${ytUrl}) (popup blocked — allow popups)`);
        else if (isAutoplay) setAnswer(`🎵 Playing **${title || searchQuery}** on YouTube...`);
        else setAnswer(`🎵 Searching YouTube for "${searchQuery}"...`);
      } catch {
        const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        safeWindowOpen(ytUrl);
        setAnswer(`🎵 Searching YouTube for "${searchQuery}"...`);
      }
      setIsThinking(false);
      return;
    }
    // "github" / any mention → open GitHub profile
    if (/\b(github|गिटहब)\b/i.test(lowerQ) || /^(my\s+repos|my\s+code|my\s+profile)/i.test(lowerQ)) {
      const url = 'https://github.com/amankr2776';
      const opened = safeWindowOpen(url);
      if (!opened) {
        setAnswer(`💻 GitHub profile: ${url}\n(Popup blocked — allow popups or click the link)`);
      }
      return;
    }
    // "linkedin" / any mention → open LinkedIn profile
    if (/\b(linkedin|लिंक्डइन)\b/i.test(lowerQ)) {
      const linkedInMem = memories.find(m => m.content.toLowerCase().includes('linkedin.com/in/'));
      const linkedInMatch = linkedInMem?.content.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/);
      const url = linkedInMatch ? linkedInMatch[0] : 'https://linkedin.com/in/amankr2776';
      const opened = safeWindowOpen(url);
      if (!opened) {
        setAnswer(`🔗 LinkedIn profile: ${url}\n(Popup blocked — allow popups or click the link)`);
      }
      return;
    }
    isAskingRef.current = true;
    setQuery(question);
    setIsThinking(true);
    setAnswer('');

    // Math evaluation — instant, no API call
    if (isMathQuery(question)) {
      const { result, isMath } = evaluateMath(question);
      if (isMath && result) {
        setIsThinking(false);
        isAskingRef.current = false;
        setAnswer(`🧮 **${result}**`);
        return;
      }
    }

    const memoryContext = useStore.getState().memories.map(m => `${m.category}: ${m.content}`);
    let full = '';
    try {
      for await (const chunk of api.streamChat({
        message: question, model: 'llama-3.1-8b-instant', mode: 'cloud',
        memories: memoryContext, temperature: 0.7, max_tokens: 2048,
        lat: userLocationRef.current?.lat,
        lon: userLocationRef.current?.lon,
      })) {
        full += chunk;
        setAnswer(full);
      }
    } catch {
      full = '⚠️ Connection error. Please try again.';
      setAnswer(full);
    }
    setIsThinking(false);
    isAskingRef.current = false;

    // AUTO-SPEAK the response (Aira will lip-sync via the event system)
    if (full) {
      const isHindi = /[\u0900-\u097F]/.test(full.slice(0, 100));
      api.speak(full, isHindi ? 'hi' : 'en');
    }

    // AI-assisted auto-memory extraction (same as ChatInterface)
    if (question.length > 5 && full.length > 10) {
      const currentMemories = useStore.getState().memories.map(m => `${m.category}: ${m.content}`);
      api.extractMemories(question, full, currentMemories).then(extracted => {
        if (extracted.length > 0) {
          for (const mem of extracted) {
            const { addMemory: addMem } = useStore.getState();
            addMem({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9), content: mem.content.slice(0, 500), category: mem.category, createdAt: Date.now(), updatedAt: Date.now() });
          }
          setMemoryToast(`💾 Auto-saved ${extracted.length} fact${extracted.length > 1 ? 's' : ''} to memory!`);
        }
      }).catch(() => {});
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAsk(); }
  }

  // Mic button on Aira character — tap to start, auto-stops on silence
  function handleMicClick() {
    if (isRecording) {
      stopListeningRef.current?.();
      stopListeningRef.current = null;
      setIsRecording(false);
      return;
    }
    setIsRecording(true);
    setQuery('');
    setAnswer('');

    const stop = api.startListeningAuto(
      (text, isFinal) => {
        if (isFinal && text && text !== '...') {
          setIsRecording(false);
          stopListeningRef.current = null;
          setQuery(text);
          handleAsk(text);
        } else if (!isFinal && text) {
          setQuery(text);
        }
      },
      (error) => {
        setIsRecording(false);
        stopListeningRef.current = null;
      },
    );
    if (!stop) { setIsRecording(false); return; }
    stopListeningRef.current = stop;
  }

  const quickChips = [
    { label: 'पटना मौसम', emoji: '🌤️' },
    { label: 'Play Arijit Singh', emoji: '🎵' },
    { label: 'Write Python code', emoji: '🐍' },
    { label: 'Motivation कैसे रखें?', emoji: '💪' },
    { label: 'My GitHub', emoji: '💻' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6 relative overflow-hidden">
      {/* Cinematic ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,217,255,0.3), transparent),
            radial-gradient(ellipse 60% 80% at 30% 70%, rgba(124,58,237,0.2), transparent),
            radial-gradient(ellipse 50% 50% at 80% 30%, rgba(0,217,255,0.15), transparent)`,
        }} />
        <motion.div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #00D9FF, transparent 70%)', top: '10%', left: '50%', x: '-50%' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.05, 0.03] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.02]"
          style={{ background: 'radial-gradient(circle, #7C3AED, transparent 70%)', bottom: '10%', right: '10%' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.02, 0.04, 0.02] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(0,217,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,255,1) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }} />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
        {/* Memory auto-save toast */}
        <AnimatePresence>
          {memoryToast && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 right-0 z-20 bg-jarvis-success/20 border border-jarvis-success/30 text-jarvis-success text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
            >
              <CheckCircle size={12} /> {memoryToast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clock */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="mb-4 text-center">
          <p className="font-mono text-4xl font-light text-jarvis-text tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {time}
          </p>
          <p className="text-xs text-jarvis-muted mt-1 tracking-wide">{formatDate()}</p>
        </motion.div>

        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6 text-center">
          <h1 className="font-heading text-xl font-bold text-jarvis-text flex items-center justify-center gap-2">
            <span className="text-2xl">{greeting.emoji}</span>
            <span>{greeting.text}, <span className="text-jarvis-cyan">Aman</span></span>
          </h1>
          {memories.length > 0 && (
            <p className="text-[10px] text-jarvis-muted/60 mt-1">{memories.length} memories loaded</p>
          )}
        </motion.div>

        {/* AIRA CHARACTER with lip sync + mic button */}
        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.3 }}
          className="mb-6">
          <AiraCharacter
            isListening={isRecording}
            isThinking={isThinking}
            onMicClick={handleMicClick}
            size={220}
          />
        </motion.div>

        {/* Ask JARVIS input */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
          className="w-full mb-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-jarvis-cyan/20 via-jarvis-violet/10 to-jarvis-cyan/20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity blur-sm" />
            <div className="relative flex items-center gap-2 bg-jarvis-surface/80 backdrop-blur-sm border border-jarvis-border rounded-2xl px-5 py-3.5 group-focus-within:border-jarvis-cyan/30 transition-colors">
              <Sparkles size={18} className="text-jarvis-cyan/50 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Aira anything..."
                className="flex-1 bg-transparent text-sm text-jarvis-text placeholder:text-jarvis-muted/40 focus:outline-none"
              />
              <button onClick={() => handleAsk()} disabled={!query.trim() || isThinking}
                className={`flex-shrink-0 ${query.trim() && !isThinking ? 'text-jarvis-cyan hover:bg-jarvis-cyan/10' : 'text-jarvis-muted/30'} transition-colors p-1 rounded-lg`}>
                {isThinking ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Bot size={18} />
                  </motion.div>
                ) : <Send size={18} />}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Answer display */}
        <AnimatePresence>
          {(answer || isThinking) && (
            <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -10, height: 0 }}
              className="w-full mb-4 overflow-hidden">
              <div className="bg-jarvis-surface/60 backdrop-blur-sm border border-jarvis-border rounded-2xl px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={14} className="text-jarvis-cyan" />
                  <span className="text-xs text-jarvis-cyan font-medium">Aira</span>
                  {isThinking && (
                    <motion.div className="flex gap-1 ml-1">
                      {[0,1,2].map(i => (
                        <motion.div key={i} className="w-1 h-1 rounded-full bg-jarvis-cyan"
                          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </motion.div>
                  )}
                </div>
                <div className="markdown-content text-sm text-jarvis-text max-h-48 overflow-y-auto">
                  <ReactMarkdown>{answer || ' '}</ReactMarkdown>
                </div>
                {!isThinking && answer && (
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-jarvis-border/50">
                    <button onClick={() => { const isHindi = /[\u0900-\u097F]/.test(answer.slice(0,100)); api.speak(answer, isHindi?'hi':'en'); }} className="text-[10px] text-jarvis-muted hover:text-jarvis-cyan flex items-center gap-1 transition-colors">
                      <Volume2 size={12} />Speak
                    </button>
                    <button onClick={() => { addMemory({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,9), content: answer.slice(0, 500), category: 'General', createdAt: Date.now(), updatedAt: Date.now() }); setMemoryToast('💾 Saved to memory!'); }} className="text-[10px] text-jarvis-muted hover:text-jarvis-success flex items-center gap-1 transition-colors">
                      <Save size={12} />Save
                    </button>
                    <button onClick={() => { setQuery(''); setAnswer(''); }} className="text-[10px] text-jarvis-muted hover:text-jarvis-error flex items-center gap-1 transition-colors">
                      <X size={12} />Clear
                    </button>
                    <button onClick={() => { createSession(); setQuery(''); setAnswer(''); }} className="text-[10px] text-jarvis-muted hover:text-jarvis-cyan flex items-center gap-1 transition-colors">
                      <Send size={12} />Continue in Chat
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick action chips */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {quickChips.map((chip) => (
            <motion.button key={chip.label} whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}
              onClick={() => handleAsk(chip.label)}
              className="bg-jarvis-surface/50 border border-jarvis-border/50 rounded-xl px-3.5 py-2 flex items-center gap-2 hover:border-jarvis-cyan/20 transition-all cursor-pointer backdrop-blur-sm">
              <span className="text-sm">{chip.emoji}</span>
              <span className="text-xs text-jarvis-text/80 font-medium">{chip.label}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Bottom nav */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="flex items-center gap-4">
          <button onClick={() => setActivePanel('chat')} className="flex items-center gap-1.5 text-xs text-jarvis-muted/50 hover:text-jarvis-cyan transition-colors">
            <Brain size={13} /> Chat
          </button>
          <button onClick={() => setActivePanel('vault')} className="flex items-center gap-1.5 text-xs text-jarvis-muted/50 hover:text-jarvis-cyan transition-colors">
            <FileText size={13} /> Vault
          </button>
          <button onClick={() => setActivePanel('memory')} className="flex items-center gap-1.5 text-xs text-jarvis-muted/50 hover:text-jarvis-cyan transition-colors">
            <Search size={13} /> Memory
          </button>
        </motion.div>
      </div>
    </div>
  );
}
