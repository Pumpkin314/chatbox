# ChatBridge — Critical Risks & Verification Criteria

This document captures risks identified during brainstorming research, mapped to verification criteria for sprint planning.

## Target: Web Build Only

The web build (`dev:web` / `CHATBOX_BUILD_PLATFORM=web`) is the deployment target. Electron-specific features (IPC, protocol handlers, electron-store) are NOT available. All solutions must work in a standard browser context.

---

## R1: Token Bloat from Multiple App Tool Schemas

**Risk:** Injecting tool schemas for 3+ apps into every LLM call will consume significant context window tokens, leaving less room for conversation history and app state.

**Impact:** High — degraded AI response quality, increased cost, potential context overflow.

**Mitigation:** Selective tool injection — only include tools for apps relevant to the current conversation context. Use a lightweight router/classifier before the main LLM call.

**Verification Criteria:**
- [ ] Measure token usage with 0, 1, 2, 3 apps registered — document the overhead per app
- [ ] Implement selective tool injection (only active/relevant app tools sent to LLM)
- [ ] Conversation with 3 apps registered maintains quality over 20+ turns

---

## R2: App State Persistence — No Native Primitive

**Risk:** Chatbox's message model only supports text, images, and tool results. There's no "app UI state" primitive. App state (e.g., chess board position) must survive page refreshes and be serializable into conversation context.

**Impact:** High — losing a chess game mid-conversation on refresh would be a showstopper.

