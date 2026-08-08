import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, WifiOff } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import HomeScreen from './components/HomeScreen';
import ChatInterface from './components/ChatInterface';
import VaultPanel from './components/VaultPanel';
import MemoryPanel from './components/MemoryPanel';
import SettingsPanel from './components/SettingsPanel';
import VoiceOverlay from './components/VoiceOverlay';
import AppLockScreen from './components/AppLockScreen';
import RemindersPanel from './components/RemindersPanel';
import TodosPanel from './components/TodosPanel';
import CodePanel from './components/CodePanel';
import ImagePanel from './components/ImagePanel';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useStore } from './stores/useStore';
import { api } from './services/api';
import { AuthProvider, useAuth, AuthScreen } from './lib/auth';
import { setIdTokenGetter } from './services/api';

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
      try {
        const result = await api.detectConnections();
        setOllamaOk(result.ollama);
        setCloudOk(result.cloud);
      } catch {}
      setChecking(false);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const connected = ollamaOk || cloudOk;
  if (checking || connected) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-2 mb-1">
      <div className="bg-jarvis-warning/10 border border-jarvis-warning/30 rounded-xl px-4 py-3 flex items-center gap-3">
        <WifiOff size={16} className="text-jarvis-warning flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-jarvis-warning">AI not connected</p>
          <p className="text-[10px] text-jarvis-muted mt-0.5">Check your internet connection</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading: authLoading, idToken } = useAuth();
  const [authReady, setAuthReady] = useState(false);
  const [appUnlocked, setAppUnlocked] = useState(false);

  // Wire up auth token for API calls
  useEffect(() => {
    setIdTokenGetter(async () => idToken);
  }, [idToken]);

  // If not authenticated, show login screen
  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-jarvis-bg flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Zap size={32} className="text-jarvis-cyan" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={() => setAuthReady(true)} />;
  }

  return <AuthenticatedApp appUnlocked={appUnlocked} setAppUnlocked={setAppUnlocked} />;
}

function AuthenticatedApp({ appUnlocked, setAppUnlocked }: { appUnlocked: boolean; setAppUnlocked: (v: boolean) => void }) {
  const { activePanel, setNetworkStatus, setBackendConnected, appPin, memories, addMemory, highContrast } = useStore();
  const [booted, setBooted] = useState(false);

  // Boot animation
  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Save profile info to memory on first unlock (if not already saved)
  useEffect(() => {
    if (!appUnlocked) return;
    const hasGithub = memories.some(m => m.content.includes('github.com/amankr2776'));
    if (!hasGithub) {
      addMemory({ id: 'profile-github', content: 'GitHub profile: https://github.com/amankr2776 — Repos: Agri-Wise (TypeScript), ShieldCore (TypeScript), ai-coding-mentor (TypeScript)', category: 'Work', createdAt: Date.now(), updatedAt: Date.now() });
      addMemory({ id: 'profile-linkedin', content: 'LinkedIn profile: https://linkedin.com/in/amankr2776', category: 'Work', createdAt: Date.now(), updatedAt: Date.now() });
    }
  }, [appUnlocked]);

  // Network status
  useEffect(() => {
    setNetworkStatus(checkNetwork());
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setNetworkStatus]);

  // Health check
  useEffect(() => {
    const check = async () => {
      try {
        const healthy = await api.checkHealth();
        setBackendConnected(healthy);
      } catch {}
    };
    check();
    const interval = setInterval(check, 30000);
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
      case 'reminders': return <RemindersPanel />;
      case 'todos': return <TodosPanel />;
      case 'code': return <CodePanel />;
      case 'images': return <ImagePanel />;
      case 'vault': return <VaultPanel />;
      case 'memory': return <MemoryPanel />;
      case 'settings': return <SettingsPanel />;
      default: return <HomeScreen />;
    }
  };

  return (
    <div className={`h-screen w-screen flex flex-col bg-jarvis-bg overflow-hidden ${highContrast ? 'high-contrast' : ''}`}>
      {/* Skip to content — accessibility */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* APP LOCK — must unlock before seeing anything */}
      {!appUnlocked && (
        <AppLockScreen onUnlock={() => setAppUnlocked(true)} />
      )}

      {appUnlocked && (
      <>
      <AnimatePresence>
        {!booted && (
          <motion.div
            initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] bg-jarvis-bg flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-jarvis-cyan/20 flex items-center justify-center">
                <Zap size={32} className="text-jarvis-cyan" />
              </div>
              <h1 className="font-heading text-2xl font-bold text-jarvis-text tracking-widest">AIRA</h1>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i} className="w-2 h-2 rounded-full bg-jarvis-cyan"
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
        <main id="main-content" role="main" aria-label="Main content" className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePanel} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {renderPanel()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <VoiceOverlay />
      <PWAInstallPrompt />
      </>
      )}
    </div>
  );
}
