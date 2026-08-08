# ✅ What's Built & Deployed

## PWA Install Support
- Service Worker auto-generated (workbox) — caches all assets for offline
- `manifest.webmanifest` with app name, icons, theme
- Install prompt banner shows 3s after first visit
- "Install AIRA" button → adds to home screen as native app
- Works offline (cached shell, API calls fail gracefully)
- Ready for **Play Store via TWA (Trusted Web Activity)** wrapping

## Image Generator
- Full panel in sidebar (Images / Sparkles icon)
- **Pollinations.ai** — 100% free, no API key, no signup, no rate limit
- Prompt input + 6 quick-prompt chips
- Download generated PNG + copy URL
- Smart command: `"draw mountain landscape"`, `"generate image robot"`, `"चित्र बनाओ city"`

---

# 📱 WhatsApp Shortcut — What Is It?

It's just a **smart command that opens WhatsApp**. Nothing deep.

| Command | What happens |
|---------|-------------|
| `"whatsapp"` | Opens `web.whatsapp.com` in new tab |
| `"open whatsapp"` | Same |
| `"whatsapp aman"` | Opens `wa.me/919876543210` (if number saved in memory) |

**That's it.** No API, no OAuth, no reading messages. Just a bookmark that you trigger by voice/chat instead of finding the app icon. Useful when you're hands-free.

**Effort**: 30 minutes to add the regex + `window.open()`.

---

# 📸 Instagram Automation — THE HONEST ANSWER

## Can AIRA do this? PARTIALLY — with big limitations.

Here's what's **technically possible** vs **not possible**:

### ✅ What AIRA CAN Do (Without Your Instagram Login)

| Task | How | API/Tool |
|------|-----|----------|
| **Analyze trending content** | Scrape Instagram explore page / use hashtag APIs | RapidAPI (free tier) or scraping |
| **Get trending hashtags** | #reels, #trending for your niche | RapidAPI Instagram scraper |
| **Get trending audio/reels** | List popular sounds in your category | RapidAPI |
| **Prepare reel script** | AI writes script/caption based on trends | Gemini (already built in) |
| **Generate reel visuals** | AI image generation → sequence of images | Pollinations.ai (already built) |
| **Generate voiceover** | TTS in your chosen style | Edge TTS (already built) |
| **Suggest hashtags** | AI picks best hashtags for your niche | Gemini |
| **Suggest posting time** | Analyze when your audience is active | Gemini + logic |
| **Create caption + CTA** | AI writes engaging caption | Gemini |

### ❌ What AIRA CANNOT Do (Without Official Instagram API)

| Task | Why | Risk |
|------|-----|------|
| **Post reels automatically** | Instagram has NO public API for posting content | ⚠️ HIGH RISK — see below |
| **Upload video to Instagram** | Only possible via Instagram Graph API (business accounts only, requires Facebook app review) | ⚠️ App review takes weeks |
| **Auto-like / auto-follow** | Bot behavior = instant account ban | 🔴 WILL GET BANNED |
| **Auto-comment** | Same — bot detection | 🔴 WILL GET BANNED |
| **DM people** | Not available via any API | 🔴 WILL GET BANNED |

### ⚠️ THE BIG RISK — Providing Instagram Credentials

**If you give AIRA your Instagram username + password (or session cookie), here's what happens:**

1. **Instagram WILL detect it's not you** — they track device fingerprint, IP, browser behavior, request timing
2. **Your account WILL get flagged** — first: action block (can't post for 24h), then: shadowban, then: permanent ban
3. **Your content creator account is gone** — all followers, all content, all work = ZERO
4. **There are "unofficial" libraries** (like `instagram-private-api` on npm) that use reverse-engineered endpoints — they work briefly, then break when Instagram updates, and every use increases ban risk

**The only safe way to post to Instagram programmatically:**

- **Instagram Graph API** (official, by Meta)
- Requires: **Business or Creator account** (not personal)
- Requires: **Facebook App** with `instagram_basic` + `instagram_content_publish` permissions
- Requires: **App Review by Meta** (they review your app, takes 1-4 weeks)
- Allows: **Publishing media** (photos, carousels, video/reels with limitations)
- **Your password is NEVER shared** — it uses OAuth tokens

### 🎯 What I Recommend For You (Content Creator)

**Build a semi-automated workflow, NOT full auto-post:**

```
You say: "prepare instagram reel on [topic]"

AIRA does:
1. 🔍 Fetches trending hashtags + audio for your niche
2. 📝 AI writes reel script (hook → content → CTA)
3. 🎨 Generates 5-8 scene images for the reel
4. 🎙️ Generates voiceover audio
5. 📋 Prepares: caption, hashtags, suggested posting time
6. 📦 Packages everything as a download (images + audio + script)

You do:
7. 📱 Open Instagram app on phone
8. 📹 Use a reel editor (CapCut/InShot) to combine images + audio
9. 📤 Post manually (this is the ONLY safe way)
```

**This keeps your account 100% safe while saving you 80% of the work.**

### If You Still Want Auto-Posting (High Risk)

You CAN do it, but:
1. Convert to **Creator/Business account**
2. Create a **Facebook Developer App**
3. Get **Instagram Graph API** access (publishing permissions)
4. I can build the OAuth flow + posting endpoint
5. **Your password is NEVER stored** — OAuth tokens only
6. **Reels posting has limitations**: max 60s, must be MP4, no music overlay via API

**Effort**: 6-8 hours for the full flow + 1-4 weeks for Meta app review.

---

## 🔐 Security Summary: Which Credentials Are Safe?

| Service | Safe to give? | Why |
|---------|---------------|-----|
| **Gmail (read-only)** | ✅ Safe | Official Google OAuth, `gmail.readonly` scope, token encrypted |
| **Google Calendar** | ✅ Safe | Official Google OAuth, standard scopes |
| **Instagram (Graph API)** | ✅ Safe | Official Meta OAuth, no password shared |
| **Instagram (username+password)** | 🔴 DANGEROUS | Unofficial, will get banned |
| **WhatsApp** | ✅ Safe (no cred needed) | Just opening URLs |
| **GitHub** | ✅ Safe | OAuth or PAT with limited scope |
| **Gemini API key** | ✅ Safe | Server-side only, not exposed to browser |
| **Groq API key** | ✅ Safe | Server-side only |
