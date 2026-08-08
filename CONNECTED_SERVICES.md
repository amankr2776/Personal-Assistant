# 🌐 Aira — Connected Services Setup Guide

Your personal AI assistant can connect to these services. Here's what's possible and how to set each one up.

---

## ✅ YouTube — Works NOW (No Setup Needed!)

**What it does:**
- Search and play any YouTube video/song directly inside Aira
- Just type "play [song name]" or "listen to [song]" in chat
- Or use the YouTube panel from the sidebar
- Quick chips: Bollywood, Lo-fi, Bhojpuri, Devotional, Motivational, Tech talks

**How it works:**
- Uses YouTube's embedded player — plays videos directly in the app
- No API key needed for basic search & play
- With YouTube Data API key → beautiful search results with thumbnails & durations

**To get even better results (optional):**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project → Enable **YouTube Data API v3**
3. Create API Key → Copy it
4. Add to Vercel: `YOUTUBE_API_KEY=your_key`
5. Now you'll get proper search results with thumbnails, durations, channel names

---

## 📧 Gmail — Requires One-Time Setup

**What it does:**
- Read your recent emails directly in Aira
- Check unread, important, college-related emails
- Auto-categorizes: 🎓 College, 💼 Career, 🔴 Urgent, 📢 Notification
- Smart labels: exam, assignment, interview, deadline emails highlighted
- Ask "check mail" or "check email" → opens Gmail panel

**Setup (5 minutes):**

### Step 1: Create Google Cloud Project (if not done)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project (or use existing one with Gemini API)

### Step 2: Enable Gmail API
1. Go to **APIs & Services** → **Library**
2. Search "Gmail API" → **Enable**

### Step 3: Create OAuth2 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Desktop app**
4. Copy **Client ID** and **Client Secret**

### Step 4: Get Refresh Token
1. Go to [Google OAuth Playground](https://developers.google.com/oauthplayground)
2. Click gear icon (⚙️) → Check "Use your own OAuth credentials"
3. Paste Client ID & Client Secret
4. Select scope: `https://mail.google.com/`
5. Click **Authorize APIs** → Login with your Gmail
6. Click **Exchange authorization code for tokens**
7. Copy the **Refresh token**

### Step 5: Add to Vercel
```bash
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REFRESH_TOKEN
```

After setup, Gmail will show in Aira with your real emails!

---

## 🎓 Linways (College App) — Limited Options

**The challenge:** Linways doesn't have a public API, so Aira can't directly read your college data.

**What IS possible:**
1. **Ask Aira about college stuff** → She uses your saved memories
   - "My class is at 10 AM" → saved to memory → "when is my class?" → "10 AM"
   - "Exam on 15th August" → saved → "when is exam?" → "15th August"
   
2. **Gmail integration catches college emails** → assignments, announcements, exam notifications
   - If your college sends notifications to Gmail, Aira can read them!

3. **Google Calendar** → If you add class schedule to Google Calendar, Aira can check it
   - "What class do I have today?" → checks Calendar
   - "When is my next exam?" → from Calendar events

**Best approach for Linways:**
- Tell Aira important info → auto-saves to memory
- Connect Gmail → catches college email notifications
- Connect Calendar → class schedule, exam dates, deadlines

---

## 📅 Google Calendar — Great for Class Schedule

**What it does:**
- "What's on my schedule today?" → Today's events
- "When is my next class?" → Next class event
- "Do I have anything tomorrow?" → Tomorrow's events

**Setup:** Same as Gmail — enable Calendar API in Google Cloud Console, same OAuth credentials work for both Gmail AND Calendar.

---

## 🎵 Other Services That Can Be Added

| Service | Possible? | How |
|---------|-----------|-----|
| **Spotify** | ✅ | Spotify Web API + OAuth |
| **Google Drive** | ✅ | Google Drive API (same OAuth) |
| **GitHub** | ✅ | Already have token — repos, PRs, issues |
| **WhatsApp** | ⚠️ | Can't read messages, but can draft replies |
| **Telegram** | ⚠️ | Bot API only, not personal messages |
| **Instagram** | ❌ | No public API for personal data |
| **College ERP** | ⚠️ | Most don't have APIs — use memory + Gmail |

---

## 🔑 Quick Summary — What To Set Up

| Priority | Service | Setup Time | Benefit |
|----------|---------|------------|---------|
| 🟢 Already working | YouTube | 0 min | Play any song/video |
| 🟡 5 min setup | Gmail | 5 min | Check emails, college updates |
| 🟡 2 min more | Calendar | 2 min | Class schedule, deadlines |
| 🟢 No setup needed | Memory | 0 min | Tell Aira → she remembers |
| 🔵 Optional | YouTube API | 1 min | Better search results |

**Next step:** Set up Gmail + Calendar OAuth to get email updates and class schedule in Aira!
