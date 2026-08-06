import { motion } from 'framer-motion';
import { Mic, FileText, Search, Brain, CloudSun, CloudMoon, Sun } from 'lucide-react';
import { useStore } from '../stores/useStore';

function getGreeting(): { text: string; icon: typeof Sun; period: string } {
  const hour = new Date().getHours();
  if (hour < 6) return { text: 'Good night', icon: CloudMoon, period: 'night' };
  if (hour < 12) return { text: 'Good morning', icon: Sun, period: 'morning' };
  if (hour < 18) return { text: 'Good afternoon', icon: CloudSun, period: 'afternoon' };
  return { text: 'Good evening', icon: CloudMoon, period: 'evening' };
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const quickActions = [
  { icon: FileText, label: 'Summarize a PDF', color: 'text-jarvis-cyan', bg: 'bg-jarvis-cyan/10' },
  { icon: Search, label: 'Search the web', color: 'text-jarvis-violet', bg: 'bg-jarvis-violet/10' },
  { icon: Brain, label: "What's on my mind", color: 'text-jarvis-success', bg: 'bg-jarvis-success/10' },
  { icon: FileText, label: 'Review my notes', color: 'text-jarvis-warning', bg: 'bg-jarvis-warning/10' },
];

export default function HomeScreen() {
  const { toggleVoiceOverlay, createSession, setActivePanel } = useStore();
  const greeting = getGreeting();

  const GreetingIcon = greeting.icon;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <GreetingIcon size={28} className="text-jarvis-cyan" />
          <h1 className="font-heading text-4xl font-bold text-jarvis-text">{greeting.text}</h1>
        </div>
        <p className="text-jarvis-muted text-lg">{formatDate()}</p>
      </motion.div>

      {/* Date/Time chip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        className="surface-card px-5 py-2.5 mb-10 flex items-center gap-3"
      >
        <div className="w-2 h-2 rounded-full bg-jarvis-cyan animate-pulse" />
        <span className="font-mono text-sm text-jarvis-muted">{formatTime()}</span>
        <span className="text-jarvis-border">|</span>
        <span className="font-mono text-sm text-jarvis-muted">Local Time</span>
      </motion.div>

      {/* Large Mic Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleVoiceOverlay}
        className="relative w-20 h-20 rounded-full bg-jarvis-cyan/20 border-2 border-jarvis-cyan/40 flex items-center justify-center mb-4 group cursor-pointer"
      >
        {/* Animated glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-jarvis-cyan"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border border-jarvis-cyan/30"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
        <Mic size={28} className="text-jarvis-cyan group-hover:text-jarvis-text transition-colors z-10" />
      </motion.button>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-jarvis-muted mb-12"
      >
        Press <kbd className="px-1.5 py-0.5 bg-jarvis-border rounded text-xs font-mono text-jarvis-text">Ctrl+Shift+J</kbd> or click to activate
      </motion.p>

      {/* Quick Action Chips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        {quickActions.map((action, i) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.label}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (action.label === 'Search the web') {
                  createSession();
                } else if (action.label === 'Summarize a PDF') {
                  setActivePanel('vault');
                } else if (action.label === "What's on my mind") {
                  createSession();
                } else {
                  setActivePanel('vault');
                }
              }}
              className={`${action.bg} border border-jarvis-border rounded-xl px-4 py-2.5 flex items-center gap-2.5
                hover:border-jarvis-cyan/30 transition-all duration-150 cursor-pointer`}
            >
              <Icon size={16} className={action.color} />
              <span className="text-sm text-jarvis-text font-medium">{action.label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Decorative grid lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(0,217,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,217,255,1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />
      </div>
    </div>
  );
}
