import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Cloud, CloudOff, Mic, Keyboard, Volume2, Brain, Globe, Key, Sliders,
  Thermometer, Hash, ToggleLeft, ToggleRight, User, Sparkles, Eye, EyeOff,
} from 'lucide-react';
import { useStore } from '../stores/useStore';
import { api } from '../services/api';
import type { AIMode, AIModel } from '../types';

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 mr-4">
        <p className="text-sm text-jarvis-text">{label}</p>
        {description && <p className="text-xs text-jarvis-muted mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Settings; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-6 first:mt-0">
      <Icon size={16} className="text-jarvis-cyan" />
      <h3 className="font-heading font-semibold text-sm text-jarvis-text uppercase tracking-wider">{title}</h3>
    </div>
  );
}

export default function SettingsPanel() {
  const { settings, updateSettings, aiMode, setAiMode, activeModel, setActiveModel, networkStatus, highContrast, toggleHighContrast } = useStore();
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'voice' | 'api' | 'memory'>('general');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load browser voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setAvailableVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Sliders },
    { id: 'ai' as const, label: 'AI Models', icon: Brain },
    { id: 'voice' as const, label: 'Voice & Speech', icon: Mic },
    { id: 'api' as const, label: 'API Keys', icon: Key },
    { id: 'memory' as const, label: 'Memory', icon: Brain },
  ];

  function handleTestVoice() {
    api.speak('Hello! I am Aira, your personal AI assistant. नमस्ते! मैं ऐरा हूँ, आपका व्यक्तिगत AI सहायक।');
  }

  // Find matched browser voice for Aira
  function getMatchedVoiceName(matchList: string[], lang: string): string {
    for (const pattern of matchList) {
      const lp = pattern.toLowerCase();
      const v = availableVoices.find(v => v.name.toLowerCase() === lp) ||
                availableVoices.find(v => v.name.toLowerCase().includes(lp) && !v.localService) ||
                availableVoices.find(v => v.lang.toLowerCase().startsWith(lp) && !v.localService);
      if (v) return `${v.name} (${v.lang})`;
    }
    return `Fallback: ${lang}`;
  }

  const airaEnMatch = ['Microsoft Heera', 'Heera', 'Lekha', 'Google UK English Female', 'Microsoft Zira', 'Zira', 'Microsoft Eva'];
  const airaHiMatch = ['Microsoft Swara', 'Swara', 'Lekha', 'Heera'];

  return (
    <div className="flex-1 flex h-full">
      {/* Settings tabs */}
      <div className="w-48 border-r border-jarvis-border py-4 px-2">
        <div className="flex items-center gap-2 px-3 mb-4">
          <Settings size={16} className="text-jarvis-cyan" />
          <h2 className="font-heading font-semibold text-sm text-jarvis-text">Settings</h2>
        </div>
        <div className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === tab.id ? 'bg-jarvis-cyan/10 text-jarvis-cyan' : 'text-jarvis-muted hover:bg-jarvis-border hover:text-jarvis-text'}`}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'general' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionHeader icon={Sliders} title="General" />
            <div className="divide-y divide-jarvis-border">
              <SettingRow label="AI Mode" description="All inference runs locally via Ollama — no cloud needed">
                <select value={aiMode} onChange={(e) => setAiMode(e.target.value as AIMode)}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-text focus:outline-none focus:border-jarvis-cyan/40">
                  <option value="local">Local (Ollama)</option>
                  <option value="auto">Auto (future)</option>
                  <option value="cloud">Cloud (future)</option>
                </select>
              </SettingRow>
              <SettingRow label="Hotkey" description="Global shortcut to open JARVIS from anywhere">
                <div className="flex items-center gap-1 bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5">
                  <Keyboard size={14} className="text-jarvis-muted" />
                  <span className="text-sm text-jarvis-text font-mono">{settings.hotkey}</span>
                </div>
              </SettingRow>
              <SettingRow label="Wake Word" description="Voice activation word">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateSettings({ wakeWordEnabled: !settings.wakeWordEnabled })} className={settings.wakeWordEnabled ? 'text-jarvis-cyan' : 'text-jarvis-muted'}>
                    {settings.wakeWordEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <span className="text-sm text-jarvis-text font-mono">{settings.wakeWord}</span>
                </div>
              </SettingRow>
              <SettingRow label="Location Services" description="For weather and local information">
                <button onClick={() => updateSettings({ locationEnabled: !settings.locationEnabled })} className={settings.locationEnabled ? 'text-jarvis-cyan' : 'text-jarvis-muted'}>
                  {settings.locationEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </SettingRow>
              <SettingRow label="High Contrast Mode" description="Increased contrast for better visibility">
                <button onClick={toggleHighContrast} className={highContrast ? 'text-jarvis-cyan' : 'text-jarvis-muted'}>
                  {highContrast ? <Eye size={24} /> : <EyeOff size={24} />}
                </button>
              </SettingRow>
            </div>
          </motion.div>
        )}

        {activeTab === 'ai' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionHeader icon={Brain} title="AI Models" />
            <div className="divide-y divide-jarvis-border">
              <SettingRow label="Cloud Model" description="For future cloud support">
                <select value={settings.preferredCloudModel} onChange={(e) => updateSettings({ preferredCloudModel: e.target.value as AIModel })}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-text focus:outline-none focus:border-jarvis-cyan/40">
                  <option value="claude-sonnet-4-6">Claude Sonnet 4 (future)</option>
                </select>
              </SettingRow>
              <SettingRow label="Local Model (Ollama)" description="Ollama model for all queries">
                <select value={settings.preferredLocalModel} onChange={(e) => updateSettings({ preferredLocalModel: e.target.value as AIModel })}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-text focus:outline-none focus:border-jarvis-cyan/40">
                  <option value="tinyllama">TinyLlama (1.1B — fast)</option>
                  <option value="phi3:mini">Phi-3 Mini (2.4B — balanced)</option>
                  <option value="llama3.1:8b">Llama 3.1 8B (best — 8GB RAM)</option>
                </select>
              </SettingRow>
              <SettingRow label="Temperature" description="Higher = creative, Lower = precise">
                <div className="flex items-center gap-3">
                  <Thermometer size={14} className="text-jarvis-muted" />
                  <input type="range" min="0" max="1" step="0.1" value={settings.temperature} onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })} className="w-24 accent-jarvis-cyan" />
                  <span className="text-xs font-mono text-jarvis-text w-8">{settings.temperature}</span>
                </div>
              </SettingRow>
              <SettingRow label="Max Tokens" description="Maximum response length">
                <div className="flex items-center gap-3">
                  <Hash size={14} className="text-jarvis-muted" />
                  <input type="number" value={settings.maxTokens} onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) || 4096 })}
                    className="w-20 bg-jarvis-bg border border-jarvis-border rounded-lg px-2 py-1 text-sm text-jarvis-text font-mono focus:outline-none focus:border-jarvis-cyan/40" />
                </div>
              </SettingRow>
            </div>
          </motion.div>
        )}

        {activeTab === 'voice' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionHeader icon={Mic} title="Voice & Speech" />
            <div className="divide-y divide-jarvis-border mb-6">
              <SettingRow label="Continuous Listening" description="Always listen for wake word">
                <button onClick={() => updateSettings({ continuousListening: !settings.continuousListening })} className={settings.continuousListening ? 'text-jarvis-cyan' : 'text-jarvis-muted'}>
                  {settings.continuousListening ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </SettingRow>
              <SettingRow label="TTS Engine" description="Text-to-speech voice engine">
                <select value={settings.ttsEngine} onChange={(e) => updateSettings({ ttsEngine: e.target.value as 'edge-tts' | 'elevenlabs' })}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-text focus:outline-none focus:border-jarvis-cyan/40">
                  <option value="edge-tts">Edge TTS (Free)</option>
                  <option value="elevenlabs">ElevenLabs (Premium)</option>
                </select>
              </SettingRow>
            </div>

            {/* Aira Voice Card */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Volume2 size={16} className="text-jarvis-cyan" />
                <h3 className="font-heading font-semibold text-sm text-jarvis-text">Voice — Aira</h3>
              </div>
              <p className="text-xs text-jarvis-muted mb-4">
                Aira is the voice of JARVIS. She speaks English & Hindi naturally. Hindi question → Hindi reply. English → English reply.
              </p>

              <motion.div
                className="w-full text-left p-4 rounded-xl border-2 bg-jarvis-cyan/10 border-jarvis-cyan/50 shadow-lg shadow-jarvis-cyan/10"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full border-2 border-pink-400/30 bg-pink-400/10 flex items-center justify-center text-2xl">
                    👩‍💻
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-heading font-semibold text-base text-jarvis-cyan">
                        Aira
                      </p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full text-pink-400 bg-pink-400/10 border border-pink-400/20 uppercase font-medium">
                        female
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-jarvis-success/10 border border-jarvis-success/20 text-jarvis-success uppercase font-medium">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-jarvis-muted mt-0.5">Warm, intelligent female voice — speaks English & Hindi</p>
                  </div>

                  {/* Test button */}
                  <button
                    onClick={handleTestVoice}
                    className="btn-icon text-xs text-jarvis-muted hover:text-jarvis-cyan"
                    title="Test Aira's voice"
                  >
                    <Volume2 size={18} />
                  </button>
                </div>

                {/* Matched voice info */}
                <div className="mt-3 pt-3 border-t border-jarvis-border/50 flex gap-6 text-[10px] text-jarvis-muted">
                  <span>🇬🇧 EN: {getMatchedVoiceName(airaEnMatch, 'en-IN')}</span>
                  <span>🇮🇳 HI: {getMatchedVoiceName(airaHiMatch, 'hi-IN')}</span>
                </div>
              </motion.div>

              {/* Available browser voices info */}
              {availableVoices.length > 0 && (
                <div className="mt-4 bg-jarvis-bg border border-jarvis-border rounded-lg p-3">
                  <p className="text-[10px] text-jarvis-muted mb-1">
                    {availableVoices.length} browser voices available · {availableVoices.filter(v => v.lang.startsWith('hi')).length} Hindi · {availableVoices.filter(v => v.lang.startsWith('en')).length} English
                  </p>
                  <details className="text-[10px] text-jarvis-muted/60">
                    <summary className="cursor-pointer hover:text-jarvis-muted transition-colors">View all browser voices</summary>
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-0.5">
                      {availableVoices.sort((a, b) => a.lang.localeCompare(b.lang)).map((v, i) => (
                        <div key={i} className="flex gap-2">
                          <span className={`font-mono ${v.lang.startsWith('hi') ? 'text-jarvis-success' : v.lang.startsWith('en') ? 'text-jarvis-cyan' : ''}`}>{v.lang}</span>
                          <span className="truncate">{v.name}</span>
                          {v.localService && <span className="text-jarvis-muted/40">local</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'api' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionHeader icon={Key} title="API Keys" />
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm text-jarvis-text">Groq (AI — Required)</label>
                  {settings.groqApiKey && (
                    <span className="text-xs text-jarvis-cyan flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                      Configured
                    </span>
                  )}
                </div>
                <input type="password" value={settings.groqApiKey} onChange={(e) => updateSettings({ groqApiKey: e.target.value })} placeholder="gsk_..."
                  className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 font-mono focus:outline-none focus:border-jarvis-cyan/40" />
                <p className="text-[10px] text-jarvis-muted mt-1">Free tier — powers all AI responses via Llama 3.1 8B</p>
              </div>
              <div>
                <label className="text-sm text-jarvis-text mb-1.5 block">Anthropic (Claude) — Optional</label>
                <input type="password" value={settings.anthropicApiKey} onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })} placeholder="sk-ant-..."
                  className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 font-mono focus:outline-none focus:border-jarvis-cyan/40" />
              </div>
              <div>
                <label className="text-sm text-jarvis-text mb-1.5 block">Brave Search — Optional</label>
                <input type="password" value={settings.braveApiKey} onChange={(e) => updateSettings({ braveApiKey: e.target.value })} placeholder="BSA-..."
                  className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 font-mono focus:outline-none focus:border-jarvis-cyan/40" />
              </div>
              <div>
                <label className="text-sm text-jarvis-text mb-1.5 block">ElevenLabs — Optional</label>
                <input type="password" value={settings.elevenLabsApiKey} onChange={(e) => updateSettings({ elevenLabsApiKey: e.target.value })} placeholder="xi-..."
                  className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 font-mono focus:outline-none focus:border-jarvis-cyan/40" />
              </div>
              <div className="pt-2 border-t border-jarvis-border">
                <p className="text-xs text-jarvis-muted">💡 Groq API key is pre-configured and required for AI responses. Weather and search use free APIs — no keys needed.</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'memory' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionHeader icon={Brain} title="Memory Settings" />
            <div className="divide-y divide-jarvis-border">
              <SettingRow label="Auto-save confirmed facts" description="Automatically store facts user confirms or explicitly shares">
                <button className="text-jarvis-cyan"><ToggleRight size={24} /></button>
              </SettingRow>
              <SettingRow label="Memory context injection" description="Inject relevant memories into AI context automatically">
                <button className="text-jarvis-cyan"><ToggleRight size={24} /></button>
              </SettingRow>
              <SettingRow label="Semantic similarity threshold" description="Minimum similarity score for memory retrieval">
                <div className="flex items-center gap-3">
                  <input type="range" min="0.5" max="1" step="0.05" defaultValue="0.75" className="w-24 accent-jarvis-violet" />
                  <span className="text-xs font-mono text-jarvis-text">0.75</span>
                </div>
              </SettingRow>
            </div>

            {/* Backup & Restore */}
            <div className="mt-6 pt-4 border-t border-jarvis-border">
              <h4 className="text-sm font-medium text-jarvis-text mb-3">Backup & Restore</h4>
              <div className="space-y-3">
                <button onClick={() => {
                  const state = useStore.getState();
                  const backup = { memories: state.memories, todos: state.todos, reminders: state.reminders, sessions: state.sessions, exportedAt: new Date().toISOString() };
                  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `aira-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
                  URL.revokeObjectURL(url);
                }} className="w-full bg-jarvis-cyan/10 border border-jarvis-cyan/30 text-jarvis-cyan rounded-lg px-4 py-2.5 text-sm hover:bg-jarvis-cyan/20 transition-colors">
                  💾 Export Backup (JSON)
                </button>
                <button onClick={() => {
                  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      const state = useStore.getState();
                      if (data.memories) for (const m of data.memories) state.addMemory(m);
                      if (data.todos) for (const t of data.todos) state.addTodo(t);
                      if (data.reminders) for (const r of data.reminders) state.addReminder(r);
                      alert('✅ Backup restored!');
                    } catch { alert('❌ Invalid backup file'); }
                  };
                  input.click();
                }} className="w-full bg-jarvis-violet/10 border border-jarvis-violet/30 text-jarvis-violet rounded-lg px-4 py-2.5 text-sm hover:bg-jarvis-violet/20 transition-colors">
                  📂 Restore from Backup
                </button>
                <button onClick={() => {
                  const state = useStore.getState();
                  const session = state.sessions.find(s => s.id === state.activeSessionId);
                  if (!session) { alert('No active chat to export'); return; }
                  const md = session.messages.map(m => `**${m.role === 'user' ? 'You' : 'Aira'}:** ${m.content}`).join('\n\n---\n\n');
                  const blob = new Blob([md], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `chat-${new Date().toISOString().slice(0,10)}.md`; a.click();
                  URL.revokeObjectURL(url);
                }} className="w-full bg-jarvis-success/10 border border-jarvis-success/30 text-jarvis-success rounded-lg px-4 py-2.5 text-sm hover:bg-jarvis-success/20 transition-colors">
                  📝 Export Chat as Markdown
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
