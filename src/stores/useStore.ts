import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Message,
  ChatSession,
  MemoryEntry,
  VaultDocument,
  AIModel,
  AIMode,
  MicState,
  NetworkStatus,
  ActivePanel,
  AppSettings,
} from '../types';

const defaultSettings: AppSettings = {
  aiMode: 'local',
  preferredLocalModel: 'tinyllama',
  preferredCloudModel: 'claude-sonnet-4-6',
  hotkey: 'Ctrl+Shift+J',
  wakeWordEnabled: true,
  wakeWord: 'jarvis',
  continuousListening: false,
  ttsEngine: 'edge-tts',
  voiceGender: 'male',
  groqApiKey: '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',
  braveApiKey: '',
  anthropicApiKey: '',
  elevenLabsApiKey: '',
  locationEnabled: false,
  temperature: 0.7,
  maxTokens: 2048,
};

interface AppState {
  // Navigation
  activePanel: ActivePanel;
  sidebarCollapsed: boolean;
  setActivePanel: (panel: ActivePanel) => void;
  toggleSidebar: () => void;

  // Network
  networkStatus: NetworkStatus;
  setNetworkStatus: (status: NetworkStatus) => void;

  // AI
  aiMode: AIMode;
  activeModel: AIModel;
  setAiMode: (mode: AIMode) => void;
  setActiveModel: (model: AIModel) => void;

  // Chat
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;
  streamingContent: string;
  createSession: () => string;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateLastAssistantMessage: (sessionId: string, content: string) => void;
  setStreaming: (val: boolean) => void;
  setStreamingContent: (content: string) => void;
  deleteSession: (id: string) => void;

  // Voice
  micState: MicState;
  showVoiceOverlay: boolean;
  setMicState: (state: MicState) => void;
  toggleVoiceOverlay: () => void;
  setShowVoiceOverlay: (show: boolean) => void;

  // Memory
  memories: MemoryEntry[];
  addMemory: (entry: MemoryEntry) => void;
  updateMemory: (id: string, content: string) => void;
  deleteMemory: (id: string) => void;

  // Vault
  documents: VaultDocument[];
  addDocument: (doc: VaultDocument) => void;
  deleteDocument: (id: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;

  // Backend
  backendConnected: boolean;
  setBackendConnected: (val: boolean) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      activePanel: 'home',
      sidebarCollapsed: false,
      setActivePanel: (panel) => set({ activePanel: panel }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // Network
      networkStatus: 'checking',
      setNetworkStatus: (status) => set({ networkStatus: status }),

      // AI
      aiMode: 'local',
      activeModel: 'tinyllama',
      setAiMode: (mode) => set({ aiMode: mode }),
      setActiveModel: (model) => set({ activeModel: model }),

      // Chat
      sessions: [],
      activeSessionId: null,
      isStreaming: false,
      streamingContent: '',
      createSession: () => {
        const id = generateId();
        const session: ChatSession = {
          id,
          title: 'New Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: get().activeModel,
        };
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
          activePanel: 'chat',
        }));
        return id;
      },
      setActiveSession: (id) => set({ activeSessionId: id }),
      addMessage: (sessionId, message) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  messages: [...sess.messages, message],
                  updatedAt: Date.now(),
                  title:
                    sess.messages.length === 0 && message.role === 'user'
                      ? message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '')
                      : sess.title,
                }
              : sess
          ),
        })),
      updateLastAssistantMessage: (sessionId, content) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  messages: sess.messages.map((msg, i) =>
                    i === sess.messages.length - 1 && msg.role === 'assistant'
                      ? { ...msg, content }
                      : msg
                  ),
                }
              : sess
          ),
        })),
      setStreaming: (val) => set({ isStreaming: val }),
      setStreamingContent: (content) => set({ streamingContent: content }),
      deleteSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== id),
          activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        })),

      // Voice
      micState: 'idle',
      showVoiceOverlay: false,
      setMicState: (state) => set({ micState: state }),
      toggleVoiceOverlay: () => set((s) => ({ showVoiceOverlay: !s.showVoiceOverlay })),
      setShowVoiceOverlay: (show) => set({ showVoiceOverlay: show }),

      // Memory
      memories: [],
      addMemory: (entry) => set((s) => ({ memories: [entry, ...s.memories] })),
      updateMemory: (id, content) =>
        set((s) => ({
          memories: s.memories.map((m) =>
            m.id === id ? { ...m, content, updatedAt: Date.now() } : m
          ),
        })),
      deleteMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),

      // Vault
      documents: [],
      addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),
      deleteDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      // Settings
      settings: defaultSettings,
      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      // Backend
      backendConnected: false,
      setBackendConnected: (val) => set({ backendConnected: val }),
    }),
    {
      name: 'jarvis-store',
      partialize: (state) => ({
        sessions: state.sessions,
        memories: state.memories,
        documents: state.documents,
        settings: state.settings,
        aiMode: state.aiMode,
      }),
    }
  )
);
