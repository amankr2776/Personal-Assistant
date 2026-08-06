import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Cloud,
  CloudOff,
  Mic,
  Keyboard,
  Volume2,
  Brain,
  Globe,
  Key,
  Sliders,
  Thermometer,
  Hash,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useStore } from '../stores/useStore';
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
  const { settings, updateSettings, aiMode, setAiMode, activeModel, setActiveModel, networkStatus } = useStore();
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'voice' | 'api' | 'memory'>('general');

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Sliders },
    { id: 'ai' as const, label: 'AI Models', icon: Brain },
    { id: 'voice' as const, label: 'Voice & Speech', icon: Mic },
    { id: 'api' as const, label: 'API Keys', icon: Key },
    { id: 'memory' as const, label: 'Memory', icon: Brain },
  ];

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
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                  ${activeTab === tab.id ? 'bg-jarvis-cyan/10 text-jarvis-cyan' : 'text-jarvis-muted hover:bg-jarvis-border hover:text-jarvis-text'}`}
              >
                <Icon size={14} />
                {tab.label}
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
                <select
                  value={aiMode}
                  onChange={(e) => setAiMode(e.target.value as AIMode)}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-text
                    focus:outline-none focus:border-jarvis-cyan/40"
                >
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
                  <button
                    onClick={() => updateSettings({ wakeWordEnabled: !settings.wakeWordEnabled })}
                    className={settings.wakeWordEnabled ? 'text-jarvis-cyan' : 'text-jarvis-muted'}
                  >
                    {settings.wakeWordEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <span className="text-sm text-jarvis-text font-mono">{settings.wakeWord}</span>
                </div>
              </SettingRow>
              <SettingRow label="Location Services" description="For weather and local information">
                <button
                  onClick={() => updateSettings({ locationEnabled: !settings.locationEnabled })}
                  className={settings.locationEnabled ? 'text-jarvis-cyan' : 'text-jarvis-muted'}
                >
                  {settings.locationEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
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
                <select
                  value={settings.preferredCloudModel}
                  onChange={(e) => updateSettings({ preferredCloudModel: e.target.value as AIModel })}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-text
                    focus:outline-none focus:border-jarvis-cyan/40"
                >
                  <option value="claude-sonnet-4-6">Claude Sonnet 4 (future)</option>
                </select>
              </SettingRow>
              <SettingRow label="Local Model (Ollama)" description="Ollama model for all queries — runs locally">
                <select
                  value={settings.preferredLocalModel}
                  onChange={(e) => updateSettings({ preferredLocalModel: e.target.value as AIModel })}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-text
                    focus:outline-none focus:border-jarvis-cyan/40"
                >
                  <option value="tinyllama">TinyLlama (1.1B — fast)</option>
                  <option value="phi3:mini">Phi-3 Mini (2.4B — balanced)</option>
                  <option value="llama3.1:8b">Llama 3.1 8B (best — needs 8GB RAM)</option>
                </select>
              </SettingRow>
              <SettingRow label="Temperature" description="Higher = more creative, Lower = more precise">
                <div className="flex items-center gap-3">
                  <Thermometer size={14} className="text-jarvis-muted" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
                    className="w-24 accent-jarvis-cyan"
                  />
                  <span className="text-xs font-mono text-jarvis-text w-8">{settings.temperature}</span>
                </div>
              </SettingRow>
              <SettingRow label="Max Tokens" description="Maximum response length">
                <div className="flex items-center gap-3">
                  <Hash size={14} className="text-jarvis-muted" />
                  <input
                    type="number"
                    value={settings.maxTokens}
                    onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) || 4096 })}
                    className="w-20 bg-jarvis-bg border border-jarvis-border rounded-lg px-2 py-1 text-sm text-jarvis-text font-mono
                      focus:outline-none focus:border-jarvis-cyan/40"
                  />
                </div>
              </SettingRow>
            </div>
          </motion.div>
        )}

        {activeTab === 'voice' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionHeader icon={Mic} title="Voice & Speech" />
            <div className="divide-y divide-jarvis-border">
              <SettingRow label="Continuous Listening" description="Always listen for wake word">
                <button
                  onClick={() => updateSettings({ continuousListening: !settings.continuousListening })}
                  className={settings.continuousListening ? 'text-jarvis-cyan' : 'text-jarvis-muted'}
                >
                  {settings.continuousListening ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </SettingRow>
              <SettingRow label="TTS Engine" description="Text-to-speech voice engine">
                <select
                  value={settings.ttsEngine}
                  onChange={(e) => updateSettings({ ttsEngine: e.target.value as 'edge-tts' | 'elevenlabs' })}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-text
                    focus:outline-none focus:border-jarvis-cyan/40"
                >
                  <option value="edge-tts">Edge TTS (Free)</option>
                  <option value="elevenlabs">ElevenLabs (Premium)</option>
                </select>
              </SettingRow>
              <SettingRow label="Voice Gender" description="Voice gender for speech output">
                <select
                  value={settings.voiceGender}
                  onChange={(e) => updateSettings({ voiceGender: e.target.value as 'male' | 'female' })}
                  className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-text
                    focus:outline-none focus:border-jarvis-cyan/40"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </SettingRow>
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
                <input
                  type="password"
                  value={settings.groqApiKey}
                  onChange={(e) => updateSettings({ groqApiKey: e.target.value })}
                  placeholder="gsk_..."
                  className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text
                    placeholder:text-jarvis-muted/50 font-mono focus:outline-none focus:border-jarvis-cyan/40"
                />
                <p className="text-[10px] text-jarvis-muted mt-1">Free tier — powers all AI responses via Llama 3.1 8B</p>
              </div>
              <div>
                <label className="text-sm text-jarvis-text mb-1.5 block">Anthropic (Claude) — Optional</label>
                <input
                  type="password"
                  value={settings.anthropicApiKey}
                  onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
                  placeholder="sk-ant-..."
                  className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text
                    placeholder:text-jarvis-muted/50 font-mono focus:outline-none focus:border-jarvis-cyan/40"
                />
              </div>
              <div>
                <label className="text-sm text-jarvis-text mb-1.5 block">Brave Search — Optional</label>
                <input
                  type="password"
                  value={settings.braveApiKey}
                  onChange={(e) => updateSettings({ braveApiKey: e.target.value })}
                  placeholder="BSA-..."
                  className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text
                    placeholder:text-jarvis-muted/50 font-mono focus:outline-none focus:border-jarvis-cyan/40"
                />
              </div>
              <div>
                <label className="text-sm text-jarvis-text mb-1.5 block">ElevenLabs — Optional</label>
                <input
                  type="password"
                  value={settings.elevenLabsApiKey}
                  onChange={(e) => updateSettings({ elevenLabsApiKey: e.target.value })}
                  placeholder="xi-..."
                  className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text
                    placeholder:text-jarvis-muted/50 font-mono focus:outline-none focus:border-jarvis-cyan/40"
                />
              </div>
              <div className="pt-2 border-t border-jarvis-border">
                <p className="text-xs text-jarvis-muted">
                  💡 Groq API key is pre-configured and required for AI responses. Weather and search use free APIs (Open-Meteo, DuckDuckGo) — no keys needed.
                </p>
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
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.05"
                    defaultValue="0.75"
                    className="w-24 accent-jarvis-violet"
                  />
                  <span className="text-xs font-mono text-jarvis-text">0.75</span>
                </div>
              </SettingRow>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
