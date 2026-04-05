# Plan 1: ChatBridge Sprint — Easy Wins + Playwright

**Date:** 2026-04-05
**Type:** Brownfield — existing codebase at `/Users/rajiv/Documents/Gauntlet/chatbox`
**Goal:** Lock in the ChatBridge brief's requirements with working apps, comprehensive E2E tests, and a frozen plugin contract that Plan 2 (Google Books OAuth) builds against.

---

## Context

ChatBridge is a fork of Chatbox (open-source Electron/React AI chat client) that adds a third-party app integration system. The platform lets apps register tools, render UI in a sandboxed iframe side panel, and communicate bidirectionally with the AI chatbot via postMessage.

### What Exists (Built)
- **ChatBridge core platform:** bridge.ts (postMessage protocol), tool-router.ts (LLM→app routing), tool-builder.ts (JSON Schema→Vercel AI SDK), context-manager.ts (app state→LLM prompt), system-prompt.ts, app-lifecycle.ts, SidePanel.tsx (380px iframe panel)
- **App registry:** Static `apps.json` with 4 entries (chess, weather, spotify, rubiks)
- **Chess app:** 1466-line self-contained HTML, full chess engine, click-based moves
- **Weather app:** 690-line HTML dashboard, host-side API proxy in tool-router.ts for OpenWeatherMap
- **Spotify app:** 466-line HTML, mock data only, no real OAuth
- **Supabase integration:** Auth (email/password), persistence (conversations, messages, app_registry, token_usage_log, user_app_tokens), RLS policies
- **116 unit tests passing** (85 ChatBridge core + 31 app-specific)

### What Was Broken (Fixed in This Session)
These protocol fixes have been applied but are **unverified in a real browser**:

1. **Chess message type mismatch:** Host sends `type: 'tool_call'`, chess listened for `type: 'tool_invoke'`. Fixed in `apps/chess/index.html` — now handles `tool_call` and adapts to internal `{method, params}` format.

2. **Chess app_init payload mismatch:** Host sends `{payload: {...}}`, chess read `{params: {...}}`. Fixed to read `msg.payload || msg.params`.

3. **SidePanel never sent app_init:** The iframe loaded but the host never sent the handshake message. Fixed in `SidePanel.tsx` — `handleIframeLoad` now calls `sendMessage(iframe, 'app_init', {appId})`.

4. **Spotify payload mapping:** Expected `{tool, params}`, host sends `{toolName, args}`. Fixed with fallback: `payload.toolName || payload.tool`.

5. **Weather payload mapping:** Expected `{name, parameters}`, host sends `{toolName, args}`. Fixed with fallback: `payload.toolName || payload.name`.

### Known Protocol Inconsistencies (Must Resolve in M2)
- **HOST_MESSAGE_TYPES constant is wrong:** `bridge.ts` line 190 defines `HOST_MESSAGE_TYPES = ['app_init', 'tool_call_result']` but the host actually sends `tool_call` (not `tool_call_result`) to iframes. The constant must be updated.
- **Response format divergence:** Chess sends `{id, type: 'tool_result', status, result}` with its own inline `sendToHost()`. Weather and Spotify use `bridge-sdk.js` and send `{type: 'tool_call_result', id, payload: {result}}`. The bridge resolves by matching UUID `id` so both work, but M2 must standardize on one format.
- **bridge-sdk.js exists but chess doesn't use it:** `src/renderer/chatbridge/bridge-sdk.js` provides a standard postMessage helper used by weather and spotify. Chess has its own inline protocol handler. All new apps (NASA, contract test app) MUST use `bridge-sdk.js`.

### What's Still Broken / Missing
- **All protocol fixes are unverified** in a real browser (only unit tests pass)
- **Weather iframe shows hardcoded mock data** for 10 cities — doesn't display real API results when host proxy sends them. The `__proxyResult` field is injected by tool-router.ts but the weather iframe has no handler for it — a new code path must be added.
- **Spotify is entirely fake** — mock data, no real OAuth (being replaced in Plan 2). Set `"enabled": false` in apps.json before testing to avoid ambiguous routing.
- **Rubik's cube is a stub** (disabled, same tier as chess — low priority)
- **No calculator app** exists
- **No Playwright E2E tests** exist
- **No plugin contract documentation** exists
- **NASA app doesn't exist** yet
- **No Tier 1 (JSON/no-iframe) app** exists to demonstrate that integration pattern
- **Entrypoint paths** in apps.json (`/apps/chess/index.html`) may not resolve in Vite production build — app HTML files are in `src/renderer/chatbridge/apps/` but may not be copied to build output. **This is a blocker — must be resolved in M1 step 0.**
- **Deployment** is required by the brief but not covered in this sprint. Explicitly deferred to a deployment-focused sprint.
- **Demo video** is required by the brief but not covered here. Deferred to final submission prep.

