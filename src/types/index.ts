export interface Message {
  id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number;
  sources?: Source[]; attachedFiles?: AttachedFile[];
}

export interface Source { title: string; url: string; snippet: string; }
export interface AttachedFile { name: string; type: string; size: number; content?: string; }

export interface ChatSession {
  id: string; title: string; messages: Message[];
  createdAt: number; updatedAt: number; model: AIModel;
}

export interface MemoryEntry {
  id: string; content: string; category: string;
  createdAt: number; updatedAt: number;
}

export interface VaultDocument {
  id: string; filename: string; fileType: string; size: number;
  tags: string[]; chunkCount: number; uploadedAt: number; summary?: string;
  content?: string; // actual text content for querying
  imageData?: string; // base64 data for images
}

export type AIModel = 'tinyllama' | 'llama3.1-8b' | 'llama-3.1-8b-instant' | 'phi-3' | 'claude-sonnet-4-6';
export type AIMode = 'cloud' | 'local' | 'auto';
export type MicState = 'idle' | 'listening' | 'processing' | 'speaking';
export type NetworkStatus = 'online' | 'offline' | 'checking';
export type ActivePanel = 'home' | 'chat' | 'vault' | 'memory' | 'reminders' | 'todos' | 'code' | 'images' | 'settings';

// Reminder
export interface Reminder {
  id: string;
  text: string;
  time: number; // Unix timestamp when it should fire
  isRepeating: boolean;
  repeatInterval?: number; // ms — 86400000 = daily
  isDone: boolean;
  createdAt: number;
}

// Todo
export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: number; // Unix timestamp
  category: string;
  createdAt: number;
}

// Single voice: Aira (female)
export type VoicePresetId = 'aira';

export interface VoicePreset {
  id: VoicePresetId;
  name: string;
  gender: 'female';
  description: string;
  enMatch: string[];
  hiMatch: string[];
  fallbackLang: string;
  pitch: number;
  rate: number;
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'aira',
    name: 'Aira',
    gender: 'female',
    description: 'Warm, intelligent female voice — speaks English & Hindi',
    enMatch: ['Microsoft Heera', 'Heera', 'Lekha', 'Google UK English Female', 'Microsoft Zira', 'Zira', 'Microsoft Eva'],
    hiMatch: ['Microsoft Swara', 'Swara', 'Lekha', 'Heera'],
    fallbackLang: 'en-IN',
    pitch: 1.0,
    rate: 0.95,
  },
];

export interface AppSettings {
  aiMode: AIMode; preferredLocalModel: AIModel; preferredCloudModel: AIModel;
  hotkey: string; wakeWordEnabled: boolean; wakeWord: string;
  continuousListening: boolean; ttsEngine: 'edge-tts' | 'elevenlabs'; voiceGender: 'female';
  selectedVoice: VoicePresetId;
  groqApiKey: string; braveApiKey: string; anthropicApiKey: string; elevenLabsApiKey: string;
  locationEnabled: boolean; temperature: number; maxTokens: number;
}

export interface WebSearchResult { title: string; url: string; snippet: string; }
export interface VoiceTranscript { text: string; confidence: number; isFinal: boolean; }
