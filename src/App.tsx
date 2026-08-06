import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, Wifi, WifiOff, Server, Cpu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import HomeScreen from './components/HomeScreen';
import ChatInterface from './components/ChatInterface';
import VaultPanel from './components/VaultPanel';
import MemoryPanel from './components/MemoryPanel';
import AgentsPanel from './components/AgentsPanel';
import SettingsPanel from './components/SettingsPanel';
import VoiceOverlay from './components/VoiceOverlay';
import { useStore } from './stores/useStore';
import { api } from './services/api';

function checkNetwork() {
  return navigator.onLine ? 'online' as const : 'offline' as const;
}

function ConnectionBar() {
  const [ollamaOk, setOllamaOk] = useState(false);
  const [cloudOk, setCloudOk] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      setChecking(true);
      const result = await api.detectConnections();
      setOllamaOk(result.ollama);
      setCloudOk(result.cloud);
      setChecking(false);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  // Connected if EITHER ollama OR cloud is working
  const connected = ollamaOk || cloudOk;
  if (checking || connected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-2 mb-1"
    >
      <div className="bg-jarvis-warning/10 border border-jarvis-warning/30 rounded-xl px-4 py-3 flex items-center gap-3">
        <WifiOff size={16} className="text-jarvis-warning flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-jarvis-warning">AI not connected</p>
          <p className="text-[10px] text-jarvis-muted mt-0.5">
            Add GROQ_API_KEY in Vercel project settings, or run Ollama locally
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const { activePanel, setNetworkStatus, backendConnected, setBackendConnected, memories, addMemory } = useStore();
  const [booted, setBooted] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState(false);

  // Seed demo memories on first launch
  useEffect(() => {
    if (memories.length === 0) {
      const demoMemories = [
        { content: 'I prefer dark mode for all applications', category: 'Personal' },
        { content: 'My main programming language is TypeScript and Python', category: 'Work' },
        { content: 'I have a machine learning exam on August 15th', category: 'Study' },
      ];
      demoMemories.forEach((m, i) => {
        setTimeout(() => {
          addMemory({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
            content: m.content,
            category: m.category,
            createdAt: Date.now() - (i * 86400000),
            updatedAt: Date.now() - (i * 86400000),
          });
        }, i * 100);
      });
    }
  }, []);

  // Boot animation
  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Network status
  useEffect(() => {
    setNetworkStatus(checkNetwork());
    const interval = setInterval(() => setNetworkStatus(checkNetwork()), 30000);
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setNetworkStatus]);

  // Backend + Ollama health check
  useEffect(() => {
    const check = async () => {
      const healthy = await api.checkHealth();
      setBackendConnected(healthy);

      const ollama = await api.checkOllama();
      setOllamaConnected(ollama.ok);
      if (ollama.ok) {
        console.log('🤖 Ollama connected, models:', ollama.models);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [setBackendConnected]);

  // Global hotkey (Ctrl+Shift+J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        useStore.getState().toggleVoiceOverlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderPanel = () => {
    switch (activePanel) {
      case 'home': return <HomeScreen />;
      case 'chat': return <ChatInterface />;
      case 'vault': return <VaultPanel />;
      case 'memory': return <MemoryPanel />;
      case 'agents': return <AgentsPanel />;
      case 'settings': return <SettingsPanel />;
      default: return <HomeScreen />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-jarvis-bg overflow-hidden">
      {/* Boot animation */}
      <AnimatePresence>
        {!booted && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] bg-jarvis-bg flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-jarvis-cyan/20 flex items-center justify-center">
                <Zap size={32} className="text-jarvis-cyan" />
              </div>
              <h1 className="font-heading text-2xl font-bold text-jarvis-text tracking-widest">JARVIS</h1>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-jarvis-cyan"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <p className="text-xs text-jarvis-muted font-mono">Initializing systems...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TopBar />
      <ConnectionBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePanel}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {renderPanel()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <VoiceOverlay />
    </div>
  );
}
