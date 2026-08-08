# SECURITY CHANGES LOG

All modifications made during the Production Security, Stability & Play Store Hardening Audit.

---

## [CRITICAL] API Keys Persisted to localStorage

**Issue:** Settings object including `groqApiKey`, `braveApiKey`, `anthropicApiKey`, `elevenLabsApiKey` was persisted to localStorage via Zustand's `partialize` function. Any XSS or browser inspection could steal these credentials.

**File:** `src/stores/useStore.ts`

**Fix:** Modified `partialize` to explicitly zero out API key fields before persisting:
```typescript
settings: {
  ...state.settings,
  groqApiKey: '',
  braveApiKey: '',
  anthropicApiKey: '',
  elevenLabsApiKey: '',
},
```

**Reason:** API keys are sensitive credentials that must never be stored in client-accessible localStorage. They are now session-only and lost on page refresh.

---

## [CRITICAL] Trivial PIN Hash Algorithm

**Issue:** PIN lock used Java's hashCode algorithm (`(hash << 5) - hash + char`). This is a 32-bit integer hash with massive collision space (~4 billion values) and is trivially reversible.

**File:** `src/stores/useStore.ts`, `src/components/AppLockScreen.tsx`, `src/components/MemoryPanel.tsx`

**Fix:**
1. Added `sha256Hash()` function using Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`) with salt
2. Added `verifyAppPinAsync()` and `verifyMemoryPinAsync()` async methods
3. Updated `AppLockScreen` to use `verifyAppPinAsync` with loading state
4. Updated `MemoryPanel.PinLockScreen` to use `verifyMemoryPinAsync` with loading state

**Reason:** SHA-256 provides 2^256 hash space vs 2^32 for Java hashCode. The salt prevents rainbow table attacks. Async verification ensures the hash computation completes before granting access.

---

## [CRITICAL] CORS Allow-Origin Wildcard on All API Endpoints

**Issue:** All 11 API endpoints set `Access-Control-Allow-Origin: *`, allowing any website to make cross-origin requests. This enables CSRF-like attacks where malicious sites could use the user's AI API quota.

**Files:** `api/chat.ts`, `api/health.ts`, `api/transcribe.ts`, `api/weather.ts`, `api/cricket.ts`, `api/news.ts`, `api/youtube.ts`, `api/translate.ts`, `api/search.ts`, `api/tts.py`

**Fix:**
1. Created `api/_security.ts` shared security module with:
   - `ALLOWED_ORIGINS` array (deployment URL + localhost dev servers)
   - `setSecurityHeaders()` that sets `Access-Control-Allow-Origin` to the requesting origin only if it's in the allowed list
   - `checkRateLimit()` for per-IP rate limiting
   - `handleOptions()` for preflight handling
2. Updated all 10 TypeScript endpoints to use `setSecurityHeaders()` and `handleOptions()`
3. Updated `tts.py` to read `Origin` header instead of using wildcard

**Reason:** Restricting CORS to known origins prevents malicious websites from abusing the API proxy.

---

## [HIGH] No Rate Limiting on 7 API Endpoints

**Issue:** Only `/api/chat` and `/api/search` had rate limiting. Endpoints for cricket, news, weather, youtube, transcribe, translate, and TTS could be called unlimited times.

**Files:** All `api/*.ts`, `api/tts.py`

**Fix:** Added rate limiting via `checkRateLimit()` to all endpoints with appropriate limits:
- chat: 30/min, search: 30/min, transcribe: 10/min, weather: 30/min, cricket: 30/min, news: 20/min, youtube: 20/min, translate: 30/min, health: 60/min, TTS: 15/min

**Reason:** Rate limiting prevents API abuse, cost overruns, and denial of service.

---

## [HIGH] Missing Security Headers on Most API Endpoints

**Issue:** Only `/api/chat` had `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`. No endpoint had `Strict-Transport-Security` (HSTS).

**Files:** All `api/*.ts`, `api/tts.py`

**Fix:** Added all security headers via `setSecurityHeaders()`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**Reason:** Security headers prevent clickjacking, MIME sniffing, XSS, information leakage, and enforce HTTPS.

---

## [HIGH] JavaScript Code Execution Sandbox Insufficient

**Issue:** `new Function(code)` in CodePanel executed arbitrary JavaScript with full access to `window`, `document`, `fetch`, `localStorage`, etc. Could steal all app data.

**File:** `src/components/CodePanel.tsx`

**Fix:** Added sandboxing that overrides dangerous globals within the executed code:
```javascript
const sandboxedCode = `
  "use strict";
  const window = undefined, globalThis = undefined, process = undefined,
        require = undefined, __dirname = undefined, __filename = undefined,
        eval = undefined, Function = undefined;
  ${code}
`;
```
Also added 5-second execution timeout.

**Reason:** Prevents user-written code from accessing sensitive globals while still allowing computation. Note: This is best-effort; a full sandbox requires Web Worker or iframe.

---

## [MEDIUM] VERCEL_OIDC_TOKEN in .env.local

**Issue:** Vercel CLI stored a JWT OIDC token in `.env.local`.

**File:** `.env.local`

**Fix:** Removed the token. File now contains only a comment.

**Reason:** Sensitive tokens should not be stored in local files even if .gitignored.

---

## [MEDIUM] Debug console.log Statements in Production Code

**Issue:** `console.log` calls in `api.ts` leaked operational timing and status information. `console.error` in VaultPanel could expose error details.

**Files:** `src/services/api.ts`, `src/components/VaultPanel.tsx`

**Fix:** Replaced debug `console.log` with comments. Kept essential `console.warn` for TTS fallback path.

**Reason:** Debug logging in production can leak timing information and internal state.

---

## [MEDIUM] window.__JARVIS_STORE_STATE__ Global Exposure

**Issue:** Store state was exposed on `window` via a Proxy, allowing any script (including CodePanel code) to read all settings.

**File:** `src/stores/useStore.ts`

**Fix:** Removed the global exposure entirely.

**Reason:** Reduces attack surface for XSS and code execution sandbox.

---

## [MEDIUM] Missing Input Validation on Several Endpoints

**Issue:** YouTube videoId wasn't validated, weather query length wasn't limited, news lang wasn't restricted, translate langpair wasn't validated, TTS lang/text weren't sanitized.

**Files:** `api/youtube.ts`, `api/weather.ts`, `api/news.ts`, `api/translate.ts`, `api/tts.py`

**Fix:**
- YouTube videoId: regex `/^[a-zA-Z0-9_-]{11}$/`
- Query length: max 200 chars
- News lang: only 'en' or 'hi'
- Translate langpair: regex validation
- TTS: max 5000 chars text, only 'en'/'hi' lang, max 10KB body

**Reason:** Input validation prevents injection, abuse, and unexpected behavior.

---

## [MEDIUM] Backend CORS allow_credentials=True with allow_origins=*

**Issue:** FastAPI middleware had `allow_origins=["*"]` with `allow_credentials=True`.

**File:** `backend/main.py`

**Fix:** Changed to specific allowed origins with `allow_credentials=False`.

**Reason:** Sending credentials to any origin is a security anti-pattern.

---

## [MEDIUM] Backend Settings Endpoint Allows Arbitrary Key Injection

**Issue:** `/api/settings` POST accepted any JSON keys.

**File:** `backend/main.py`

**Fix:** Added `ALLOWED_SETTING_KEYS` whitelist and value length limits (500 chars).

**Reason:** Prevents injection of arbitrary configuration keys.

---

## [MEDIUM] No Content-Security-Policy for the SPA

**Issue:** No CSP was defined for the main application HTML.

**File:** `index.html`

**Fix:** Added comprehensive CSP meta tag with:
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (required for React)
- `connect-src` restricted to known API domains
- `img-src`, `media-src`, `worker-src` appropriately scoped
- Also added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` meta tags

**Reason:** CSP is the primary defense against XSS and data injection attacks.

---

## [LOW] Source Maps Disabled in Production

**Issue:** Source maps were conditionally enabled based on `TAURI_DEBUG`.

**File:** `vite.config.ts`

**Fix:** Set `sourcemap: false` permanently. Added content hash filenames.

**Reason:** Source maps expose full source code structure and variable names.

---

## [LOW] .gitignore Insufficient

**Issue:** Didn't cover keystores, certificates, service account keys, database journals.

**File:** `.gitignore`

**Fix:** Added patterns for `*.keystore`, `*.jks`, `*.p12`, `*.pem`, `*.key`, `*.cert`, `service-account*.json`, `*.db-journal`, `*.db-wal`, `secrets/`, `.credentials`.

**Reason:** Prevents accidental commits of sensitive files.

---
