# 🔮 AIRA — Personal Improvement Recommendations

## ✅ #20 Accessibility — DONE
- Skip-to-content link (Tab on load → "Skip to main content")
- Focus-visible ring (cyan outline for keyboard navigation)
- `prefers-reduced-motion` — disables animations for users who set it
- High Contrast Mode (Settings → General → toggle)
- ARIA landmarks: `role="navigation"` sidebar, `role="main"` content
- ARIA labels on sidebar buttons, `aria-current="page"` on active item

---

## 🚀 RECOMMENDED NEXT FEATURES (for YOU personally)

### 1. 🔐 Gmail Read-Only Integration (Smart, Safe)
**Why**: "check my emails", "koi important mail hai?" — daily use
**How**: Use Gmail API with **read-only scope** (`gmail.readonly`)
- NEVER use `gmail.send` or `gmail.compose` scope
- Store OAuth token in encrypted Vercel env var, NOT localStorage
- Smart commands: "check emails", "unread mails", "कोई मेल है?"
- Shows latest 5 unread emails with subject + sender + snippet

### 2. 📅 Google Calendar Integration
**Why**: "aaj kya hai?", "my schedule", "add event: exam on 15th"
**How**: Calendar API read-only + write for events you add
- "aaj ka schedule" → shows today's events
- "add event: Viva on 20th August at 10am" → creates event
- Morning briefing: auto-shows today's schedule

### 3. 🌅 Morning Briefing (Auto-trigger)
**Why**: You open AIRA in the morning → it should TELL you what's happening
**How**: On app open (first time of day), auto-generate briefing:
  - Today's date + day
  - Weather for your city
  - Unread emails count
  - Today's calendar events
  - Pending tasks + upcoming reminders
  - Cricket scores (if match is live)
- "good morning" / "morning briefing" / "सुप्रभात" → triggers it

### 4. 📊 Expense Tracker (Simple, Voice-powered)
**Why**: "spent 200 on food", "500 on recharge" — you say it, it tracks
**How**: 
  - "spent X on Y" → adds expense entry
  - "monthly report" → category-wise breakdown with chart
  - Store in Zustand (persisted)
  - Categories: Food, Travel, Recharge, Shopping, Medical, Education, Other
  - Monthly total + daily average

### 5. 🎨 Image Generation
**Why**: "draw a mountain landscape", "create logo for my project"
**How**: Pollinations.ai — FREE, no API key, no signup
  - `https://image.pollinations.ai/prompt/{description}?width=512&height=512`
  - Returns image directly — no API call needed
  - Smart command: "draw X", "generate image X", "चित्र बनाओ X"

### 6. 📱 PWA Install Support (Critical for Play Store)
**Why**: Without this, you can't deploy to Play Store via TWA
**How**: 
  - `vite-plugin-pwa` for service worker
  - `manifest.json` with icons, theme color, start_url
  - "Install AIRA" prompt on first visit
  - Offline mode: cache static assets + last chat

### 7. 🔔 Persistent Notifications (Background)
**Why**: Reminders only work while app is open. Use Service Worker.
**How**: 
  - Service Worker with `showNotification()`
  - Push API for server-triggered notifications
  - Works even when browser tab is closed

### 8. 🌐 WhatsApp Web Shortcut
**Why**: "open whatsapp" → directly opens wa.me or web.whatsapp.com
**How**: Simple smart command, no API needed
  - "whatsapp" / "व्हाट्सएप" → opens web.whatsapp.com
  - "whatsapp aman" → opens wa.me/919876543210

### 9. 📚 Quick Notes (Separate from Memory)
**Why**: "note: buy groceries" — temporary notes, not permanent memory
**How**: 
  - Separate from memory (notes = temporary, memory = permanent facts)
  - "note X" / "नोट X" → adds note
  - "my notes" → shows all with checkboxes
  - Auto-delete notes older than 7 days

### 10. 🧘 Habit Tracker
**Why**: Track daily habits — study, exercise, water, sleep
**How**: 
  - "habit: studied 2 hours" / "habit: drank 3L water"
  - Daily streak counter
  - Weekly chart
  - "my habits" → shows today's progress

---

## 🔒 SECURITY ANALYSIS: Gmail + AI Services

### Can Gemini/Ollama misuse your Gmail credentials?

**Short answer: NO, but be careful HOW you implement it.**

**Detailed answer:**

1. **Gemini (Google's AI) ≠ your app code**
   - Gemini is an AI MODEL. It receives text and generates text.
   - It does NOT have access to your Gmail tokens, your Vercel env vars, or your localStorage.
   - The Gemini API call only sends: system prompt + user message + conversation history.
   - Gemini CANNOT make API calls on its own. It only returns text.

2. **Where the real risk is:**
   - Your **app code** (running in the browser or Vercel serverless) handles the Gmail OAuth tokens.
   - If someone gets access to your Vercel deployment URL AND your OAuth tokens are stored insecurely, they could potentially read your emails.
   - **But**: Since only YOU use this app, the attack surface is minimal.

3. **How to do Gmail safely:**
   - ✅ Use `gmail.readonly` scope ONLY (never `gmail.modify` or `gmail.compose`)
   - ✅ Store OAuth refresh token in **Vercel encrypted env vars**, not in localStorage
   - ✅ Access token in memory only (never persisted to disk)
   - ✅ Add a "Disconnect Gmail" button that revokes the token
   - ✅ Limit email fetching to last 10 emails only
   - ❌ NEVER send email content to Gemini in the system prompt (send only subject + sender)
   - ❌ NEVER store raw email content in localStorage

4. **Ollama is 100% local** — it runs on YOUR machine. Zero external risk.

5. **For Play Store (future):**
   - When you make it public, each user gets their OWN OAuth token
   - Use Google Sign-In for authentication
   - Store tokens per-user, encrypted
   - Add clear Privacy Policy stating what data is accessed

### Verdict:
**Safe to use Gmail read-only for personal use. Just follow the security practices above.**
For a public Play Store release, you'll need proper OAuth flow + privacy policy.

---

## 🎯 RECOMMENDED PRIORITY ORDER (for you)

| # | Feature | Effort | Daily Impact |
|---|---------|--------|--------------|
| 1 | Morning Briefing | 2h | ⭐⭐⭐⭐⭐ |
| 2 | Expense Tracker | 3h | ⭐⭐⭐⭐ |
| 3 | Image Generation | 1h | ⭐⭐⭐ |
| 4 | PWA Install | 2h | ⭐⭐⭐⭐⭐ (for Play Store) |
| 5 | Gmail (read-only) | 4h | ⭐⭐⭐⭐ |
| 6 | Google Calendar | 4h | ⭐⭐⭐⭐ |
| 7 | Quick Notes | 1h | ⭐⭐⭐ |
| 8 | Habit Tracker | 3h | ⭐⭐⭐ |
| 9 | WhatsApp Shortcut | 0.5h | ⭐⭐ |
| 10 | Persistent Notifications | 3h | ⭐⭐⭐⭐ |
