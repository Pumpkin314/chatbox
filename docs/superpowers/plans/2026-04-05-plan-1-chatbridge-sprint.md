# ChatBridge Sprint 1: Easy Wins + Playwright Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers-extended-cc:parallel-pr-execution to implement this plan.

**Goal:** Lock in the ChatBridge brief's requirements with working apps, comprehensive E2E tests, and a frozen plugin contract that Plan 2 (Google Books OAuth) builds against.
**Architecture:** Brownfield modification of Chatbox fork — fix broken apps, extend host proxy for NASA, add Playwright E2E, freeze plugin contract. All changes confined to `src/renderer/chatbridge/`, `src/renderer/components/chatbridge/`, `src/renderer/public/apps/`, and `tests/e2e/`.
**Tech Stack:** React 18 + Vite + Electron (web build) + Vitest + Playwright (new) + Supabase + Vercel AI SDK 6 + Jotai
**Project type:** brownfield
**Compaction:** auto

**External services:**
- Supabase — existing, configured, L5
- OpenWeatherMap — existing, API key in .env, L4
- NASA API — new, free key from api.nasa.gov, L4
- Vercel AI SDK — existing client library, L5

**Total estimated human setup time:** ~5 minutes (NASA API key registration + Playwright install)

**Service integration levels:**
- Supabase (auth + DB) — **L5** critical: existing, don't break
- OpenWeatherMap — **L4** important: existing proxy works, mock fallback if key missing
- NASA API — **L4** important: new integration, mock fallback if key missing
- Vercel AI SDK — **L5** critical: existing LLM pipeline, don't break

---

## Existing System Analysis

**Architecture:** Electron/React fork with ChatBridge subsystem — postMessage bridge protocol (UUID-correlated), Jotai atoms for app lifecycle, Vercel AI SDK for LLM tool calls, static JSON registry (apps.json), 380px fixed SidePanel with iframe sandbox.

**Test infrastructure:** Vitest 4.0.16 — 729 passing, 7 failing (pre-existing in token-estimation/settingsStore, not chatbridge), 84 skipped. No Playwright. React Testing Library for component tests. `pnpm test` runs all.

**Deploy pipeline:** Dockerfile (Node 20 build → nginx serve) exists. No CI/CD workflows. `pnpm build:web && pnpm serve:web` for local web testing.

**Conventions:** Self-contained HTML apps (all CSS/JS inline), Jotai atoms for state, JSON Schema tool definitions, graceful degradation (missing keys → mock data).

**Areas touched by this work:**
- `src/renderer/chatbridge/` (bridge.ts, tool-router.ts, tool-builder.ts, bridge-sdk.js, apps/, registry/)
- `src/renderer/components/chatbridge/SidePanel.tsx`
- `src/renderer/public/apps/` (static copies for Vite build)
- `tests/e2e/` (new Playwright suite)
- `docs/plugin-contract.md` (new)

**Existing integrations:** Supabase (5 tables + RLS), OpenWeatherMap (host proxy in tool-router.ts), Vercel AI SDK 6 (streamText with tool routing).

**Risks identified:**
- **Dual file copies:** App HTML in both `chatbridge/apps/` and `public/apps/` — already out of sync after protocol fixes. Sprint 0 must fix.
- **bridge-sdk.js untested:** Exists but zero apps use it. M2 contract test app is first real consumer.
- **Protocol fixes unverified in browser:** Only unit tests confirm. M1 is first real test.
- **7 pre-existing test failures:** Not chatbridge, but could block CI.
- **Playwright not installed:** User will install in parallel.
- **`__proxyResult` is new pattern:** Weather iframe has no handler, NASA will also need it.

---

## Sprint 0: Tracer Bullet (Brownfield)

**Objective:** Fix the dual-copy problem, commit CLAUDE.md documentation, prove the build-serve-test path works.

