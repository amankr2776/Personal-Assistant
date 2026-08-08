import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a short delay so user sees the app first
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  }

  if (isInstalled || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)]"
      >
        <div className="bg-jarvis-surface border border-jarvis-cyan/30 rounded-2xl p-4 shadow-lg shadow-jarvis-cyan/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-jarvis-cyan/20 flex items-center justify-center flex-shrink-0">
              <Smartphone size={20} className="text-jarvis-cyan" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-semibold text-sm text-jarvis-text">Install AIRA</h3>
              <p className="text-xs text-jarvis-muted mt-0.5">
                Add to home screen for native app experience — works offline, faster access
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-1.5 bg-jarvis-cyan text-jarvis-bg font-semibold text-xs px-4 py-2 rounded-lg hover:brightness-110 transition-all"
                >
                  <Download size={14} />
                  Install App
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="text-xs text-jarvis-muted hover:text-jarvis-text transition-colors px-3 py-2"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowPrompt(false)}
              className="text-jarvis-muted hover:text-jarvis-text transition-colors flex-shrink-0"
              aria-label="Dismiss install prompt"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
