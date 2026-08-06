export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sources?: Source[];
  attachedFiles?: AttachedFile[];
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface AttachedFile {
  name: string;
  type: string;
  size: number;
  content?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model: AIModel;
}

export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export interface VaultDocument {
  id: string;
  filename: string;
  fileType: string;
  size: number;
  tags: string[];
  chunkCount: number;
  uploadedAt: number;
  summary?: string;
}

export type AIModel = 'tinyllama' | 'llama3.1-8b' | 'phi-3' | 'claude-sonnet-4-6';
export type AIMode = 'cloud' | 'local' | 'auto';
export type MicState = 'idle' | 'listening' | 'processing' | 'speaking';
export type NetworkStatus = 'online' | 'offline' | 'checking';
export type ActivePanel = 'home' | 'chat' | 'vault' | 'memory' | 'agents' | 'settings';

export interface AppSettings {
  aiMode: AIMode;
  preferredLocalModel: AIModel;
  preferredCloudModel: AIModel;
  hotkey: string;
  wakeWordEnabled: boolean;
  wakeWord: string;
  continuousListening: boolean;
  ttsEngine: 'edge-tts' | 'elevenlabs';
  voiceGender: 'male' | 'female';
  groqApiKey: string;
  braveApiKey: string;
  anthropicApiKey: string;
  elevenLabsApiKey: string;
  locationEnabled: boolean;
  temperature: number;
  maxTokens: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface VoiceTranscript {
  text: string;
  confidence: number;
  isFinal: boolean;
}