### PR 0.1: Fix dual app copies + CLAUDE.md documentation
**Branch:** `sprint-0/tracer-bullet`
**Depends on:** nothing
**Existing code touched:** `electron.vite.config.ts`, `src/renderer/public/apps/` (removed), CLAUDE.md files added
**Patterns to follow:** Vite publicDir or copy plugin convention
**TDD:** no (infrastructure change, not behavioral)
**Verification criteria:**
- [ ] Single source of truth for app HTML: `src/renderer/chatbridge/apps/` only
- [ ] `public/apps/` removed or replaced with build-time copy mechanism
- [ ] CLAUDE.md files committed for chatbridge/, registry/, apps/, components/chatbridge/
- [ ] `pnpm build:web` succeeds
- [ ] `pnpm serve:web` → app iframes load at `/apps/chess/index.html` etc.
- [ ] `pnpm test` — chatbridge tests pass (7 pre-existing failures in token-estimation/settingsStore are known and NOT chatbridge-related; ignore those)
- [ ] Existing chatbridge unit tests still pass (85+ core + 31 app-specific)

#### Commit 0.1.1: Eliminate dual app copies
The problem: `src/renderer/public/apps/` has stale pre-fix copies, `src/renderer/chatbridge/apps/` has the real protocol-fixed versions. Fix by either:
- (a) Adding a Vite plugin in `electron.vite.config.ts` that copies `chatbridge/apps/` → build output `apps/` directory, then delete `public/apps/`
- (b) Or symlinking `public/apps/` → `chatbridge/apps/`

Option (a) is cleaner. Add to the renderer vite config:
```typescript
// vite-plugin-copy-apps: copies chatbridge/apps/*.html to build output
{
  name: 'copy-chatbridge-apps',
  writeBundle() {
    // copy src/renderer/chatbridge/apps/ → outDir/apps/
  }
}
```
- [ ] Remove `src/renderer/public/apps/` directory
- [ ] Verify: `pnpm build:web` → `release/app/dist/renderer/apps/chess/index.html` exists with protocol fixes

#### Commit 0.1.2: Add CLAUDE.md files
- [ ] Commit all 4 CLAUDE.md files generated during exploration
- [ ] Verify: git status clean

#### Commit 0.1.3: Verify build-serve path
- [ ] `pnpm build:web && pnpm serve:web`
- [ ] Open browser → landing page loads
- [ ] Verify: chess iframe loads at `/apps/chess/index.html` (view source or network tab)

**Sprint 0 gate (Chrome browser):**
- [ ] Open tab → navigate to served web app → verify: login page renders
- [ ] Log in with test@chatbridge.dev / TestPass123! → verify: chat interface loads
- [ ] Open DevTools Network tab → navigate to `/apps/chess/index.html` directly → verify: HTML loads (200 OK, contains chess board code)

---

## Sprint 1: Chess Verification + Contract Standardization

**Objective:** Prove protocol fixes work in browser, standardize contract, fix HOST_MESSAGE_TYPES.

### PR 1.1: Chess verification + HOST_MESSAGE_TYPES fix + tool gating
**Branch:** `sprint-1/chess-verification`
**Depends on:** PR 0.1
**Existing code touched:** `bridge.ts` (line 190), `tools.ts` (getChatBridgeTools), `tool-router.ts` (remove auto-open), possibly `SidePanel.tsx`, `chess/index.html`
**Patterns to follow:** Existing bridge protocol, UUID correlation
**TDD:** yes
**Verification criteria:**
- [ ] HOST_MESSAGE_TYPES constant updated: `['app_init', 'tool_call']` (not `tool_call_result`)
- [ ] Tool gating: only `open_app` available when no app is open; app tools appear after `open_app`; `close_app` hides them
- [ ] Auto-open removed from tool-router.ts — calling a tool without opening the app returns an error
- [ ] Unit tests for HOST_MESSAGE_TYPES and tool gating
- [ ] Regression: all chatbridge unit tests pass (update existing tests that assumed all-tools-visible)
- [ ] New: chess app opens in browser, board renders, moves work