### Brief Requirements Checklist
From `docs/chatbridge_brief.md`:

- [x] Real-time AI chat with streaming responses
- [x] Persistent conversation history
- [x] Chat maintains context about active apps
- [x] Multi-turn conversations spanning app interactions
- [ ] Graceful error handling when apps fail/timeout *(partial — needs UX polish)*
- [x] User authentication (Supabase)
- [x] App registration and capability discovery
- [x] Tool schema definition and invocation
- [x] App UI rendering within chat (iframe side panel)
- [ ] Completion signaling *(built but unverified)*
- [x] App maintains independent state
- [ ] At least 3 apps with different integration patterns *(chess works, weather partial, need NASA)*
- [ ] Chess app with full lifecycle *(protocol fixed, unverified)*
- [ ] Auth required for at least one app *(Plan 2 — Google Books OAuth)*
- [ ] 7 testing scenarios pass *(no E2E tests exist)*
- [ ] Deployed and publicly accessible *(not yet)*
- [ ] Cost analysis *(exists in docs/cost-analysis.md)*

---

## Sprint 1: Lock In Requirements

### Milestone Order

#### M1: Chess Verification (1-2h)
**Goal:** Prove the protocol fixes work in a real browser.

0. **Verify entrypoint resolution:** Check that `/apps/chess/index.html` resolves in the Vite build. If not, configure `vite.config.ts` to copy `src/renderer/chatbridge/apps/` to the build output's public directory. This is a prerequisite — if iframes can't load, nothing else works.
1. Build web app: `pnpm build:web`
2. Serve locally and open in Chrome
3. Log in with test user (test@chatbridge.dev / TestPass123!)
4. Send "let's play chess" → verify side panel opens, board renders
5. Verify LLM calls `start_game` → board resets to starting position
6. Click pieces on the board → verify moves work, state updates flow to chatbot
7. Send "what should I do?" → verify chatbot reads board state and responds
8. Send "I resign" → verify game over, panel can close, chat continues

**If this fails:** Debug the specific failure point. The protocol fixes are in:
- `src/renderer/chatbridge/apps/chess/index.html` (lines 1291-1300, 1302-1305)
- `src/renderer/components/chatbridge/SidePanel.tsx` (lines 36-45)

#### M2: Contract Verification & Standardization (2-3h)
**Goal:** Verify the plugin interface works generically, standardize protocol inconsistencies.

0. **Fix HOST_MESSAGE_TYPES constant** in `bridge.ts` line 190: change `'tool_call_result'` to `'tool_call'` (host sends `tool_call` to iframes, not `tool_call_result`)
1. Build a minimal "contract test app" (~50 lines HTML) **using `bridge-sdk.js`**: handles `app_init`, responds to one `tool_call`, sends `state_update`, sends `app_complete`
2. Register it in `apps.json` with one tool
3. Open it via chat, invoke the tool, close it
4. Standardize response format: document that apps should use `bridge-sdk.js` and the `tool_call_result` response type. Chess's inline `tool_result` format works (bridge matches by `id`) but is non-standard.
5. If anything is awkward or broken in the contract, fix it now
6. Document the verified contract in `docs/plugin-contract.md`
7. **Disable Spotify** in `apps.json` (`"enabled": false`) — it's entirely mock and will confuse routing tests

**Contract shapes to document:**