**Mitigation:** Extend message schema with an `app_context` type that stores serialized app state (FEN for chess, cube string for Rubik's, etc.). Store alongside conversation history in the database.

**Verification Criteria:**
- [ ] App state persists across page refresh for all 3 apps
- [ ] App state is correctly serialized/deserialized from conversation history
- [ ] LLM can reference stored app state in subsequent turns (e.g., "your last chess position was...")

---

## R3: Completion Signaling — Apps That Never Finish

**Risk:** If a third-party app never sends a completion signal (bug, crash, infinite loop), the chatbot hangs waiting, blocking the conversation.

**Impact:** High — directly affects testing scenario #3 (user interacts with app, then returns to chatbot).

**Mitigation:** Explicit `status: "complete"` message protocol + configurable timeout fallback (default 30s). On timeout, chatbot resumes with an error context message.

**Verification Criteria:**
- [ ] Happy path: app signals completion, chatbot resumes with context
- [ ] Timeout path: app hangs, chatbot resumes after timeout with graceful error message
- [ ] User can manually dismiss/close an app and chatbot resumes
- [ ] Completion signal includes structured result data the LLM can reference

---

## R4: OAuth in Web Context (Spotify)

**Risk:** OAuth redirect flows within iframes are blocked by most identity providers (X-Frame-Options, CSP). Spotify's OAuth specifically requires a top-level redirect. No Electron protocol handlers available in web build.

**Impact:** High — Spotify app is one of 3 required apps and demonstrates the "External Authenticated" pattern.

**Mitigation:** Handle OAuth entirely in the host window (popup or redirect), not inside the iframe. Host stores tokens and passes them to the iframe app via postMessage. Token refresh handled by host.

**Verification Criteria:**
- [ ] Spotify OAuth flow completes successfully in web context (popup window approach)
- [ ] Tokens stored securely in host, never exposed to iframe directly
- [ ] Token refresh works automatically without user re-auth
- [ ] App functions correctly after token refresh

---

## R5: Iframe Sandbox Security

**Risk:** Third-party app code runs in iframes. Without proper sandboxing, apps could access parent DOM, read chat history, steal tokens, or inject malicious content. The PRD specifically calls out trust/safety for K-12 context.

**Impact:** Critical — security vulnerability in a children's education platform.

**Mitigation:** Strict iframe `sandbox` attributes (`allow-scripts allow-forms`, NO `allow-same-origin`). All communication via postMessage with origin validation. CSP headers on host page.

**Verification Criteria:**
- [ ] App iframe cannot access `window.parent` DOM
- [ ] App iframe cannot read localStorage/sessionStorage/cookies of host
- [ ] postMessage origin is validated on both sides
- [ ] CSP headers prevent inline script injection
- [ ] Apps served from separate origin (or srcdoc with sandbox)

---

## R6: Bidirectional Communication Reliability

**Risk:** postMessage is fire-and-forget. Messages can be lost, arrive out of order, or go unhandled. No built-in request-response pattern.

**Impact:** Medium — corrupted game state, missed tool invocations, UI desync.

**Mitigation:** Implement a request-response envelope protocol with UUID correlation IDs, acknowledgments, and timeouts per message. Pattern: `{ id: uuid, method: string, params: object }` → `{ id: uuid, status: string, result: object }`.

**Verification Criteria:**
- [ ] Every postMessage has a UUID and receives an acknowledged response
- [ ] Unacknowledged messages trigger retry (1x) then error
- [ ] Messages with unknown IDs are safely ignored
- [ ] Protocol handles rapid-fire messages (e.g., fast chess moves) without dropping

---

## R7: Multi-App Routing Ambiguity

**Risk:** User says "start a game" — which app handles it? The chatbot must route to the correct app without false positives. Testing scenario #6 explicitly tests this.

**Impact:** Medium — poor UX if wrong app launches, or if chatbot asks unnecessary clarifying questions every time.

**Mitigation:** Apps declare trigger keywords/intents in their tool schemas. LLM function calling naturally handles disambiguation. For true ambiguity, chatbot asks the user.

**Verification Criteria:**
- [ ] "Let's play chess" → chess app (unambiguous)
- [ ] "Create a playlist" → Spotify app (unambiguous)
- [ ] "Show me a puzzle" → chatbot asks which app (ambiguous between chess puzzle and Rubik's cube)
- [ ] "What's the weather?" with no weather app → chatbot responds conversationally, no app invoked
- [ ] Chatbot correctly refuses unrelated queries (testing scenario #7)

---

## R8: Web Build — No Electron APIs

**Risk:** The codebase is Electron-first. Many features rely on Electron APIs (electron-store, IPC, protocol handlers, native menus). The web build must replace or stub all of these.

**Impact:** High — build failures, runtime crashes, missing features.

**Mitigation:** Audit all Electron API usage in the integration path. Use browser equivalents: localStorage/IndexedDB instead of electron-store, fetch instead of IPC, window.open for OAuth instead of protocol handlers.

**Verification Criteria:**
- [ ] `pnpm dev:web` starts without errors
- [ ] No references to `electronAPI`, `ipcRenderer`, or `electron-store` in web-build code paths
- [ ] All 3 apps function correctly in browser (Chrome)
- [ ] Deployment works on a standard web host (Vercel/Railway/Render)

---

## R9: 3D Rendering Performance (Rubik's Cube)

**Risk:** Three.js WebGL context inside an iframe adds GPU overhead. Multiple WebGL contexts (if multiple 3D widgets) can exhaust browser limits (8-16 contexts). Animation loop continues even when iframe is off-screen.

**Impact:** Medium — laggy UI, battery drain, potential WebGL context loss.

**Mitigation:** Pause `requestAnimationFrame` when iframe not visible (IntersectionObserver). Handle `webglcontextlost` gracefully. Limit to one 3D app active at a time.

**Verification Criteria:**
- [ ] Rubik's cube renders at 60fps on mid-range hardware
- [ ] Animation pauses when scrolled out of view
- [ ] WebGL context loss handled with recovery message
- [ ] Memory usage stays stable over 5+ minutes of interaction

---

## R10: Database Migration — Local Storage to Backend

**Risk:** Chatbox uses client-side storage (IndexedDB/LocalForage). The PRD requires user auth and persistent history, implying a backend database. Migration from local-first to server-backed storage is a significant architectural shift.

**Impact:** High — affects every feature that reads/writes data.

**Mitigation:** Introduce a lightweight backend (e.g., Supabase, Firebase) for auth + conversation persistence. Keep local storage as cache/offline fallback. Design the data layer with a clean interface so the storage backend is swappable.

**Verification Criteria:**
- [ ] User auth works (sign up, log in, log out)
- [ ] Conversations persist across devices/browsers for same user
- [ ] App registration data stored server-side
- [ ] Chat history loads correctly on fresh browser with no local cache

---

## R11: Spotify Web Playback SDK Limitation

**Risk:** Spotify's Web Playback SDK cannot work inside a sandboxed iframe (requires `encrypted-media` EME API and top-level window access). Full playback is not possible in our architecture.

**Impact:** Low — the app is a playlist *creator*, not a player.

**Mitigation:** Use 30-second preview URLs for track previews (no SDK needed). Focus on search + playlist creation. Clearly scope the app as a creator, not a full player.

**Verification Criteria:**
- [ ] Users can search tracks, preview 30-second clips, create playlists
- [ ] Created playlists appear in user's actual Spotify account
- [ ] No dependency on Web Playback SDK
