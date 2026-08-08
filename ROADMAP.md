# 🗺️ AIRA — Full Proficiency Roadmap

## ✅ Currently Working
| Feature | Status |
|---|---|
| AI Chat (Gemini → Groq fallback, streaming) | ✅ |
| Voice Input (Whisper STT, silence detection) | ✅ |
| Voice Output (Edge TTS, Aira female voice) | ✅ |
| Auto-speak after AI response | ✅ |
| Aira character with lip sync | ✅ |
| Memory auto-save + explicit "remember" commands | ✅ |
| Memory PIN lock + App PIN lock | ✅ |
| Smart YouTube (specific song → auto-play, artist → search) | ✅ |
| GitHub & LinkedIn profile opening | ✅ |
| Real-time weather (Open-Meteo, 20 Indian cities) | ✅ |
| Web search (Wikipedia + DuckDuckGo) | ✅ |
| File attachments (text, code, images → AI context) | ✅ |
| Knowledge Vault (upload, summarize, query) | ✅ |
| Language enforcement (English/Hindi only) | ✅ |
| No memory source disclosure | ✅ |
| Conversation history (last 20 messages) | ✅ |
| App lock screen | ✅ |

---

## 🔴 CRITICAL — Must Do (App feels incomplete without these)

### 1. PWA Install Support
**Why**: Users should install AIRA as a native app on phone/desktop. No app store needed.
**How**:
- Add `manifest.json` with app name, icons, theme color, `start_url`
- Add service worker (`vite-plugin-pwa`) for offline caching
- Show "Install AIRA" prompt on first visit
- **Effort**: 2 hours

### 2. Live Cricket Scores
**Why**: Most asked query in India. Currently AI gives outdated info or says "I don't know".
**How**:
- Use CricAPI (free tier: 100 req/day) or `api.cricapi.com`
- Fallback: scrape ESPN Cricinfo HTML
- Add `/api/cricket` serverless endpoint
- AI auto-detects cricket queries → fetches live scores
- **Effort**: 3 hours

### 3. News Integration (Search-based, no separate panel)
**Why**: "aaj kya hua", "latest news", "टेक न्यूज" — users ask daily.
**How**:
- Use GNews API (free: 100 req/day) or NewsData.io (free: 200 req/day)
- Add `/api/news` serverless endpoint
- AI detects news queries → fetches top 5 headlines → includes in response
- NO separate news panel — just AI-powered answers
- **Effort**: 2 hours

### 4. Reminder / Alarm System
**Why**: "remind me at 5pm", "5 बजे याद दिलाना" — core assistant feature.
**How**:
- Store reminders in Zustand (persisted to localStorage)
- Use `Notification API` for browser notifications
- Background timer checks every 30s
- "show reminders" / "मेरे रिमाइंडर" → list all
- "delete reminder X" → remove
- **Effort**: 4 hours

### 5. Todo / Task Manager
**Why**: "add todo: complete assignment", "मेरे टास्क" — basic productivity.
**How**:
- `TodoItem` type: id, text, done, priority, dueDate, category
- Store in Zustand (persisted)
- Commands: "add todo X", "mark done X", "show todos", "delete todo X"
- Dedicated TodoPanel in sidebar
- **Effort**: 4 hours

---

## 🟡 IMPORTANT — Should Do (Makes app feel professional)

### 6. Calculator / Math Engine
**Why**: "25 * 48", "sin(30)", "factorial of 10" — quick math.
**How**:
- Use `math.js` library for complex expressions
- Detect pure math patterns in chat → evaluate locally → instant answer
- No API call needed for math
- **Effort**: 2 hours

### 7. Pomodoro / Study Timer
**Why**: You're a student. Focus timer is essential.
**How**:
- 25min work / 5min break cycle
- Circular timer animation on home screen
- "start pomodoro", "स्टडी टाइम" → starts timer
- Browser notification when break starts
- Track daily study hours in memory
- **Effort**: 3 hours

### 8. PDF/DOCX Parsing on Server
**Why**: Vault currently can't read PDFs/DOCX — only text files.
**How**:
- Install `pdf-parse` and `mammoth` (DOCX) as Node deps
- In `/api/chat`, accept file content as base64
- Parse PDF/DOCX server-side → extract text → send to AI
- **Effort**: 3 hours