Registry entry:
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "type": "internal | external_public | external_authenticated",
  "tools": [{"name": "string", "description": "string", "parameters": {JSON Schema}}],
  "entrypoint": "string (URL or path)",
  "authConfig": null | {"type": "api_key", "envVar": "string"} | {"type": "oauth2_pkce", ...},
  "enabled": true
}
```

Host→Iframe messages:
```json
{"type": "app_init", "id": "uuid", "payload": {"appId": "string", ...}, "timestamp": number}
{"type": "tool_call", "id": "uuid", "payload": {"toolName": "string", "args": {}}, "timestamp": number}
```

Iframe→Host messages:
```json
{"type": "tool_result", "id": "uuid (same as request)", "payload": {result}, "timestamp": number}
{"type": "state_update", "id": "uuid", "payload": {app state}, "timestamp": number}
{"type": "app_complete", "id": "uuid", "result": {summary}, "timestamp": number}
{"type": "error", "id": "uuid (same as request)", "payload": "error message", "timestamp": number}
```

Iframe→Host response type naming: Apps may use `tool_result` or `tool_call_result` — the bridge resolves by matching the `id`, not the `type`. Both work.

#### M3: Weather Real API (3-4h)
**Goal:** Weather app shows real data for any city, not hardcoded mocks.

1. Set `VITE_WEATHER_API_KEY` env var (OpenWeatherMap free tier, 1000 calls/day)
2. Host proxy in `tool-router.ts` already works — verify with real API key
3. **Add new handler** in the weather iframe's `handleToolCall` function that detects `__proxyResult` in the `tool_call` payload and renders the proxied data, bypassing the iframe's internal mock generation. This is net-new code (~30-50 lines), not a fix to existing code — the iframe currently has zero awareness of `__proxyResult`.
4. The iframe's rendering pipeline (card population, city header, temperature display) currently reads from internal state — the new handler must feed proxied data into the same rendering functions.
5. Verify: "What's the weather in Tokyo?" → real Tokyo data in both chat response and iframe panel

**Note:** Time estimate is 3-4h because the weather iframe has its own complete mock data system (690 lines) and the rendering pipeline change requires understanding its internal state management.

**Files to modify:**
- `src/renderer/chatbridge/apps/weather/index.html` — handle `__proxyResult` in `handleToolCall`
- `.env` — add `VITE_WEATHER_API_KEY`

#### M4: NASA Space Explorer App (3-4h)
**Goal:** New iframe app demonstrating external_public (API key) integration pattern.

**Design:**
- Self-contained HTML file at `src/renderer/chatbridge/apps/nasa/index.html` (~700-900 lines)
- Two-tab layout:
  - **Explore tab:** APOD hero image, title, explanation, prev/next day navigation (kid-friendly)
  - **Dashboard tab:** Mars rover photo grid (2x3), near-Earth asteroid table with date picker, data-dense for older students
- Dark theme matching ChatBridge aesthetic (see mockup at `docs/mockups/nasa-app-mockup.html`)

**Tools (4):**

| Tool | Parameters | Returns |
|------|-----------|---------|
| `get_apod` | `date?` (YYYY-MM-DD) | `{title, explanation, image_url, date, media_type}` |
| `get_mars_photos` | `rover?`, `earth_date?`, `camera?` | `{photos: [{id, img_src, camera, earth_date}]}` |
| `get_asteroids` | `start_date`, `end_date?` | `{asteroids: [{name, diameter_km, distance_km, is_hazardous}]}` |
| `get_earth_image` | `lat`, `lon`, `date?` | `{image_url, date}` (stretch — skip if tight) |

**Auth:** API key via `VITE_NASA_API_KEY`. Host-side proxy in `tool-router.ts` — note that `executeHostProxiedTool()` is currently hardcoded to weather endpoints only and must be extended for NASA. Register free key at api.nasa.gov (instant, no credit card).

**Important:** The NASA app MUST use `bridge-sdk.js` for host communication (not inline protocol handling like chess). This ensures consistency with the frozen contract.

**State updates:** Iframe sends `state_update` when user navigates (tab switch, APOD date change, photo click) so chatbot knows what they're looking at.

**Registry entry:**
```json
{
  "id": "nasa",
  "name": "Space Explorer",
  "description": "Explore astronomy pictures, Mars rover photos, and near-Earth asteroids",
  "type": "external_public",
  "tools": [...],
  "entrypoint": "/apps/nasa/index.html",
  "authConfig": {"type": "api_key", "envVar": "VITE_NASA_API_KEY"},
  "enabled": true
}
```

#### M5: Plugin Contract Freeze (1h)
**Goal:** Document and freeze the verified plugin interface.

1. Write `docs/plugin-contract.md` based on M2 verification results
2. Include: registry schema, message protocol, lifecycle sequence diagram, auth patterns, known quirks
3. This document is the stable target for Plan 2 (Google Books OAuth)

#### M6: Playwright Test Suite (4-6h)
**Goal:** Comprehensive E2E tests with rich observability.

**File structure:**
```
tests/e2e/
  playwright.config.ts
  helpers/
    test-logger.ts          # Structured JSON step logging
    app-harness.ts          # Generic app open/close/interact
    chat-harness.ts         # Send message, wait for response
  core-scenarios.spec.ts    # Brief's 7 required scenarios
  app-flows/
    chess.spec.ts           # Dedicated chess regression
    weather.spec.ts         # Weather full flow
    nasa.spec.ts            # NASA full flow
  resilience.spec.ts        # Boundary/aggressive testing