#### Commit 1.1.1: Fix HOST_MESSAGE_TYPES constant
- [ ] Write test asserting HOST_MESSAGE_TYPES contains 'tool_call' (not 'tool_call_result')
- [ ] Verify: test fails
- [ ] Fix bridge.ts line 190: change `'tool_call_result'` to `'tool_call'`
- [ ] Verify: test passes, all bridge tests pass

#### Commit 1.1.2: Implement tool gating
- [ ] Write test: `getChatBridgeTools(null)` returns only `[open_app]` — no app-specific tools
- [ ] Write test: `getChatBridgeTools('chess')` returns `[open_app, start_game, make_move, get_board, get_hint, resign, close_app]`
- [ ] Write test: `routeToolCall('get_weather', {city:'NYC'})` returns error when no app is open
- [ ] Verify: tests fail
- [ ] Fix `tools.ts::getChatBridgeTools()`: only include tools for `activeAppId`, not all enabled apps
- [ ] Fix `tool-router.ts::routeToolCall()`: remove auto-open logic (lines 68-79), return error JSON if tool's app is not active
- [ ] Verify: tests pass
- [ ] Update any existing tests that assumed all tools visible at all times

#### Commit 1.1.3: Browser-verify chess protocol
- [ ] Build and serve web app
- [ ] Log in → send "let's play chess" → verify LLM calls `open_app` first → side panel opens
- [ ] Verify LLM then calls `start_game` → board renders
- [ ] Click pieces → verify moves work
- [ ] If any failures: debug and fix the specific protocol mismatch

### PR 1.2: Contract test app + bridge-sdk.js validation
**Branch:** `sprint-1/contract-test-app`
**Depends on:** PR 1.1
**Existing code touched:** `registry/apps.json` (add entry), `bridge-sdk.js` (bug fixes if any)
**Patterns to follow:** bridge-sdk.js API (ChatBridge.onToolCall, sendStateUpdate, sendComplete)
**TDD:** yes
**Verification criteria:**
- [ ] Contract test app (~50 lines HTML) uses bridge-sdk.js exclusively
- [ ] Handles app_init, responds to one tool_call, sends state_update, sends app_complete
- [ ] Registered in apps.json with one tool
- [ ] Opens via chat, tool invoked, result returned in chat response
- [ ] After close: panel DOM element removed, no uncaught console errors, next chat message sends successfully
- [ ] bridge-sdk.js confirmed working (first real consumer)
- [ ] Regression: existing apps still work

#### Commit 1.2.1: Create contract test app
- [ ] Write unit test for contract test app tool schema
- [ ] Create `src/renderer/chatbridge/apps/contract-test/index.html` (~50 lines)
  - Uses `<script src="../../bridge-sdk.js"></script>` or inline copy
  - `ChatBridge.onToolCall('echo', (params) => ({echo: params.message}))`
  - `ChatBridge.sendStateUpdate({status: 'ready'})`
- [ ] Register in apps.json: id="contract-test", type="internal", one tool "echo"
- [ ] Verify: unit tests pass

#### Commit 1.2.2: Browser-verify contract test app
- [ ] Build and serve
- [ ] Send "open contract test" → panel opens, status connected
- [ ] LLM calls echo tool → result returned in chat
- [ ] Close app → chat continues
- [ ] If bridge-sdk.js has bugs: fix them here

### PR 1.3: Disable Spotify + document contract
**Branch:** `sprint-1/contract-freeze`
**Depends on:** PR 1.2
**Existing code touched:** `registry/apps.json` (disable spotify)
**TDD:** no (documentation PR)
**Verification criteria:**
- [ ] Spotify disabled in apps.json (`"enabled": false`)
- [ ] `docs/plugin-contract.md` written with: registry schema, message protocol, lifecycle sequence, auth patterns, known quirks
- [ ] Contract document references bridge-sdk.js as the standard SDK
- [ ] Regression: spotify no longer appears in open_app tool enum

#### Commit 1.3.1: Disable Spotify
- [ ] Set `"enabled": false` in apps.json for spotify
- [ ] Verify: generateOpenAppTool() no longer includes spotify

