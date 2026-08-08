import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';

interface AiraCharacterProps {
  isListening: boolean;
  isThinking: boolean;
  onMicClick: () => void;
  size?: number;
}

export default function AiraCharacter({
  isListening,
  isThinking,
  onMicClick,
  size = 280,
}: AiraCharacterProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Listen for speaking events from api.speak()
  useEffect(() => {
    const onSpeak = (e: Event) => {
      const speaking = (e as CustomEvent).detail as boolean;
      setIsSpeaking(speaking);
    };
    window.addEventListener('aira-speak', onSpeak);
    return () => window.removeEventListener('aira-speak', onSpeak);
  }, []);

  const stateText = isListening
    ? '🔴 Listening...'
    : isThinking
    ? '✨ Thinking...'
    : isSpeaking
    ? '🗣️ Speaking...'
    : 'Tap mic to speak';

  return (
    <div className="flex flex-col items-center">
      {/* Character container */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Ambient glow behind character */}
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: '-18%',
            background: 'radial-gradient(circle, rgba(0,217,255,0.12) 0%, rgba(124,58,237,0.08) 40%, transparent 70%)',
          }}
          animate={{
            scale: isSpeaking ? [1, 1.05, 1] : isListening ? [1, 1.03, 1] : 1,
            opacity: isSpeaking ? [0.7, 1, 0.7] : isListening ? [0.5, 0.8, 0.5] : 0.4,
          }}
          transition={{ duration: isSpeaking ? 1.2 : 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Pulse rings when speaking */}
        <AnimatePresence>
          {isSpeaking && (
            <>
              <motion.div
                className="absolute rounded-full border border-cyan-400/25"
                style={{ inset: '-8%' }}
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 1.35, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute rounded-full border border-violet-400/15"
                style={{ inset: '-14%' }}
                initial={{ scale: 1, opacity: 0.25 }}
                animate={{ scale: 1.45, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Listening pulse */}
        <AnimatePresence>
          {isListening && (
            <>
              <motion.div
                className="absolute rounded-full border-2 border-red-400/50"
                style={{ inset: '-6%' }}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.25, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute rounded-full border border-red-400/30"
                style={{ inset: '-12%' }}
                initial={{ scale: 1, opacity: 0.35 }}
                animate={{ scale: 1.4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Single character image — no flickering */}
        <img
          src="/aira-character.png"
          alt="Aira"
          className="absolute inset-0 w-full h-full object-cover rounded-full"
        />

        {/* Speaking mouth glow overlay — smooth animation, no image swap */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                /* Position over mouth area — centered low */
                top: '55%',
                left: '50%',
                width: '22%',
                height: '12%',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(ellipse, rgba(0,217,255,0.15) 0%, rgba(124,58,237,0.08) 50%, transparent 80%)',
                filter: 'blur(3px)',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: [0.6, 1, 0.6, 1, 0.5, 1, 0.7, 1],
                scale: [1, 1.15, 0.95, 1.1, 1, 1.2, 0.9, 1.05],
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
                times: [0, 0.15, 0.25, 0.4, 0.5, 0.65, 0.75, 1],
              }}
            />
          )}
        </AnimatePresence>

        {/* Speaking: subtle brightness pulse on whole face */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 50% 60%, rgba(0,217,255,0.06) 0%, transparent 60%)',
                mixBlendMode: 'screen',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.8, 0.2, 0.7, 0.4, 0.9, 0.3] }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1.0,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </AnimatePresence>

        {/* Thinking dots overlay */}
        <AnimatePresence>
          {isThinking && (
            <motion.div
              className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(11,15,26,0.25)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-cyan-400"
                    animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name label */}
      <motion.p
        className="text-sm font-heading font-semibold text-jarvis-cyan mt-3"
        animate={isSpeaking ? { opacity: [0.8, 1, 0.8] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        Aira
      </motion.p>

      {/* Mic button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={onMicClick}
        className={`relative mt-2 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 border-2 ${
          isListening
            ? 'bg-red-500/20 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
            : 'bg-jarvis-cyan/10 border-jarvis-cyan/30 shadow-[0_0_20pxA_rgba(0,217,255,0.15)]'
        }`}
        title={isListening ? 'Tap to stop' : 'Tap to speak'}
      >
        {isListening ? (
          <>
            <Mic size={18} className="text-red-400" />
            <motion.div
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          </>
        ) : (
          <MicOff size={18} className="text-jarvis-cyan" />
        )}
      </motion.button>

      {/* State label */}
      <p className={`text-center text-[11px] mt-1.5 ${
        isListening ? 'text-red-400' : isSpeaking ? 'text-cyan-400' : isThinking ? 'text-violet-400' : 'text-jarvis-muted'
      }`}>
        {stateText}
      </p>
    </div>
  );
}