```

**core-scenarios.spec.ts — Brief's 7 scenarios:**
1. Tool discovery & invocation — send "let's play chess" → side panel appears
2. App UI renders correctly — iframe loaded, status="Connected"
3. Completion signaling — interact → close → chat resumes
4. Context retention — after close, ask about results → response references them
5. App switching — chess → weather → back to chess
6. Ambiguous routing — "show me something" → chatbot picks or clarifies
7. Refusal for unrelated — "what's 2+2?" → no app opens

**chess.spec.ts — Dedicated regression (the broken app):**
- Board renders on open
- Start game via chat tool call
- Make move via chat tool call
- Click-based move in iframe
- Get board state / get hint
- Invalid move returns error
- Resign → game over → app_complete
- Full game mini-flow (open → start → 3 moves → hint → resign → discuss)

**weather.spec.ts:**
- Open weather → panel shows dashboard
- Query real city → real data displayed in panel and chat
- Query different city → panel updates
- Forecast tool works

**nasa.spec.ts:**
- Open NASA → Explore tab shows APOD
- Navigate to previous day
- Switch to Dashboard tab → Mars photos and asteroids visible
- Ask chatbot about current APOD → chatbot references it by name
- Close app → context retained

**resilience.spec.ts — Boundary testing:**
- Page refresh mid-app → graceful recovery or reset
- Rapid tool calls (5 messages fast) → no race conditions
- Open app while another is open → clean switch
- Iframe load timeout → error card after 15s
- Close panel mid-tool-call → no crash
- Malformed tool response → graceful error
- Double open_app → idempotent

**Observability:**
- Playwright HTML reporter → `test-results/summary.html`
- Screenshots at every step (not just failures) via harness functions
- Trace recording → `test-results/traces/<test>.zip` (view with `npx playwright show-trace`)
- Custom structured JSON logging per step:
  ```json
  {
    "timestamp": "ISO",
    "test": "chess.spec.ts > Full game",
    "step": 3,
    "action": "sendChatMessage",
    "input": "move e2 to e4",
    "expected": "board updates",
    "actual": "panel connected, pawn moved",
    "screenshot": "screenshots/chess-step-3.png",
    "duration_ms": 1250,
    "passed": true
  }
  ```
- JUnit XML for CI pipeline integration

**Generic harness (for future apps):**
```typescript
async function openApp(page, appName: string): Promise<void>
async function waitForPanel(page, appId: string): Promise<Locator>
async function waitForConnected(page): Promise<void>
async function closeApp(page): Promise<void>
async function getPanelState(page): Promise<'loading'|'connected'|'error'|'idle'>
async function sendChatMessage(page, text: string): Promise<void>
async function waitForAssistantResponse(page): Promise<string>
```

#### M7: MCP Chrome Verification Gate
**Goal:** Manual exploratory testing alongside Playwright automation.

Run through the brief's 7 test scenarios manually in Chrome:
1. Login → "check the weather in Paris" → side panel opens, real weather data
2. "Let's play chess" → board appears → make moves → ask for help → resign
3. "Show me something about space" → NASA opens → browse APOD → switch to dashboard
4. Switch between apps in same conversation
5. Ask chatbot about previous app results
6. Verify error states (close panel mid-action, rapid messages)

This is exploratory — look for things Playwright wouldn't catch (visual glitches, UX awkwardness, timing issues).

**Note:** M7 can run in parallel with M6 (Playwright authoring) since they are independent activities.

---

## Sprint 2: Edu Polish & Stretch

**Depends on:** Sprint 1 complete, contract frozen, Playwright green.

### M8: Tier 1 JSON Edu App — FlashForge or WordLab (4-6h)
**Goal:** Demonstrate the Tier 1 (no-iframe) integration pattern.

**Option A — FlashForge (Flashcards):**
- Spaced-repetition flashcard engine
- Tools: `list_decks`, `draw_card`, `submit_answer`, `get_progress`, `create_card`
- Chatbot quizzes students conversationally, adapts difficulty, explains wrong answers
- No iframe — structured JSON returned, platform renders in chat

**Option B — WordLab (Vocabulary):**
- Vocabulary builder with context evaluation
- Tools: `get_word`, `evaluate_sentence`, `get_student_vocab`, `start_challenge`
- Chatbot presents words, evaluates student sentences for correctness and nuance
- Plays to LLM's core language strength

**Decision:** Make during Sprint 2 based on what feels most impactful.

### M9: App Cleanup & UX Polish (2-3h)
- Loading states across all apps (skeleton loaders, spinners)
- Error cards with retry buttons
- Timeout UX (15s iframe load timeout already exists, but needs visual treatment)
- Consistent dark theme across all app iframes

### M10: Documentation & Cost Analysis (2-3h)
- Update `docs/developer-guide.md` with contract reference
- Update cost analysis with real token data from Sprint 1 testing
- Architecture overview for submission

### M11: Rubik's Cube (Stretch)
- Same tier as chess (internal, iframe) — doesn't add integration pattern diversity
- Only if time allows and other milestones are complete
- Could use an external solving algorithm API to differentiate from chess

---

## External Services & Integration Points

| Service | Purpose | Auth | Free Tier |
|---------|---------|------|-----------|
| Supabase | Auth + DB + Realtime | Service key | 500MB DB, 50K MAU |
| OpenWeatherMap | Weather data | API key | 1000 calls/day |
| NASA API | APOD, Mars photos, asteroids | API key | 1000 calls/hour |
| Vercel AI SDK | LLM integration | Provider API keys | N/A (client library) |
| Google Books API | Plan 2 only | OAuth2 + API key | 1000 calls/day |

---

## Relationship to Plan 2

Plan 2 (Google Books OAuth) is a **separate spec** executed in a **separate CC session** that the user drives interactively. It builds against the plugin contract frozen in M5.

- **Plan 2 skeleton:** `docs/superpowers/specs/2026-04-05-plan-2-google-books-oauth-skeleton.md`
- **Updated after P1S1:** Fresh codebase context, frozen contract reference, lessons learned
- **Merge point:** Plan 2's Google Books app slots into the same registry/bridge/SidePanel as all other apps

Plan 1 Sprint 2 and Plan 2 can run in parallel on different branches if desired.

---

## Key File Paths

### Core Platform (don't break these)
- `src/renderer/chatbridge/bridge.ts` — PostMessage protocol
- `src/renderer/chatbridge/tool-router.ts` — Tool routing + API proxies
- `src/renderer/chatbridge/tool-builder.ts` — JSON Schema → AI SDK ToolSet
- `src/renderer/chatbridge/app-lifecycle.ts` — Jotai atoms for active app
- `src/renderer/chatbridge/context-manager.ts` — App state tracking
- `src/renderer/chatbridge/system-prompt.ts` — LLM context injection
- `src/renderer/chatbridge/registry/apps.json` — App catalog
- `src/renderer/chatbridge/registry/index.ts` — Registry loader
- `src/renderer/components/chatbridge/SidePanel.tsx` — Iframe panel UI
- `src/renderer/routes/__root.tsx` — Root layout, auth init, store wiring

### Apps (modify/create)
- `src/renderer/chatbridge/apps/chess/index.html` — Chess (protocol fixed)
- `src/renderer/chatbridge/apps/weather/index.html` — Weather (needs proxy display fix)
- `src/renderer/chatbridge/apps/spotify/index.html` — Spotify (being replaced by Plan 2)
- `src/renderer/chatbridge/apps/nasa/index.html` — NASA (to be created)

### Auth & Storage
- `src/renderer/chatbridge/auth.ts` — Supabase auth atoms
- `src/renderer/chatbridge/storage.ts` — Conversation persistence
- `supabase/migrations/20260403021307_init.sql` — DB schema

### Tests
- `src/renderer/chatbridge/__tests__/` — 85 unit tests
- `src/renderer/chatbridge/apps/*/__ tests__/` — 31 app unit tests
- `tests/e2e/` — Playwright E2E (to be created)

### Documentation
- `docs/chatbridge_brief.md` — Original PRD
- `docs/presearch.md` — Pre-search analysis
- `docs/plugin-contract.md` — To be created (M5)
- `docs/developer-guide.md` — Third-party dev guide
- `docs/cost-analysis.md` — Cost projections
- `docs/mockups/nasa-app-mockup.html` — NASA visual mockup