#### Commit 1.3.2: Write plugin contract
- [ ] Create `docs/plugin-contract.md` with verified shapes from M2:
  - Registry entry schema
  - Host→Iframe messages (app_init, tool_call)
  - Iframe→Host messages (tool_result/tool_call_result, state_update, app_complete, error)
  - Lifecycle sequence diagram (text/mermaid)
  - Auth patterns (none, api_key, oauth2_pkce)
  - bridge-sdk.js API reference
  - Known quirks (both response types work, bridge resolves by id)

**Sprint 1 gate (Chrome browser):**
- [ ] Open tab → log in → send "let's play chess" → verify: LLM calls open_app first → side panel opens, board renders with pieces → click e2 pawn → click e4 → verify: pawn moves → send "I resign" → verify: game over state → close app → verify: panel gone
- [ ] Send "open contract test" → verify: LLM calls open_app → panel opens, status "Connected" → LLM invokes echo tool → verify: result appears in chat → close app → verify: panel closes, chat continues
- [ ] Regression: send "check the weather in London" → verify: LLM calls open_app(weather) first → weather panel opens (mock data OK for now)
- [ ] Tool gating check: with no app open, verify LLM only has open_app available (ask "what tools do you have?" or check via DevTools)

---

## Sprint 2: Weather Real API + NASA App

**Objective:** Weather shows real data, NASA app built with bridge-sdk.js, host proxy extended.

### PR 2.1: Weather __proxyResult handler
**Branch:** `sprint-2/weather-real-api`
**Depends on:** Sprint 1 complete
**Existing code touched:** `src/renderer/chatbridge/apps/weather/index.html` (handleToolCall function)
**Patterns to follow:** Weather's existing rendering pipeline (updateCurrentWeather, updateForecast)
**TDD:** yes
**Verification criteria:**
- [ ] Weather iframe detects `__proxyResult` in tool_call payload
- [ ] Real API data feeds into existing rendering functions (card population, temperature display)
- [ ] With VITE_WEATHER_API_KEY set: "weather in Tokyo" → real Tokyo data in both chat and panel
- [ ] Without API key: graceful fallback to mock data (existing behavior preserved)
- [ ] Regression: weather unit tests still pass

#### Commit 2.1.1: Add __proxyResult handler
- [ ] Write unit test: when tool_call contains __proxyResult, iframe renders that data instead of generating mocks
- [ ] Verify: test fails
- [ ] Add handler in weather iframe's handleToolCall():
  ```javascript
  if (payload.args && payload.args.__proxyResult) {
    // Feed proxied data into rendering pipeline
    updateCurrentWeather(payload.args.__proxyResult)
    sendToHost('tool_call_result', {result: 'displayed'}, id)
    return
  }
  ```
- [ ] Verify: test passes

#### Commit 2.1.2: Browser-verify with real API
- [ ] Set VITE_WEATHER_API_KEY in .env
- [ ] Build and serve
- [ ] "What's the weather in Tokyo?" → verify real data in panel (not mock 65°F)

### PR 2.2: NASA Space Explorer app
**Branch:** `sprint-2/nasa-app`
**Depends on:** Sprint 1 complete (contract frozen, bridge-sdk.js validated)
**Existing code touched:** `registry/apps.json` (add NASA entry), `tool-router.ts` (extend executeHostProxiedTool)
**Patterns to follow:** bridge-sdk.js for iframe communication, weather proxy pattern for host-side API calls
**TDD:** yes
**Verification criteria:**
- [ ] NASA app at `src/renderer/chatbridge/apps/nasa/index.html` (~700-900 lines)
- [ ] Uses bridge-sdk.js (not inline protocol)
- [ ] Two-tab layout: Explore (APOD) + Dashboard (Mars photos, asteroids)
- [ ] 3 tools minimum registered: get_apod, get_mars_photos, get_asteroids (4th get_earth_image is stretch)
- [ ] Host proxy extended in tool-router.ts for NASA API endpoints
- [ ] State updates sent on tab switch and navigation
- [ ] Dark theme matching mockup at `docs/mockups/nasa-app-mockup.html`
- [ ] Registered in apps.json as external_public with api_key auth
- [ ] With VITE_NASA_API_KEY: real APOD and Mars photos display
- [ ] Without key: mock fallback data
- [ ] Regression: existing apps still work, all unit tests pass

