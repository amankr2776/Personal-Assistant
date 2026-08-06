# 🤖 JARVIS — Personal AI Assistant

> *A personal AI operating system with voice and text interaction, local + cloud AI switching, document memory, and web search — functioning fully offline for basic tasks and online for advanced ones.*

![JARVIS](https://img.shields.io/badge/JARVIS-Personal_AI_Assistant-00D9FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48dGV4dCB5PSIuOWVtIiBmb250LXNpemU9IjkwIj7wn5GAPC90ZXh0Pjwvc3ZnPg==)

## 🏗 Architecture

```
┌──────────────────────────────────────────────────┐
│                  JARVIS Desktop App               │
│  ┌─────────────┐  ┌──────────────────────────┐   │
│  │   Tauri     │  │    React 18 Frontend     │   │
│  │  (Rust)     │  │  TypeScript + Tailwind   │   │
│  │  - Hotkeys  │  │  - Zustand State         │   │
│  │  - File I/O │  │  - Framer Motion         │   │
│  │  - Native   │  │  - Markdown + Code       │   │
│  └──────┬──────┘  └──────────┬───────────────┘   │
│         │                     │                    │
│         └────────┬───────────┘                    │
│                  │                                │
│         ┌────────▼────────┐                       │
│         │  FastAPI Backend │                      │
│         │  (Python Sidecar)│                      │
│         │  - AI Routing    │                      │
│         │  - Voice STT/TTS │                      │
│         │  - Web Search    │                      │
│         │  - Doc Parsing   │                      │
│         └────┬──────┬─────┘                       │
│              │      │                             │
│    ┌─────────▼──┐ ┌─▼──────────┐                 │
│    │  Ollama    │ │ Claude API │                  │
│    │ (Local AI) │ │ (Cloud AI) │                  │
│    └────────────┘ └────────────┘                  │
│                                                   │
│    ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│    │  ChromaDB  │ │  SQLite    │ │ Whisper.cpp │  │
│    │ (Vectors)  │ │ (Data)    │ │  (Voice)    │  │
│    └────────────┘ └────────────┘ └────────────┘  │
└──────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.10+
- **Rust** 1.70+ (for Tauri desktop build)
- **Ollama** (optional, for local AI)
- **Tesseract OCR** (optional, for image text extraction)

### Development Mode

```bash
# Clone and install
cd jarvis
npm install

# Install Python backend dependencies
cd backend
pip install -r requirements.txt
cd ..

# Start both frontend and backend
./start-dev.sh
```

Or start separately:
```bash
# Terminal 1: Frontend (React + Vite)
npm run dev

# Terminal 2: Backend (FastAPI)
cd backend && python main.py

# Terminal 3: Ollama (Local LLM) — optional
ollama serve
ollama pull llama3.1:8b
```

### Desktop Build (Tauri)

```bash
# Build for current platform
npm run tauri build

# Output: .exe (Windows), .dmg (Mac), .AppImage (Linux)
```

## ✨ Features

### 🎙 Voice Activation
- **Global hotkey** (`Ctrl+Shift+J`) — opens floating voice overlay from anywhere
- **Wake word** "Jarvis" using Porcupine engine (offline, low false-positive)
- **Continuous listening** mode (toggle-able)
- **Visual mic states**: idle → listening (pulsing) → processing (spinning) → speaking (waveform)

### 💬 Chat Interface
- Markdown rendering with syntax-highlighted code blocks (Prism.js)
- **Streaming responses** — token-by-token, not full-block dumps
- File attachments (PDF, DOCX, TXT, images)
- Input bar with 🎤 mic toggle, 📎 attach file, ➤ send

### 🌐 Online/Offline Auto-Switch
- Network ping every 30s with visual status indicator
- **Green** = online (Cloud AI: Claude Sonnet 4)
- **Amber** = offline (Local AI: Llama 3.1 8B / Phi-3)
- User can override mode in Settings

### 📚 Knowledge Vault (Document Memory)
- Drag-and-drop or file-picker upload: PDF, DOCX, TXT, images (OCR)
- On upload: extract text → chunk → embed → store in ChromaDB
- Semantic search: "what was that paper about transformers?" → AI answers with citations
- Vault sidebar with document list, metadata, and tags

### 🔍 Web Search + Summarize
- Auto-triggers for queries needing current info (news, weather, prices)
- Returns 3–5 sources → AI synthesizes summary with source link cards
- Brave Search API (structured JSON results)

### 🧠 Long-Term Memory
- Explicit fact storage: "remember I have exams next week"
- Settings > Memory tab — view, edit, delete entries
- Semantic similarity retrieval injected into AI context

### 🤖 AI Agents
- Pre-built specialized agents: Research, Code, Document Analyst, Memory
- Custom agent creation (future)

## 🎨 Design System

### Theme
Dark-mode-first, **holographic HUD** aesthetic — clean sci-fi minimalism.

### Color Palette
| Token | Color | Usage |
|-------|-------|-------|
| `bg` | `#0B0F1A` | Near-black navy background |
| `surface` | `#131826` | Cards, panels |
| `border` | `#1F2937` | 1px borders |
| `cyan` | `#00D9FF` | Primary accent, active states, mic pulse |
| `violet` | `#7C3AED` | AI thinking states |
| `success` | `#10B981` | Online status |
| `warning` | `#F59E0B` | Offline status |
| `error` | `#EF4444` | Errors |

### Typography
- **Headings**: Space Grotesk (geometric, techy)
- **Body**: Inter (clean, readable)
- **Code**: JetBrains Mono

### Icons
All icons from **lucide-react** for consistency.

## 📁 Project Structure

```
jarvis/
├── src/                      # React Frontend
│   ├── components/
│   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   ├── TopBar.tsx        # Top bar with status
│   │   ├── HomeScreen.tsx    # First screen / landing
│   │   ├── ChatInterface.tsx # Chat with streaming
│   │   ├── VoiceOverlay.tsx  # Floating mic overlay
│   │   ├── VaultPanel.tsx    # Knowledge Vault
│   │   ├── MemoryPanel.tsx   # Long-term memory
│   │   ├── AgentsPanel.tsx   # AI agents
│   │   └── SettingsPanel.tsx # All settings
│   ├── stores/
│   │   └── useStore.ts       # Zustand state
│   ├── services/
│   │   └── api.ts            # API client (streaming)
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                # Rust/Tauri Backend
│   ├── src/main.rs           # Tauri commands
│   ├── Cargo.toml
│   └── tauri.conf.json
├── backend/                  # FastAPI Python Sidecar
│   ├── main.py               # All API endpoints
│   └── requirements.txt
├── index.html
├── vite.config.ts
└── package.json
```

## 🔧 Configuration

### Environment Variables
```bash
# API Keys
ANTHROPIC_API_KEY=sk-ant-...     # Claude API
BRAVE_API_KEY=BSA-...            # Brave Search
ELEVENLABS_API_KEY=xi-...        # ElevenLabs TTS

# Backend
VITE_BACKEND_URL=http://localhost:8000
JARVIS_DB_PATH=./jarvis.db
```

### AI Models
| Mode | Model | When |
|------|-------|------|
| Cloud | Claude Sonnet 4 | Online, complex queries |
| Local | Llama 3.1 8B | Offline, simple queries |
| Local | Phi-3 | Offline, fast responses |

## 📦 Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | **Tauri** | Rust + React desktop app |
| Frontend | **React 18 + TypeScript** | UI components |
| Styling | **TailwindCSS 4** | Utility-first CSS |
| State | **Zustand** | Lightweight state management |
| Animation | **Framer Motion** | Transitions & micro-interactions |
| Backend | **FastAPI** | Python API sidecar |
| Local LLM | **Ollama** | Offline AI inference |
| Cloud LLM | **Claude API** | Online AI inference |
| STT | **Whisper.cpp** | Speech-to-text |
| TTS | **Edge-TTS / ElevenLabs** | Text-to-speech |
| Database | **SQLite** | Structured data |
| Vector DB | **ChromaDB** | Document embeddings |
| Web Search | **Brave Search API** | Real-time information |

## 📄 License

MIT License — Built with ❤️ by the JARVIS team.