### 9. Export Chat & Memory Backup
**Why**: Users need to backup data and export conversations.
**How**:
- "export chat" → download as Markdown file
- "backup memory" → download as JSON
- "restore memory" → upload JSON file
- Settings panel buttons for backup/restore
- **Effort**: 2 hours

### 10. Share Response
**Why**: Share AI answers via WhatsApp, copy, etc.
**How**:
- Share button on every AI response
- Uses `navigator.share()` (Web Share API) on mobile
- Fallback: copy to clipboard
- **Effort**: 1 hour

### 11. Code Execution (Python/JS)
**Why**: "run this code" — execute snippets safely.
**How**:
- Use Judge0 API (free: 50 req/day) or Piston API (free, open source)
- Add `/api/execute` serverless endpoint
- Detect code blocks with "run" keyword → execute → show output
- **Effort**: 3 hours

---

## 🟢 NICE TO HAVE — Future Enhancements

### 12. Image Generation
- "draw a mountain landscape" → generate image via free API
- Pollinations.ai (free, no key) or HuggingFace Inference API
- **Effort**: 2 hours

### 13. Translate Command
- "translate to Hindi: hello world" → translation
- MyMemory API (free, no key)
- **Effort**: 1 hour

### 14. Expense Tracker
- "spent 500 on food" → auto-track
- Category-wise monthly report
- **Effort**: 4 hours

### 15. Gmail Integration
- OAuth flow for reading/sending emails
- "check my emails", "send email to X"
- **Effort**: 6 hours (complex OAuth)

### 16. Google Calendar
- "add event: exam on 15th August"
- "what's my schedule today?"
- **Effort**: 4 hours (needs OAuth)

### 17. Location-aware Weather
- Auto-detect city via Geolocation API
- No need to say "patna mausam" — just "mausam kaisa hai?"
- **Effort**: 1 hour

### 18. Quick Notes / Clipboard
- "note: buy groceries" → quick note saved
- "my notes" → show all
- Separate from memory (temporary vs permanent)
- **Effort**: 2 hours

### 19. Performance Optimization
- Code splitting (React.lazy for panels)
- Reduce bundle from 1.1MB → ~400KB
- Lazy load SyntaxHighlighter, Framer Motion
- **Effort**: 3 hours

### 20. Accessibility
- Keyboard navigation
- Screen reader support (ARIA labels)
- High contrast mode
- **Effort**: 4 hours

### 21. Multi-user Support
- Profile switching (if family uses same app)
- Separate memories per user
- **Effort**: 6 hours

### 22. Desktop App (Electron/Tauri)
- Package as desktop app
- System tray integration
- Global hotkey from anywhere
- **Effort**: 8 hours

---

## 📋 RECOMMENDED ORDER (Priority Sequence)

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | PWA Install | 2h | 🔴 Critical |
| 2 | Live Cricket Scores | 3h | 🔴 Critical |
| 3 | News Integration | 2h | 🔴 Critical |
| 4 | Reminder/Alarm System | 4h | 🔴 Critical |
| 5 | Todo/Task Manager | 4h | 🔴 Critical |
| 6 | Calculator/Math | 2h | 🟡 High |
| 7 | Pomodoro Timer | 3h | 🟡 High |
| 8 | Export Chat & Backup | 2h | 🟡 High |
| 9 | Share Response | 1h | 🟡 High |
| 10 | PDF/DOCX Parsing | 3h | 🟡 Medium |
| 11 | Code Execution | 3h | 🟡 Medium |
| 12 | Location Weather | 1h | 🟢 Nice |
| 13 | Translate | 1h | 🟢 Nice |
| 14 | Image Generation | 2h | 🟢 Nice |
| 15 | Quick Notes | 2h | 🟢 Nice |

**Total for Critical (1-5)**: ~15 hours
**Total for Important (6-11)**: ~14 hours
**Total for Nice (12-15)**: ~6 hours

---

## 🛠️ CLEANUP (Quick wins, <1 hour each)
- Remove unused components: `GitHubPanel.tsx`, `GmailPanel.tsx`, `NewsPanel.tsx`, `YouTubePlayer.tsx`
- Remove unused API: `api/gmail.ts`
- Update Settings panel — "AI Mode" dropdown still shows "Local (Ollama)" but only Cloud works
- Update HomeScreen quick chips — "My GitHub" chip could be more useful
- Add proper error boundary component
- Add loading skeletons instead of spinner dots
- Fix Aira character image path if missing on Vercel