#### Commit 2.2.1: Add NASA proxy handlers + registry entry
- [ ] Write unit tests for NASA proxy handlers (get_apod, get_mars_photos, get_asteroids)
- [ ] Verify: tests fail
- [ ] Add NASA API endpoint handlers in `executeHostProxiedTool()`:
  - get_apod → `https://api.nasa.gov/planetary/apod?api_key=${apiKey}&date=${date}`
  - get_mars_photos → `https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/photos?earth_date=${date}&api_key=${apiKey}`
  - get_asteroids → `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${apiKey}`
- [ ] Add mock fallback functions for each
- [ ] Add NASA entry to apps.json
- [ ] Add VITE_NASA_API_KEY to .env.example
- [ ] Verify: tests pass

#### Commit 2.2.2: Create NASA iframe app
- [ ] Create `src/renderer/chatbridge/apps/nasa/index.html`
- [ ] Must use bridge-sdk.js: `ChatBridge.onToolCall(handler)`
- [ ] Explore tab: APOD hero image, title, explanation, prev/next day nav
- [ ] Dashboard tab: Mars rover photo grid (2x3), asteroid table
- [ ] State updates: `ChatBridge.sendStateUpdate({tab, currentDate, ...})` on navigation
- [ ] Dark theme matching mockup
- [ ] Handle __proxyResult pattern (same as weather fix)

#### Commit 2.2.3: Browser-verify NASA app
- [ ] Set VITE_NASA_API_KEY in .env (register free at api.nasa.gov)
- [ ] Build and serve
- [ ] "Show me something about space" → NASA opens, APOD displays
- [ ] Navigate to previous day → image changes
- [ ] Switch to Dashboard tab → Mars photos visible
- [ ] Ask chatbot about current APOD → references it by name

**Sprint 2 gate (Chrome browser):**
- [ ] Open tab → log in → "what's the weather in Tokyo?" → verify: LLM calls open_app first, then get_weather → side panel opens, shows REAL temperature data (not mock 65°F), chat response includes real temp
- [ ] "close the weather app" → verify: panel closes, LLM confirms closure
- [ ] "Show me today's astronomy picture" → verify: LLM calls open_app(nasa) first → NASA panel opens, Explore tab shows APOD image with title and explanation
- [ ] Click "Previous Day" in NASA panel → verify: different image loads
- [ ] Click "Dashboard" tab → verify: Mars rover photos grid visible, asteroid table populated
- [ ] "What am I looking at?" → verify: chatbot references current APOD by name (context from state_update)
- [ ] "close NASA" → verify: panel closes
- [ ] "What was the weather in Tokyo earlier?" → verify: chatbot recalls weather data from context history (no app opens, just memory)
- [ ] Regression: "let's play chess" → verify: LLM opens chess first → board renders, moves work → close → back to open_app-only state

---

## Sprint 3: Playwright E2E Test Suite

**Objective:** Comprehensive automated E2E tests covering the brief's 7 scenarios + app-specific regression.

**User action required:** Install Playwright before this sprint:
```bash
pnpm add -D @playwright/test
npx playwright install chromium
```

### PR 3.1: Playwright infrastructure + core scenarios
**Branch:** `sprint-3/playwright-core`
**Depends on:** Sprint 2 complete
**Existing code touched:** none (new files only)
**TDD:** N/A (this IS the test suite)
**Verification criteria:**
- [ ] `tests/e2e/playwright.config.ts` configured for web build
- [ ] Test helpers: `app-harness.ts`, `chat-harness.ts`, `test-logger.ts`
- [ ] `core-scenarios.spec.ts` covers all 7 brief scenarios
- [ ] All 7 core scenarios pass against built web app
- [ ] HTML reporter outputs to `test-results/summary.html`
- [ ] Trace recording enabled for debugging

