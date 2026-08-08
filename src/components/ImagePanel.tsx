import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Download, Loader2, Image as ImageIcon, Copy, CheckCircle, RefreshCw } from 'lucide-react';
import { safeWindowOpen } from '../lib/url-safety';

export default function ImagePanel() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError('');
    setImageSrc('');

    // Use <img> src directly — no fetch, avoids CORS/timeout issues
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${Date.now()}`;
    setImageSrc(url);
  }

  function handleImageLoaded() {
    setIsGenerating(false);
  }

  function handleImageError() {
    setIsGenerating(false);
    setError('Failed to generate image. Try a simpler prompt.');
    setImageSrc('');
  }

  async function handleDownload() {
    if (!imageSrc) return;
    try {
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aira-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab (via safe URL check)
      safeWindowOpen(imageSrc, '_blank');
    }
  }

  async function handleCopyUrl() {
    if (!imageSrc) return;
    await navigator.clipboard.writeText(imageSrc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-jarvis-border">
        <div className="w-10 h-10 rounded-xl bg-jarvis-violet/20 flex items-center justify-center">
          <Sparkles size={20} className="text-jarvis-violet" />
        </div>
        <div>
          <h2 className="font-heading font-bold text-jarvis-text text-lg">Image Generator</h2>
          <p className="text-xs text-jarvis-muted">Free AI image generation — no API key needed</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Prompt input */}
          <div>
            <label className="text-xs font-medium text-jarvis-muted uppercase tracking-wider block mb-2">Describe your image</label>
            <div className="flex gap-2">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                placeholder="A cyberpunk city at night with neon lights..."
                className="flex-1 bg-jarvis-bg border border-jarvis-border rounded-xl px-4 py-3 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 focus:outline-none focus:border-jarvis-violet/40 focus:ring-1 focus:ring-jarvis-violet/20 transition-colors"
                disabled={isGenerating}
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className={`px-4 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all border ${
                  prompt.trim() && !isGenerating
                    ? 'bg-jarvis-violet/20 text-jarvis-violet border-jarvis-violet/30 hover:bg-jarvis-violet/30'
                    : 'bg-jarvis-border text-jarvis-muted border-jarvis-border cursor-not-allowed'
                }`}
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Generate
              </motion.button>
            </div>
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2">
            {[
              'Mountain landscape at sunset',
              'Cyberpunk city night',
              'Cute robot assistant',
              'Abstract art blue purple',
              'Indian village painting',
              'Space galaxy nebula',
            ].map((q) => (
              <button
                key={q}
                onClick={() => { setPrompt(q); }}
                className="text-[10px] bg-jarvis-bg border border-jarvis-border text-jarvis-muted rounded-lg px-2.5 py-1.5 hover:border-jarvis-violet/30 hover:text-jarvis-violet transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Loading */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 rounded-2xl bg-jarvis-violet/20 flex items-center justify-center mb-4"
                >
                  <Sparkles size={28} className="text-jarvis-violet" />
                </motion.div>
                <p className="text-sm text-jarvis-muted">Generating image...</p>
                <p className="text-xs text-jarvis-muted/50 mt-1">Takes 10-30 seconds</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Generated image — using <img> directly, no fetch */}
          {imageSrc && !error && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-jarvis-border bg-jarvis-bg">
                <img
                  src={imageSrc}
                  alt={prompt}
                  onLoad={handleImageLoaded}
                  onError={handleImageError}
                  className="w-full aspect-square object-cover"
                  crossOrigin="anonymous"
                />
              </div>
              {!isGenerating && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-jarvis-muted truncate max-w-[60%]">"{prompt}"</p>
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopyUrl} className="text-xs text-jarvis-muted hover:text-jarvis-cyan flex items-center gap-1 transition-colors" title="Copy URL">
                      {copied ? <CheckCircle size={14} className="text-jarvis-success" /> : <Copy size={14} />}
                      URL
                    </button>
                    <button onClick={handleGenerate} className="text-xs text-jarvis-muted hover:text-jarvis-violet flex items-center gap-1 transition-colors" title="Regenerate">
                      <RefreshCw size={14} />
                      Retry
                    </button>
                    <button onClick={handleDownload} className="flex items-center gap-1.5 bg-jarvis-cyan/10 text-jarvis-cyan border border-jarvis-cyan/30 rounded-lg px-3 py-1.5 text-xs hover:bg-jarvis-cyan/20 transition-colors">
                      <Download size={14} />
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info */}
          {!imageSrc && !isGenerating && !error && (
            <div className="text-center py-8">
              <ImageIcon size={48} className="text-jarvis-violet/20 mx-auto mb-4" />
              <p className="text-sm text-jarvis-muted">Describe any image and AIRA will generate it for free</p>
              <p className="text-xs text-jarvis-muted/50 mt-2">Powered by Pollinations.ai — no API key, no signup</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
