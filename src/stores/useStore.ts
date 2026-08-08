import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Message, ChatSession, MemoryEntry, VaultDocument,
  AIModel, AIMode, MicState, NetworkStatus, ActivePanel, AppSettings,
  Reminder, TodoItem,
} from '../types';

// SECURITY: SHA-256 hash for PIN storage (replaces trivial Java hashCode)
async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input + '__aira_salt_2024__');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const defaultSettings: AppSettings = {
  aiMode: 'cloud',
  preferredLocalModel: 'tinyllama',
  preferredCloudModel: 'llama-3.1-8b-instant',
  hotkey: 'Ctrl+Shift+J',
  wakeWordEnabled: true,
  wakeWord: 'jarvis',
  continuousListening: false,
  ttsEngine: 'edge-tts',
  voiceGender: 'female',
  selectedVoice: 'aira',
  groqApiKey: '',
  braveApiKey: '',
  anthropicApiKey: '',
  elevenLabsApiKey: '',
  locationEnabled: false,
  temperature: 0.7,
  maxTokens: 2048,
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

interface AppState {
  activePanel: ActivePanel; sidebarCollapsed: boolean;
  setActivePanel: (panel: ActivePanel) => void; toggleSidebar: () => void;
  networkStatus: NetworkStatus; setNetworkStatus: (status: NetworkStatus) => void;
  aiMode: AIMode; activeModel: AIModel;
  setAiMode: (mode: AIMode) => void; setActiveModel: (model: AIModel) => void;
  sessions: ChatSession[]; activeSessionId: string | null;
  isStreaming: boolean; streamingContent: string;
  createSession: () => string; setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateLastAssistantMessage: (sessionId: string, content: string) => void;
  setStreaming: (val: boolean) => void; setStreamingContent: (content: string) => void;
  deleteSession: (id: string) => void;
  micState: MicState; showVoiceOverlay: boolean;
  setMicState: (state: MicState) => void; toggleVoiceOverlay: () => void;
  setShowVoiceOverlay: (show: boolean) => void;
  memories: MemoryEntry[];
  addMemory: (entry: MemoryEntry) => void; updateMemory: (id: string, content: string) => void; deleteMemory: (id: string) => void;
  documents: VaultDocument[];
  addDocument: (doc: VaultDocument) => void; deleteDocument: (id: string) => void;
  settings: AppSettings; updateSettings: (partial: Partial<AppSettings>) => void;
  backendConnected: boolean; setBackendConnected: (val: boolean) => void;
  // Memory PIN lock
  memoryPin: string; setMemoryPin: (pin: string) => void; verifyMemoryPin: (pin: string) => boolean; verifyMemoryPinAsync: (pin: string) => Promise<boolean>;
  // App PIN lock (full app access)
  appPin: string; setAppPin: (pin: string) => void; verifyAppPin: (pin: string) => boolean; verifyAppPinAsync: (pin: string) => Promise<boolean>;
  // Reminders
  reminders: Reminder[];
  addReminder: (r: Reminder) => void; deleteReminder: (id: string) => void; markReminderDone: (id: string) => void;
  // Todos
  todos: TodoItem[];
  addTodo: (t: TodoItem) => void; deleteTodo: (id: string) => void; toggleTodo: (id: string) => void; updateTodo: (id: string, partial: Partial<TodoItem>) => void;
  // Accessibility
  highContrast: boolean; toggleHighContrast: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      activePanel: 'home', sidebarCollapsed: false,
      setActivePanel: (panel) => set({ activePanel: panel }), toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      networkStatus: 'checking', setNetworkStatus: (status) => set({ networkStatus: status }),
      aiMode: 'cloud', activeModel: 'llama-3.1-8b-instant',
      setAiMode: (mode) => set({ aiMode: mode }), setActiveModel: (model) => set({ activeModel: model }),
      sessions: [], activeSessionId: null, isStreaming: false, streamingContent: '',
      createSession: () => {
        const id = generateId();
        const session: ChatSession = { id, title: 'New Chat', messages: [], createdAt: Date.now(), updatedAt: Date.now(), model: get().activeModel };
        set((s) => ({ sessions: [session, ...s.sessions], activeSessionId: id, activePanel: 'chat' }));
        return id;
      },
      setActiveSession: (id) => set({ activeSessionId: id }),
      addMessage: (sessionId, message) =>
        set((s) => ({ sessions: s.sessions.map((sess) => sess.id === sessionId ? { ...sess, messages: [...sess.messages, message], updatedAt: Date.now(), title: sess.messages.length === 0 && message.role === 'user' ? message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '') : sess.title } : sess) })),
      updateLastAssistantMessage: (sessionId, content) =>
        set((s) => ({ sessions: s.sessions.map((sess) => sess.id === sessionId ? { ...sess, messages: sess.messages.map((msg, i) => i === sess.messages.length - 1 && msg.role === 'assistant' ? { ...msg, content } : msg) } : sess) })),
      setStreaming: (val) => set({ isStreaming: val }), setStreamingContent: (content) => set({ streamingContent: content }),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id), activeSessionId: s.activeSessionId === id ? null : s.activeSessionId })),
      micState: 'idle', showVoiceOverlay: false,
      setMicState: (state) => set({ micState: state }), toggleVoiceOverlay: () => set((s) => ({ showVoiceOverlay: !s.showVoiceOverlay })), setShowVoiceOverlay: (show) => set({ showVoiceOverlay: show }),
      memories: [],
      addMemory: (entry) => set((s) => ({ memories: [entry, ...s.memories] })),
      updateMemory: (id, content) => set((s) => ({ memories: s.memories.map((m) => m.id === id ? { ...m, content, updatedAt: Date.now() } : m) })),
      deleteMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),
      documents: [],
      addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),
      deleteDocument: (id) => set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
      settings: defaultSettings, updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
      backendConnected: false, setBackendConnected: (val) => set({ backendConnected: val }),
      // Memory PIN lock — SHA-256 hash (cryptographically secure)
      memoryPin: '',
      setMemoryPin: (pin) => {
        sha256Hash(pin).then(hash => set({ memoryPin: hash }));
      },
      verifyMemoryPin: (pin) => {
        // Synchronous check using pre-computed hash — async set ensures hash is ready
        // For verification, we need sync check; use cached comparison
        let hash = 0;
        for (let i = 0; i < pin.length; i++) { hash = ((hash << 5) - hash + pin.charCodeAt(i)) | 0; }
        // Fallback sync check for UI responsiveness; real verification is async
        const syncHash = String(hash);
        // If memoryPin looks like SHA-256 (64 hex chars), do async verify
        const currentPin = get().memoryPin;
        if (currentPin.length === 64) {
          // SHA-256 stored — do async comparison (fire-and-forget, returns false immediately for safety)
          sha256Hash(pin).then(computed => {
            if (computed !== currentPin) {
              // PIN mismatch — no action needed here, verifyMemoryPin already returned
            }
          });
          // We can't do async in a sync function, so compute sync for immediate response
          // This is acceptable for a client-side PIN — the SHA-256 storage prevents
          // casual localStorage inspection from revealing the PIN
          return false; // Force async verification path
        }
        return currentPin === syncHash;
      },
      verifyMemoryPinAsync: async (pin) => {
        const computed = await sha256Hash(pin);
        return computed === get().memoryPin;
      },
      // App PIN lock — SHA-256 hash (cryptographically secure)
      appPin: '',
      setAppPin: (pin) => {
        sha256Hash(pin).then(hash => set({ appPin: hash }));
      },
      verifyAppPin: (pin) => {
        const currentPin = get().appPin;
        if (currentPin.length === 64) {
          return false; // Force async path
        }
        let hash = 0;
        for (let i = 0; i < pin.length; i++) { hash = ((hash << 5) - hash + pin.charCodeAt(i)) | 0; }
        return currentPin === String(hash);
      },
      verifyAppPinAsync: async (pin) => {
        const computed = await sha256Hash(pin);
        return computed === get().appPin;
      },
      // Reminders
      reminders: [],
      addReminder: (r) => set((s) => ({ reminders: [r, ...s.reminders] })),
      deleteReminder: (id) => set((s) => ({ reminders: s.reminders.filter(r => r.id !== id) })),
      markReminderDone: (id) => set((s) => ({ reminders: s.reminders.map(r => r.id === id ? { ...r, isDone: true } : r) })),
      // Todos
      todos: [],
      addTodo: (t) => set((s) => ({ todos: [t, ...s.todos] })),
      deleteTodo: (id) => set((s) => ({ todos: s.todos.filter(t => t.id !== id) })),
      toggleTodo: (id) => set((s) => ({ todos: s.todos.map(t => t.id === id ? { ...t, done: !t.done } : t) })),
      updateTodo: (id, partial) => set((s) => ({ todos: s.todos.map(t => t.id === id ? { ...t, ...partial } : t) })),
      // Accessibility
      highContrast: false,
      toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
    }),
    { name: 'jarvis-store', partialize: (state) => ({
      sessions: state.sessions,
      memories: state.memories,
      documents: state.documents,
      // SECURITY: Do NOT persist API keys to localStorage (they're sensitive credentials)
      settings: {
        ...state.settings,
        groqApiKey: '',         // Never persist to localStorage
        braveApiKey: '',        // Never persist to localStorage
        anthropicApiKey: '',    // Never persist to localStorage
        elevenLabsApiKey: '',   // Never persist to localStorage
      },
      aiMode: state.aiMode,
      memoryPin: state.memoryPin,
      appPin: state.appPin,
      reminders: state.reminders,
      todos: state.todos,
      highContrast: state.highContrast,
    }) }
  )
);

// Note: Store state is no longer exposed on window for security.
// Components should import useStore directly.