#### Commit 3.1.1: Playwright config + helpers
- [ ] Create `tests/e2e/playwright.config.ts`:
  - baseURL: `http://localhost:3000` (serve:web)
  - browser: chromium only
  - retries: 1
  - reporter: html + junit
  - trace: on-first-retry
  - screenshot: on
- [ ] Create `tests/e2e/helpers/chat-harness.ts`:
  - `login(page, email, password)`
  - `sendChatMessage(page, text)`
  - `waitForAssistantResponse(page)`
- [ ] Create `tests/e2e/helpers/app-harness.ts`:
  - `waitForPanel(page, appId)`
  - `waitForConnected(page)`
  - `closeApp(page)`
  - `getPanelState(page)`
- [ ] Create `tests/e2e/helpers/test-logger.ts`:
  - Structured JSON step logging

#### Commit 3.1.2: Core 7 scenarios
- [ ] `tests/e2e/core-scenarios.spec.ts`:
  1. Tool discovery & invocation — "let's play chess" → side panel appears
  2. App UI renders correctly — iframe loaded, status="Connected"
  3. Completion signaling — interact → close → chat resumes
  4. Context retention — after close, ask about results → response references them
  5. App switching — chess → weather → back
  6. Ambiguous routing — "show me something" → chatbot picks or clarifies
  7. Refusal for unrelated — "what's 2+2?" → no app opens
- [ ] Run: `npx playwright test tests/e2e/core-scenarios.spec.ts`
- [ ] Verify: all 7 pass

### PR 3.2: App-specific E2E tests
**Branch:** `sprint-3/playwright-apps`
**Depends on:** PR 3.1
**Existing code touched:** none (new test files)
**TDD:** N/A
**Verification criteria:**
- [ ] `tests/e2e/app-flows/chess.spec.ts` — 8+ test cases including full game flow
- [ ] `tests/e2e/app-flows/weather.spec.ts` — real API data verification
- [ ] `tests/e2e/app-flows/nasa.spec.ts` — APOD, Mars photos, tab switching
- [ ] `tests/e2e/resilience.spec.ts` — boundary/aggressive testing (7+ cases)
- [ ] All tests pass
- [ ] Screenshots captured at key steps

#### Commit 3.2.1: Chess E2E tests
- [ ] `tests/e2e/app-flows/chess.spec.ts`:
  - Board renders on open
  - Start game via chat
  - Make move via chat
  - Click-based move in iframe (if accessible through iframe)
  - Get hint
  - Invalid move returns error
  - Resign → game over → app_complete
  - Full mini-game flow

#### Commit 3.2.2: Weather + NASA E2E tests
- [ ] `tests/e2e/app-flows/weather.spec.ts`:
  - Open → dashboard visible
  - Query real city → real data
  - Different city → panel updates
- [ ] `tests/e2e/app-flows/nasa.spec.ts`:
  - Open → APOD visible
  - Navigate previous day
  - Switch to Dashboard
  - Ask chatbot about APOD → context retained

#### Commit 3.2.3: Resilience tests
- [ ] `tests/e2e/resilience.spec.ts`:
  - Rapid tool calls (5 messages fast)
  - Open app while another is open → clean switch
  - Close panel mid-tool-call → no crash
  - Double open_app → idempotent

**Sprint 3 gate (automated):**
- [ ] `npx playwright test` → all tests pass
- [ ] `test-results/summary.html` opens and shows green results
- [ ] No flaky tests (run 2x to confirm)

---

## Sprint 4: Polish + Documentation

**Objective:** Tier 1 JSON app, UX polish, documentation updates.

### PR 4.1: Tier 1 JSON edu app (FlashForge or WordLab)
**Branch:** `sprint-4/tier1-edu-app`
**Depends on:** Sprint 3 complete
**Existing code touched:** `registry/apps.json`, `tool-router.ts` (if needed), `system-prompt.ts` (if context format needs extending)
**TDD:** yes
**Verification criteria:**
- [ ] Tier 1 app registered with 4-5 tools, type="internal", no entrypoint (JSON-only, no iframe)
- [ ] Tool appears in buildToolSet() output (getChatBridgeTools returns it)
- [ ] Tool call returns valid JSON matching declared schema
- [ ] No iframe element in DOM during interaction (Tier 1 = JSON-only)
- [ ] Demonstrates different integration pattern from chess/weather/NASA
- [ ] E2E test added

