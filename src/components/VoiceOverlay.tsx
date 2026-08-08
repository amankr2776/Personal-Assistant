import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { api, resolveYouTubeUrl } from '../services/api';
import { safeWindowOpen } from '../lib/url-safety';

export default function VoiceOverlay() {
  const { showVoiceOverlay, micState, setShowVoiceOverlay, setMicState, createSession, addMessage, memories } = useStore();
  // Location for weather
  const userLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { userLocationRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude }; },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }, []);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const stopListeningRef = useRef<(() => void) | null>(null);

  const handleMicClick = useCallback(() => {
    if (micState === 'idle') {
      setMicState('listening'); setTranscript(''); setAiResponse('');

      const stop = api.startListeningAuto(
        (text, isFinal) => {
          if (isFinal && text && text !== '...') {
            setMicState('processing');
            stopListeningRef.current = null;
            setTranscript(text);
            handleVoiceQuery(text);
          } else if (!isFinal && text) {
            setTranscript(text);
          }
        },
        (error) => { setMicState('idle'); setTranscript(`❌ ${error}`); },
      );

      stopListeningRef.current = stop;
      if (!stop) { setMicState('idle'); }
    } else if (micState === 'listening') {
      // Manual stop — audio will be processed and auto-queried
      stopListeningRef.current?.(); stopListeningRef.current = null;
    } else { setMicState('idle'); }
  }, [micState, setMicState]);

  const handleVoiceQuery = async (text: string) => {
    setIsGenerating(true);
    setAiResponse('');

    // Smart command detection (same as Chat/Home)
    const lowerText = text.toLowerCase().trim();
    const playMatch = lowerText.match(/^(play|listen\s+to|gaana|गाना|चलाओ|play\s+song|play\s+video|सुनो|chalao|बजाओ|चलाओ)\s+(.+)/i) ||
                       lowerText.match(/\b(play|चलाओ|बजाओ|सुनो|gaana|गाना)\s+(.+)/i);
    if (playMatch) {
      const searchQuery = playMatch[2].trim();
      try {
        const { url: ytUrl, isAutoplay, title } = await resolveYouTubeUrl(searchQuery);
        const opened = safeWindowOpen(ytUrl);
        setAiResponse(opened ? (isAutoplay ? `🎵 Playing ${title || searchQuery} on YouTube...` : `🎵 Searching YouTube for "${searchQuery}"...`) : `🎵 YouTube: ${ytUrl}`);
      } catch {
        const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        safeWindowOpen(ytUrl);
        setAiResponse(`🎵 Searching YouTube for "${searchQuery}"...`);
      }
      setIsGenerating(false); setMicState('idle');
      return;
    }
    if (/\b(github|गिटहब)\b/i.test(lowerText) || /^(my\s+repos|my\s+code|my\s+profile)/i.test(lowerText)) {
      const opened = safeWindowOpen('https://github.com/amankr2776');
      setAiResponse(opened ? '💻 Opening your GitHub profile...' : '💻 GitHub: https://github.com/amankr2776 (popup blocked)');
      setIsGenerating(false); setMicState('idle');
      return;
    }
    if (/\b(linkedin|लिंक्डइन)\b/i.test(lowerText)) {
      const mem = useStore.getState().memories.find(m => m.content.toLowerCase().includes('linkedin.com/in/'));
      const match = mem?.content.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/);
      const url = match ? match[0] : 'https://linkedin.com/in/amankr2776';
      const opened = safeWindowOpen(url);
      setAiResponse(opened ? '🔗 Opening your LinkedIn profile...' : `🔗 LinkedIn: ${url} (popup blocked)`);
      setIsGenerating(false); setMicState('idle');
      return;
    }

    const sessionId = useStore.getState().activeSessionId || createSession();
    const memoryContext = memories.map((m) => `${m.category}: ${m.content}`);
    const state = useStore.getState();
    const currentSession = state.sessions.find(s => s.id === state.activeSessionId);
    const history = currentSession ? currentSession.messages.filter(m => m.content.trim()).slice(-20).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 500) })) : [];

    let full = '';
    try {
      for await (const chunk of api.streamChat({ message: text, model: 'llama-3.1-8b-instant', mode: 'cloud', memories: memoryContext, temperature: 0.7, max_tokens: 4096, history, lat: userLocationRef.current?.lat, lon: userLocationRef.current?.lon })) {
        full += chunk; setAiResponse(full);
      }
    } catch { full = '⚠️ Connection error.'; setAiResponse(full); }
    setIsGenerating(false);
    setMicState('speaking');

    // AUTO-SPEAK the response
    if (full) {
      const isHindi = /[\u0900-\u097F]/.test(full.slice(0, 100));
      api.speak(full, isHindi ? 'hi' : 'en');
      setIsSpeaking(true);
      const duration = Math.max(2000, full.length * 60);
      setTimeout(() => { setIsSpeaking(false); setMicState('idle'); }, duration);
    }

    // Auto-memory extraction
    if (text.length > 5 && full.length > 10) {
      const currentMemories = useStore.getState().memories.map(m => `${m.category}: ${m.content}`);
      api.extractMemories(text, full, currentMemories).then(extracted => {
        if (extracted.length > 0) {
          const { addMemory } = useStore.getState();
          for (const mem of extracted) {
            addMemory({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9), content: mem.content.slice(0, 500), category: mem.category, createdAt: Date.now(), updatedAt: Date.now() });
          }
        }
      }).catch(() => {});
    }
  };

  const handleSpeak = useCallback(() => {
    if (isSpeaking) { api.stopSpeaking(); setIsSpeaking(false); }
    else if (aiResponse) { api.speak(aiResponse); setIsSpeaking(true); setTimeout(() => setIsSpeaking(false), 5000); }
  }, [isSpeaking, aiResponse]);

  const handleClose = useCallback(() => {
    stopListeningRef.current?.(); stopListeningRef.current = null;
    api.stopSpeaking(); setMicState('idle'); setIsSpeaking(false); setIsGenerating(false);
    setShowVoiceOverlay(false);
  }, [setMicState, setShowVoiceOverlay]);

  const stateLabels = { idle: 'Tap to speak', listening: 'Listening... speak now', processing: 'Processing...', speaking: 'Speaking...' };
  const stateColors = { idle: 'border-jarvis-cyan/40', listening: 'border-red-500', processing: 'border-jarvis-violet', speaking: 'border-jarvis-success' };

  return (
    <AnimatePresence>
      {showVoiceOverlay && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} className="fixed inset-0 bg-jarvis-bg/80 backdrop-blur-md z-40" />
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} transition={{ duration: 0.25 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
            <button onClick={handleClose} className="absolute -top-12 right-0 w-8 h-8 rounded-full bg-jarvis-surface border border-jarvis-border flex items-center justify-center text-jarvis-muted hover:text-jarvis-text transition-colors"><X size={14} /></button>
            <div className="surface-card px-10 py-8 flex flex-col items-center gap-5 min-w-[360px]">
              <div className="relative">
                <AnimatePresence>
                  {micState === 'listening' && (
                    <>
                      <motion.div initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 1.8, opacity: 0 }} exit={{ scale: 1.8, opacity: 0 }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 rounded-full border-2 border-red-500" />
                      <motion.div initial={{ scale: 1, opacity: 0.4 }} animate={{ scale: 2.2, opacity: 0 }} exit={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} className="absolute inset-0 rounded-full border border-red-500/50" />
                    </>
                  )}
                </AnimatePresence>
                {micState === 'processing' && <motion.div className="absolute inset-0 rounded-full border-2 border-jarvis-violet" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ borderTopColor: 'transparent' }} />}
                {micState === 'speaking' && <motion.div className="absolute inset-0 rounded-full border-2 border-jarvis-success" animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 0.8, repeat: Infinity }} />}
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleMicClick}
                  className={`relative w-14 h-14 rounded-full bg-jarvis-cyan/20 border-2 ${stateColors[micState]} flex items-center justify-center z-10 cursor-pointer transition-colors`}
                >
                  {micState === 'idle' || micState === 'listening' ? <Mic size={24} className={micState === 'listening' ? 'text-red-400' : 'text-jarvis-cyan'} /> : micState === 'processing' ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}><Volume2 size={24} className="text-jarvis-violet" /></motion.div> : <Volume2 size={24} className="text-jarvis-success" />}
                </motion.button>
              </div>
              {micState !== 'idle' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 32 }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-center gap-1 h-8">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div key={i} className={`w-1 rounded-full ${micState === 'listening' ? 'bg-red-500' : micState === 'processing' ? 'bg-jarvis-violet' : 'bg-jarvis-success'}`}
                      animate={{ scaleY: [0.3, Math.random() * 0.8 + 0.2, 0.3] }} transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.05 }} style={{ height: '100%' }}
                    />
                  ))}
                </motion.div>
              )}
              {transcript && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-jarvis-bg border border-jarvis-cyan/20 rounded-lg px-4 py-2.5 w-full">
                  <p className="text-[10px] text-jarvis-cyan mb-1">You said:</p>
                  <p className="text-sm text-jarvis-text">{transcript}</p>
                </motion.div>
              )}
              {aiResponse && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-jarvis-bg border border-jarvis-violet/20 rounded-lg px-4 py-2.5 w-full max-h-40 overflow-y-auto">
                  <p className="text-[10px] text-jarvis-violet mb-1">Aira:</p>
                  <p className="text-sm text-jarvis-text">{aiResponse}</p>
                </motion.div>
              )}
              <div className="flex items-center gap-2">
                <motion.div className={`w-2 h-2 rounded-full ${micState === 'idle' ? 'bg-jarvis-muted' : micState === 'listening' ? 'bg-red-500' : micState === 'processing' ? 'bg-jarvis-violet' : 'bg-jarvis-success'}`}
                  animate={micState !== 'idle' ? { opacity: [1, 0.4, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-sm font-medium text-jarvis-text">{isGenerating ? 'Generating...' : stateLabels[micState]}</span>
              </div>
              {aiResponse && micState === 'idle' && (
                <div className="flex gap-2">
                  <button onClick={handleSpeak} className="btn-secondary text-xs flex items-center gap-1.5">
                    {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}{isSpeaking ? 'Stop' : 'Read Aloud'}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] text-jarvis-muted">
                <span>🎤 Speak</span><span className="text-jarvis-border">|</span>
                <span>🤖 Whisper AI</span><span className="text-jarvis-border">|</span>
                <span>🗣️ Aira ↔ Voice</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
