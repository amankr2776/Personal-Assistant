import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { api } from '../services/api';

export default function VoiceOverlay() {
  const { showVoiceOverlay, micState, setShowVoiceOverlay, setMicState } = useStore();
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const stopListeningRef = useRef<(() => void) | null>(null);

  const handleMicClick = useCallback(() => {
    if (micState === 'idle') {
      // Start listening
      setMicState('listening');
      setTranscript('');

      const stop = api.startListening(
        (text, isFinal) => {
          setTranscript(text);
          if (isFinal) {
            setMicState('processing');
            // Auto-submit after getting final transcript
            setTimeout(() => {
              // This would normally send to chat - for now show the transcript
              setMicState('idle');
            }, 1500);
          }
        },
        (error) => {
          console.error('Speech error:', error);
          setMicState('idle');
          setTranscript(`Error: ${error}`);
        },
      );

      stopListeningRef.current = stop;

      // Fallback if SpeechRecognition not available
      if (!stop) {
        // Simulate for demo
        setMicState('listening');
        setTimeout(() => {
          setTranscript('Hello JARVIS, what can you do?');
          setMicState('processing');
          setTimeout(() => setMicState('idle'), 2000);
        }, 3000);
      }
    } else if (micState === 'listening') {
      // Stop listening
      stopListeningRef.current?.();
      stopListeningRef.current = null;
      setMicState('idle');
    } else {
      setMicState('idle');
    }
  }, [micState, setMicState]);

  const handleSpeak = useCallback(() => {
    if (isSpeaking) {
      api.stopSpeaking();
      setIsSpeaking(false);
    } else if (transcript) {
      api.speak(transcript);
      setIsSpeaking(true);
      setTimeout(() => setIsSpeaking(false), 5000);
    }
  }, [isSpeaking, transcript]);

  const handleClose = useCallback(() => {
    stopListeningRef.current?.();
    stopListeningRef.current = null;
    api.stopSpeaking();
    setMicState('idle');
    setIsSpeaking(false);
    setShowVoiceOverlay(false);
  }, [setMicState, setShowVoiceOverlay]);

  const stateLabels = {
    idle: 'Tap to speak',
    listening: 'Listening...',
    processing: 'Processing...',
    speaking: 'Speaking...',
  };

  const stateColors = {
    idle: 'border-jarvis-cyan/40',
    listening: 'border-jarvis-cyan',
    processing: 'border-jarvis-violet',
    speaking: 'border-jarvis-success',
  };

  return (
    <AnimatePresence>
      {showVoiceOverlay && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-jarvis-bg/80 backdrop-blur-md z-40"
          />

          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center"
          >
            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute -top-12 right-0 w-8 h-8 rounded-full bg-jarvis-surface border border-jarvis-border
                flex items-center justify-center text-jarvis-muted hover:text-jarvis-text transition-colors"
            >
              <X size={14} />
            </button>

            {/* Main container */}
            <div className="surface-card px-10 py-8 flex flex-col items-center gap-5 min-w-[320px]">
              {/* Mic button */}
              <div className="relative">
                <AnimatePresence>
                  {micState === 'listening' && (
                    <>
                      <motion.div
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{ scale: 1.8, opacity: 0 }}
                        exit={{ scale: 1.8, opacity: 0 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-full border-2 border-jarvis-cyan"
                      />
                      <motion.div
                        initial={{ scale: 1, opacity: 0.4 }}
                        animate={{ scale: 2.2, opacity: 0 }}
                        exit={{ scale: 2.2, opacity: 0 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                        className="absolute inset-0 rounded-full border border-jarvis-cyan/50"
                      />
                    </>
                  )}
                </AnimatePresence>

                {micState === 'processing' && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-jarvis-violet"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ borderTopColor: 'transparent' }}
                  />
                )}

                {micState === 'speaking' && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-jarvis-success"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleMicClick}
                  className={`relative w-14 h-14 rounded-full bg-jarvis-cyan/20 border-2 ${stateColors[micState]}
                    flex items-center justify-center z-10 cursor-pointer transition-colors`}
                >
                  {micState === 'idle' || micState === 'listening' ? (
                    <Mic size={24} className="text-jarvis-cyan" />
                  ) : micState === 'processing' ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Volume2 size={24} className="text-jarvis-violet" />
                    </motion.div>
                  ) : (
                    <Volume2 size={24} className="text-jarvis-success" />
                  )}
                </motion.button>
              </div>

              {/* Waveform */}
              {micState !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 32 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-center gap-1 h-8"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className={`w-1 rounded-full ${
                        micState === 'listening' ? 'bg-jarvis-cyan' :
                        micState === 'processing' ? 'bg-jarvis-violet' : 'bg-jarvis-success'
                      }`}
                      animate={{ scaleY: [0.3, Math.random() * 0.8 + 0.2, 0.3] }}
                      transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.05 }}
                      style={{ height: '100%' }}
                    />
                  ))}
                </motion.div>
              )}

              {/* Transcript display */}
              {transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-4 py-2.5 w-full"
                >
                  <p className="text-sm text-jarvis-text">{transcript}</p>
                </motion.div>
              )}

              {/* State label */}
              <div className="flex items-center gap-2">
                <motion.div
                  className={`w-2 h-2 rounded-full ${
                    micState === 'idle' ? 'bg-jarvis-muted' :
                    micState === 'listening' ? 'bg-jarvis-cyan' :
                    micState === 'processing' ? 'bg-jarvis-violet' : 'bg-jarvis-success'
                  }`}
                  animate={micState !== 'idle' ? { opacity: [1, 0.4, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-sm font-medium text-jarvis-text">{stateLabels[micState]}</span>
              </div>

              {/* Speak button */}
              {transcript && micState === 'idle' && (
                <button
                  onClick={handleSpeak}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  {isSpeaking ? 'Stop Speaking' : 'Read Aloud'}
                </button>
              )}

              {/* Modes hint */}
              <div className="flex items-center gap-3 text-[10px] text-jarvis-muted">
                <span>🎤 Voice → Text</span>
                <span className="text-jarvis-border">|</span>
                <span>📝 Text → Voice</span>
                <span className="text-jarvis-border">|</span>
                <span>🗣️ Voice → Voice</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