#### Commit 4.1.1: Implement Tier 1 app
- [ ] Write unit tests for tool handlers
- [ ] Register in apps.json with no entrypoint
- [ ] Implement tool logic in tool-router.ts (or as pure functions)
- [ ] Verify: unit tests pass

#### Commit 4.1.2: E2E test for Tier 1 app
- [ ] Add `tests/e2e/app-flows/tier1-edu.spec.ts`
- [ ] Verify: test passes

### PR 4.2: UX polish — loading states, error cards, timeout treatment
**Branch:** `sprint-4/ux-polish`
**Depends on:** Sprint 2 complete
**Existing code touched:** `SidePanel.tsx`, app HTML files (loading indicators)
**Patterns to follow:** Mantine components for UI, existing SidePanel state machine
**TDD:** yes (for error/timeout behavior)
**Verification criteria:**
- [ ] Loading spinner visible in SidePanel during iframe load (not blank white)
- [ ] Error card with "Retry" button shown when iframe fails or times out (15s)
- [ ] Retry button resets loading state and re-attempts iframe load
- [ ] Consistent dark theme across all app iframes
- [ ] Regression: all existing apps still work, all unit tests pass

#### Commit 4.2.1: Loading and error state UX
- [ ] Write test: SidePanel shows spinner when panelState='loading'
- [ ] Write test: SidePanel shows error card with retry when panelState='error'
- [ ] Implement/improve loading and error overlays in SidePanel.tsx
- [ ] Verify: tests pass

#### Commit 4.2.2: Consistent dark theme
- [ ] Audit all app iframes for theme consistency
- [ ] Fix any light-theme gaps
- [ ] Verify: all apps render with dark theme

### M7: Manual Exploratory Testing (Non-PR Activity)

**Runs alongside Sprint 3.** This is not a PR — it's a manual Chrome walkthrough covering things Playwright can't catch.

**Scenarios (from spec M7):**
1. Login → "check the weather in Paris" → side panel opens, real weather data
2. "Let's play chess" → board appears → make moves → ask for help → resign
3. "Show me something about space" → NASA opens → browse APOD → switch to dashboard
4. Switch between apps in same conversation
5. Ask chatbot about previous app results (context retention)
6. Verify error states (close panel mid-action, rapid messages)

**Look for:** Visual glitches, UX awkwardness, timing issues, layout breaks, state leaks between apps.

**Output:** List of issues found → fed into PR 4.2 (UX polish) or filed as bugs.

### PR 4.3: Documentation + architecture overview
**Branch:** `sprint-4/docs-final`
**Depends on:** PR 4.1, PR 4.2
**TDD:** no
**Verification criteria:**
- [ ] `docs/plugin-contract.md` updated with learnings from Sprint 2-3
- [ ] `docs/developer-guide.md` updated with contract reference
- [ ] `docs/cost-analysis.md` updated with real token data from testing
- [ ] Architecture overview document created for submission
- [ ] All docs cross-reference correctly

**Sprint 4 gate (Chrome browser):**
- [ ] Open tab → log in → trigger Tier 1 edu app via chat → verify: no iframe opens, structured response in chat
- [ ] Full walkthrough: chess → weather → NASA → edu app → verify: all work, context retained across switches
- [ ] Loading spinner visible when opening any app → error card visible if app fails to load
- [ ] `npx playwright test` → all tests still pass (including new Tier 1 test)

---

## Dependency Graph

