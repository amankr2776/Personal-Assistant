import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Shield, Zap } from 'lucide-react';
import { useStore } from '../stores/useStore';

export default function AppLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { appPin, setAppPin, verifyAppPinAsync } = useStore();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isSetting, setIsSetting] = useState(!appPin);
  const [confirmPin, setConfirmPin] = useState('');
  const [shake, setShake] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit() {
    if (isSetting) {
      if (pin.length < 4) { setError('PIN must be at least 4 digits'); shakeNow(); return; }
      if (confirmPin !== pin) { setError('PINs do not match'); shakeNow(); return; }
      setAppPin(pin);
      // Wait for async hash to complete
      await new Promise(r => setTimeout(r, 100));
      onUnlock();
      return;
    }
    setVerifying(true);
    const valid = await verifyAppPinAsync(pin);
    setVerifying(false);
    if (valid) {
      setError('');
      onUnlock();
    } else {
      setError('Wrong PIN');
      setPin('');
      shakeNow();
      inputRef.current?.focus();
    }
  }

  function shakeNow() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  return (
    <div className="h-screen w-screen bg-jarvis-bg flex items-center justify-center overflow-hidden relative">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,217,255,0.4), transparent),
            radial-gradient(ellipse 60% 80% at 30% 70%, rgba(124,58,237,0.3), transparent)`,
        }} />
        <motion.div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #00D9FF, transparent 70%)', top: '20%', left: '50%', x: '-50%' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.04, 0.07, 0.04] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0, x: shake ? [0, -10, 10, -10, 10, 0] : 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="relative z-10 w-full max-w-sm px-6"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-jarvis-cyan/10 border border-jarvis-cyan/20 flex items-center justify-center mx-auto mb-4">
            <Zap size={36} className="text-jarvis-cyan" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-jarvis-text tracking-widest mb-1">AIRA</h1>
          <p className="text-xs text-jarvis-muted">Personal AI Assistant</p>
        </div>

        {/* Lock card */}
        <div className="bg-jarvis-surface/80 backdrop-blur-md border border-jarvis-border rounded-2xl p-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield size={20} className="text-jarvis-violet" />
            <h3 className="font-heading font-semibold text-jarvis-text">
              {isSetting ? 'Set Access PIN' : '🔒 Locked'}
            </h3>
          </div>
          <p className="text-xs text-jarvis-muted text-center mb-5">
            {isSetting
              ? 'This is your personal assistant. Create a PIN so only you can access it.'
              : 'Enter your PIN to unlock Aira'}
          </p>

          {/* PIN input */}
          <div className="relative mb-3">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
            <input
              ref={inputRef}
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder={isSetting ? 'Enter new PIN' : 'Enter PIN'}
              maxLength={8}
              autoFocus
              className="w-full bg-jarvis-bg border border-jarvis-border rounded-xl pl-9 pr-10 py-3 text-lg text-jarvis-text text-center tracking-[0.4em] font-mono
                placeholder:text-jarvis-muted/40 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:border-jarvis-cyan/40 focus:ring-1 focus:ring-jarvis-cyan/20 transition-colors"
            />
            <button onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-jarvis-muted hover:text-jarvis-text transition-colors">
              {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Confirm PIN */}
          {isSetting && (
            <div className="relative mb-3">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder="Confirm PIN"
                maxLength={8}
                className="w-full bg-jarvis-bg border border-jarvis-border rounded-xl px-3 py-3 text-lg text-jarvis-text text-center tracking-[0.4em] font-mono
                  placeholder:text-jarvis-muted/40 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:border-jarvis-cyan/40 focus:ring-1 focus:ring-jarvis-cyan/20 transition-colors"
              />
            </div>
          )}

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 text-center mb-3">{error}</motion.p>
          )}

          <button onClick={handleSubmit} disabled={pin.length < 4 || (isSetting && confirmPin.length < 4) || verifying}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2 mb-4 disabled:opacity-40 disabled:cursor-not-allowed">
            <Lock size={14} />
            {verifying ? 'Verifying...' : isSetting ? 'Set PIN & Enter' : 'Unlock'}
          </button>

          {!isSetting && (
            <button onClick={() => { setIsSetting(true); setPin(''); setConfirmPin(''); setError(''); }}
              className="text-[10px] text-jarvis-muted hover:text-jarvis-violet transition-colors w-full text-center">
              Forgot PIN? Reset it
            </button>
          )}

          {/* PIN dots visual */}
          <div className="flex items-center justify-center gap-2.5 mt-4">
            {[0,1,2,3].map(i => (
              <motion.div key={i}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${i < pin.length ? 'bg-jarvis-cyan scale-110' : 'bg-jarvis-border'}`}
                animate={i < pin.length ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.2 }}
              />
            ))}
            {pin.length > 4 && (
              <span className="text-[10px] text-jarvis-muted ml-1">+{pin.length - 4}</span>
            )}
          </div>
        </div>

        <p className="text-[10px] text-jarvis-muted/40 text-center mt-6">
          Your data stays on this device. PIN protects your personal assistant.
        </p>
      </motion.div>
    </div>
  );
}
