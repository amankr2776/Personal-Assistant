import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cloud, CloudOff, Minus, Square, X, Zap, Cpu, Wifi, WifiOff } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { api } from '../services/api';

export default function TopBar() {
  const { networkStatus, activeModel, aiMode, backendConnected } = useStore();
  const [ollamaOk, setOllamaOk] = useState(false);
  const [cloudOk, setCloudOk] = useState(false);
  const [modelCount, setModelCount] = useState(0);

  // Live Ollama + Cloud check
  useEffect(() => {
    const check = async () => {
      const r = await api.checkOllama();
      setOllamaOk(r.ok);
      if (r.ok) setModelCount(r.models.length);

      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          setCloudOk(data.ai === 'groq');
        }
      } catch {}
    };
    check();
    const i = setInterval(check, 15000);
    return () => clearInterval(i);
  }, []);

  const statusColor =
    networkStatus === 'online'
      ? 'bg-jarvis-success'
      : networkStatus === 'offline'
        ? 'bg-jarvis-warning'
        : 'bg-jarvis-muted';

  const statusLabel =
    networkStatus === 'online' ? 'Online' : networkStatus === 'offline' ? 'Offline' : 'Checking...';

  const modeLabel = aiMode === 'cloud' ? 'Cloud' : aiMode === 'local' ? 'Local' : 'Auto';

  const modelLabel =
    activeModel === 'tinyllama' ? 'TinyLlama' :
    activeModel === 'llama3.1-8b' ? 'Llama 3.1' :
    activeModel === 'phi-3' ? 'Phi-3' :
    activeModel === 'phi3:mini' ? 'Phi-3 Mini' : activeModel;

  return (
    <div className="h-12 bg-jarvis-surface border-b border-jarvis-border flex items-center px-4 select-none"
         style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Logo + Ollama Status */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-jarvis-cyan/20 flex items-center justify-center">
            <Zap size={14} className="text-jarvis-cyan" />
          </div>
          <span className="font-heading font-bold text-sm text-jarvis-text tracking-wider">JARVIS</span>
        </div>

        {/* AI connection indicator */}
        <div className="flex items-center gap-1.5">
          {ollamaOk ? (
            <>
              <Cpu size={12} className="text-jarvis-success" />
              <motion.div
                className="w-2 h-2 rounded-full bg-jarvis-success"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[10px] text-jarvis-muted font-mono">Ollama ({modelCount})</span>
            </>
          ) : cloudOk ? (
            <>
              <Cloud size={12} className="text-jarvis-cyan" />
              <motion.div
                className="w-2 h-2 rounded-full bg-jarvis-cyan"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[10px] text-jarvis-muted font-mono">Groq Cloud</span>
            </>
          ) : (
            <>
              <CloudOff size={12} className="text-jarvis-error/60" />
              <div className="w-2 h-2 rounded-full bg-jarvis-error/40" />
              <span className="text-[10px] text-jarvis-muted font-mono">No AI</span>
            </>
          )}
        </div>

        {/* Network status */}
        <div className="flex items-center gap-1.5 ml-1">
          {networkStatus === 'online' ? (
            <Wifi size={10} className="text-jarvis-success" />
          ) : (
            <WifiOff size={10} className="text-jarvis-muted" />
          )}
          <span className="text-[10px] text-jarvis-muted font-mono">{statusLabel}</span>
        </div>
      </div>

      {/* Center: spacer */}
      <div className="flex-1" />

      {/* Right: Model badge + Window controls */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2 bg-jarvis-bg border border-jarvis-border rounded-md px-2.5 py-1">
          {ollamaOk ? (
            <Cpu size={12} className="text-jarvis-success" />
          ) : (
            <CloudOff size={12} className="text-jarvis-warning" />
          )}
          <span className="text-[10px] font-mono text-jarvis-muted">{modeLabel}</span>
          <span className="text-[10px] font-mono text-jarvis-text">•</span>
          <span className="text-[10px] font-mono text-jarvis-text">{modelLabel}</span>
        </div>

        {/* Backend status */}
        <div
          className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-jarvis-success' : 'bg-jarvis-error/50'}`}
          title={backendConnected ? 'Backend connected' : 'Backend disconnected'}
        />

        {/* Window controls */}
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 flex items-center justify-center text-jarvis-muted hover:text-jarvis-text hover:bg-jarvis-border rounded transition-colors">
            <Minus size={14} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-jarvis-muted hover:text-jarvis-text hover:bg-jarvis-border rounded transition-colors">
            <Square size={12} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-jarvis-muted hover:text-jarvis-error hover:bg-jarvis-error/10 rounded transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