```
PR 0.1 (tracer bullet)
  └─► PR 1.1 (chess verification + HOST_MESSAGE_TYPES)
       └─► PR 1.2 (contract test app + bridge-sdk.js validation)
            └─► PR 1.3 (disable spotify + contract doc)
                 ├─► PR 2.1 (weather __proxyResult)     ← PARALLEL
                 └─► PR 2.2 (NASA app)                  ← PARALLEL
                      │
                      ├─► [Both 2.1 AND 2.2 must complete]
                      │    ├─► PR 3.1 (Playwright core)
                      │    │    └─► PR 3.2 (app E2E tests)
                      │    └─► M7 (manual exploratory testing) ← NON-PR ACTIVITY
                      │
                      ├─► PR 4.1 (Tier 1 edu app)       ← CAN START AFTER SPRINT 2
                      ├─► PR 4.2 (UX polish)             ← CAN START AFTER SPRINT 2
                      └─► PR 4.3 (docs + architecture)   ← AFTER 4.1 + 4.2
```

**Note on PR 2.1/2.2 merge:** Both modify `tool-router.ts`. Whichever merges second resolves the conflict (NASA adds new handlers, weather proxy is untouched — clean merge expected).

## Parallelization Summary

| Sprint | PRs | Parallel? | Notes |
|--------|-----|-----------|-------|
| 0 | 0.1 | Sequential | Single PR, must complete before Sprint 1 |
| 1 | 1.1 → 1.2 → 1.3 | Sequential | Each depends on previous (verification chain) |
| 2 | 2.1, 2.2 | **Parallel** | Weather fix and NASA app are independent after contract freeze |
| 3 | 3.1 → 3.2 | Sequential | Helpers must exist before app tests. Depends on BOTH 2.1 and 2.2. |
| 4 | 4.1, 4.2 parallel → 4.3 | **Partial parallel** | Edu app + UX polish independent, docs after both |

**Cross-sprint parallelism:**
- PR 4.1 and PR 4.2 can start as soon as Sprint 2 completes, in parallel with Sprint 3
- M7 (manual exploratory testing) runs alongside Sprint 3 — not a PR, documented below
- Playwright install can happen anytime before Sprint 3

## Spec Milestone → Plan PR Mapping

| Spec Milestone | Plan PR(s) |
|---|---|
| M1: Chess Verification | PR 0.1 + PR 1.1 |
| M2: Contract Verification | PR 1.2 + PR 1.3 |
| M3: Weather Real API | PR 2.1 |
| M4: NASA Space Explorer | PR 2.2 |
| M5: Plugin Contract Freeze | PR 1.3 (initial) + PR 4.3 (final update) |
| M6: Playwright Test Suite | PR 3.1 + PR 3.2 |
| M7: Manual Exploratory Testing | Non-PR activity (see below) |
| M8: Tier 1 JSON Edu App | PR 4.1 |
| M9: App Cleanup & UX Polish | PR 4.2 |
| M10: Documentation & Cost | PR 4.3 |
| M11: Rubik's Cube (stretch) | Not planned (stretch) |

**Deferred to separate plans:** Deployment, demo video, social post, GitLab push

## Human Steps Required

| When | Action | Time |
|------|--------|------|
| Before Sprint 2 | Register NASA API key at api.nasa.gov, add to .env as VITE_NASA_API_KEY | 2 min |
| Before Sprint 2 | Ensure VITE_WEATHER_API_KEY is set in .env | 1 min |
| Before Sprint 3 | `pnpm add -D @playwright/test && npx playwright install chromium` | 2 min |
| During Sprint 3 | M7: Manual exploratory testing in Chrome (6 scenarios) | 15-20 min |
| Each sprint gate | Chrome browser verification (deterministic checklist) | 5-10 min each |

## Known Pre-Existing Test Failures (Not Chatbridge)

These 7 failures exist before our work and should be ignored in sprint gates:
- `src/renderer/packages/token-estimation/__tests__/analyzer.test.ts` — 5 failures (attachment cache/mode)
- `src/renderer/stores/settingsStore.persist.test.ts` — 1 failure (provider settings merge)
- 1 additional intermittent failure

Sprint gate criterion: **chatbridge tests pass** (not "all tests pass").
