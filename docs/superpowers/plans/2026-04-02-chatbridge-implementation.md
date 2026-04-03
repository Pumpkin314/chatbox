# ChatBridge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers-extended-cc:parallel-pr-execution to implement this plan.

**Goal:** Add third-party app integration to Chatbox web build — apps register tools, render in a side panel, and communicate bidirectionally with the AI chatbot.
**Architecture:** Host-orchestrated (client-side). React orchestration layer wraps OpenAI function calling, routes tool calls to sandboxed app iframes via postMessage, persists conversations to Supabase.
**Tech Stack:** Existing (React, Vite, Jotai, Vercel AI SDK, Vitest) + Supabase (auth + DB), OpenAI function calling
**Project type:** brownfield
**Compaction:** auto

**Spec:** `docs/superpowers/specs/2026-04-02-chatbridge-design.md`
**Risks:** `docs/chatbridge_risks.md`
**Post-MVP:** `docs/chatbridge_post_mvp.md`

**External services:**
- Supabase — MCP: none, CLI: `supabase`, human steps: 1 (~2 min, create project on dashboard)
- OpenAI — MCP: none, CLI: none, human steps: 1 (~1 min, get API key)
- OpenWeatherMap — MCP: none, CLI: none, human steps: 1 (~1 min, get free API key)
- Spotify — MCP: none, CLI: none, human steps: 1 (~3 min, register app in developer dashboard)
- Vercel — MCP: none, CLI: `vercel`, human steps: 1 (~2 min, link project)
**Total estimated human setup time:** ~9 minutes

**Service integration levels:**
- Existing Chatbox chat (streaming, history) — **L5** critical: must not break
- Existing provider settings UI — **L5** critical: must not break
- Supabase Auth — **L3** degraded: app works without auth in dev (local-only mode)
- Supabase DB — **L3** degraded: fallback to local storage if Supabase unavailable
- OpenAI function calling — **L4** required: core feature, but app loads without it
- OpenWeatherMap API — **L2** stubbed: weather app shows mock data if API unavailable
- Spotify API — **L2** stubbed: Spotify app shows mock UI if OAuth not configured

---

## Existing System Analysis

**Architecture:** Electron + React SPA with web build mode (`CHATBOX_BUILD_PLATFORM=web`). Jotai atoms for state, React-Query for caching, platform abstraction separates web/desktop/mobile.

**Test infrastructure:** Vitest 4.0.16, 35+ test files (co-located + integration), `pnpm test` runs all, `pnpm test:coverage` for coverage. Mock factories in `test/integration/mocks/`.

**Deploy pipeline:** No CI/CD. Manual `pnpm build:web` → static SPA in `/release/app/dist/renderer/`. Served via `npx serve` or any static host.

**Conventions:**
- Jotai atoms in `stores/`, business logic in `packages/`, React components in `components/`
- Zod schemas for types in `shared/types/`
- Tools injected via ToolSet into `streamText()` calls
- Platform-agnostic storage via `Platform` interface
- Biome for linting/formatting

**Areas touched by this work:**
- `src/renderer/stores/session/` — generation.ts, messages.ts (tool injection, app state)
- `src/renderer/packages/model-calls/` — stream-text.ts, tools.ts (ChatBridge tools)
- `src/renderer/components/` — new SidePanel, extend Message.tsx
- `src/renderer/components/Artifact.tsx` — reference pattern for iframe postMessage
- `src/shared/types/session.ts` — extend MessageSchema
- `src/renderer/platform/` — Supabase client init
- New directory: `src/renderer/chatbridge/` — orchestration layer, registry, bridge

**Existing integrations:**
- 15+ AI providers via @ai-sdk/* (OpenAI, Anthropic, Google, etc.)
- MCP tool support via `packages/mcp/controller.ts`
- OAuth: stubbed in open-source edition (no-ops)
- Storage: IndexedDB/localforage for web, electron-store for desktop

**Risks identified:**
- No existing CI/CD — manual deploy, no automated test gates
- OAuth is stubbed — need to implement real OAuth for Spotify
- No .env file pattern — API keys stored in UI settings (we need env vars for Supabase)
- Message schema changes affect all existing code that reads messages
- Web build has never had server-backed persistence — Supabase is new territory

---

## Sprint 0: Brownfield Tracer Bullet

**Objective:** Prove the change path works — web build compiles, deploys, Supabase connects, existing features unbroken.

### PR 0.1: CLAUDE.md + Supabase init + health endpoint
**Branch:** `sprint-0/tracer-bullet`
**Depends on:** nothing
**Existing code touched:** `src/renderer/platform/`, `package.json`
**Patterns to follow:** Platform abstraction, existing storage patterns
**TDD:** yes

**Verification criteria:**
- [ ] CLAUDE.md files committed for stores/, packages/, components/, shared/types/, platform/
- [ ] `pnpm dev:web` starts without errors
- [ ] `pnpm build:web` produces output in /release/app/dist/renderer/
- [ ] Supabase client initializes (connection test passes)
- [ ] Existing chat features still work (send message, get streaming response)
- [ ] Existing tests pass (`pnpm test`)
- [ ] Regression: existing provider settings UI loads and saves correctly

#### Commit 0.1.1: Add CLAUDE.md files
- [ ] Commit all 5 CLAUDE.md files from exploration
- [ ] Verify: git status clean

#### Commit 0.1.2: Add Supabase dependency + client init
- [ ] `pnpm add @supabase/supabase-js`
- [ ] Create `src/renderer/chatbridge/supabase.ts` — Supabase client singleton
- [ ] Add env var loading: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Write test: Supabase client initializes with valid config
- [ ] Verify: test passes, existing tests still pass

#### Commit 0.1.3: Supabase project setup via CLI
- [ ] `supabase init` in project root
- [ ] Create initial migration: `supabase migration new init`
- [ ] Add conversations, messages, app_registry, token_usage_log, user_app_tokens tables (from spec Section 4)
- [ ] `supabase db push` to apply
- [ ] Verify: tables exist, RLS policies active

#### Commit 0.1.4: Deploy and verify
- [ ] `pnpm build:web`
- [ ] Deploy to Vercel: `vercel deploy`
- [ ] Set env vars: `vercel env add VITE_SUPABASE_URL`, `vercel env add VITE_SUPABASE_ANON_KEY`
- [ ] Verify: deployed app loads, existing chat works

### PR 0.2: Live app exploration — validate existing system analysis (BACKGROUNDED)
**Branch:** none (read-only exploration, no code changes)
**Depends on:** nothing (runs in parallel with PR 0.1)
**Existing code touched:** none
**TDD:** no
**Execution:** Backgrounded agent with Chrome MCP against `pnpm dev:web`

This agent boots the real web app locally and validates that our exploration findings match actual runtime behavior. Any discrepancy discovered here updates the CLAUDE.md files and may revise Sprint 1+ plans before we commit to them.

**Verification criteria:**
- [ ] `pnpm dev:web` starts successfully — note the local URL and any console warnings
- [ ] App loads in browser — confirm layout structure matches our analysis (sidebar, chat area, message list)
- [ ] Settings page: confirm provider config UI exists, API key fields render for OpenAI
- [ ] Enter an OpenAI API key → send a test message → confirm streaming response works
- [ ] Confirm message persistence mechanism: refresh page → do messages survive? (validates IndexedDB/localforage finding)
- [ ] Inspect Artifact component: find a way to trigger an artifact render (if possible) → confirm iframe sandbox attributes match our documentation (`allow-scripts allow-forms`, no `allow-same-origin`)
- [ ] Check platform detection: confirm `CHATBOX_BUILD_PLATFORM=web` disables Electron APIs (no `window.electronAPI` in console)
- [ ] Check existing tool support: if web search tool exists, trigger it → confirm tool call flow matches our stream-text.ts analysis
- [ ] Identify the exact insertion point for the side panel in the chat layout DOM — which parent container, what flex structure
- [ ] Document any discrepancies from our existing system analysis

**Output:** Report of findings. If discrepancies found:
1. Update relevant CLAUDE.md files
2. Flag specific plan items that may need revision
3. Note any blockers discovered (e.g., dev:web doesn't start, missing dependencies)

**Sprint 0 gate (Chrome browser):**
- [ ] Open tab → navigate to deployed URL → verify: app loads → open settings → verify: provider settings UI renders → add OpenAI key → send test message → verify: streaming response appears
- [ ] Open tab → browser console → verify: no Supabase connection errors in console

---

## Sprint 1: Core Platform — Chat + Auth + Persistence

**Objective:** Working chat with Supabase auth and server-persisted conversations. This replaces local-only storage with Supabase-backed persistence while keeping local storage as fallback.

### PR 1.1: Supabase Auth integration
**Branch:** `sprint-1/supabase-auth`
**Depends on:** PR 0.1
**Existing code touched:** `src/renderer/platform/web_platform.ts`, `src/renderer/stores/`
**Patterns to follow:** Platform abstraction, Jotai atoms for state
**TDD:** yes

**Verification criteria:**
- [ ] User can sign up with email/password
- [ ] User can log in and see their session
- [ ] User can log out
- [ ] Auth state persists across page refresh
- [ ] Unauthenticated users see login prompt
- [ ] Regression: existing chat UI structure unchanged

#### Commit 1.1.1: Auth store + atoms
- [ ] Create `src/renderer/chatbridge/auth.ts` — auth atoms (user, session, loading)
- [ ] Write test: auth atoms initialize to null/loading state
- [ ] Implement Supabase auth listeners (`onAuthStateChange`)
- [ ] Verify: tests pass

#### Commit 1.1.2: Login/signup UI
- [ ] Create `src/renderer/components/auth/LoginPage.tsx` — email/password form
- [ ] Add route guard — redirect to login if unauthenticated
- [ ] Write test: login form renders, submits credentials
- [ ] Verify: tests pass

#### Commit 1.1.3: Auth flow integration
- [ ] Wire auth state to app layout — show/hide sidebar based on auth
- [ ] Add logout button to sidebar
- [ ] Verify: full auth flow works end-to-end
- [ ] Regression: logged-in user sees normal chat UI

### PR 1.2: Conversation persistence to Supabase
**Branch:** `sprint-1/conversation-persistence`
**Depends on:** PR 1.1
**Existing code touched:** `src/renderer/stores/chatStore.ts`, `src/renderer/stores/session/messages.ts`
**Patterns to follow:** Existing storage abstraction, React-Query patterns
**TDD:** yes

**Verification criteria:**
- [ ] New conversations saved to Supabase conversations table
- [ ] Messages saved to Supabase messages table on each turn
- [ ] Conversation list loads from Supabase on app start
- [ ] Conversation history loads when selecting a conversation
- [ ] Conversations persist across browser sessions (close/reopen)
- [ ] Fallback: if Supabase unavailable, falls back to local storage (L3 degraded mode)
- [ ] Regression: message rendering unchanged (text, images, tool calls)

#### Commit 1.2.1: Supabase storage layer
- [ ] Create `src/renderer/chatbridge/storage.ts` — CRUD for conversations/messages
- [ ] Write tests: create conversation, insert message, fetch by ID, list by user
- [ ] Verify: tests pass against Supabase (or mock)

#### Commit 1.2.2: Wire chatStore to Supabase
- [ ] Modify `chatStore.ts` — replace local storage calls with Supabase storage layer
- [ ] Keep local storage as fallback (if Supabase unavailable)
- [ ] Write test: conversation CRUD flows through Supabase
- [ ] Verify: tests pass, existing tests still pass

#### Commit 1.2.3: Message persistence
- [ ] Modify `messages.ts` — save messages to Supabase after each turn
- [ ] Include token_usage in message record
- [ ] Write test: message saved with correct fields after LLM response
- [ ] Verify: tests pass

### PR 1.3: Token usage logging
**Branch:** `sprint-1/token-logging`
**Depends on:** PR 1.2
**Existing code touched:** `src/renderer/packages/model-calls/stream-text.ts`
**Patterns to follow:** Existing usage extraction from streamText results
**TDD:** yes

**Verification criteria:**
- [ ] Every LLM call logs to token_usage_log table
- [ ] Log includes: model, prompt_tokens, completion_tokens, estimated_cost
- [ ] Cost estimation uses correct per-model pricing
- [ ] Regression: streaming response latency not noticeably impacted

#### Commit 1.3.1: Token logger module
- [ ] Create `src/renderer/chatbridge/token-logger.ts` — logs usage to Supabase
- [ ] Write test: logger inserts correct record given usage data
- [ ] Verify: test passes

#### Commit 1.3.2: Wire into streamText
- [ ] After each streamText completion, call token logger with usage data
- [ ] Verify: token_usage_log populated after sending messages

**Sprint 1 gate (Chrome browser):**
- [ ] Open tab → navigate to deployed URL → verify: login page appears → sign up with test email → verify: redirected to chat → send message "hello" → verify: streaming response → refresh page → verify: still logged in, conversation visible in sidebar → click conversation → verify: messages load from server
- [ ] Open tab → Supabase dashboard → verify: conversations table has rows → messages table has rows → token_usage_log has rows with correct token counts

---

## Sprint 2: App Integration Platform

**Objective:** The core ChatBridge feature — app registry, open_app meta-tool, side panel, postMessage bridge. Vertical slice: Chess app fully working end-to-end.

### PR 2.1: App registry + open_app meta-tool
**Branch:** `sprint-2/app-registry`
**Depends on:** Sprint 1
**Existing code touched:** `src/renderer/packages/model-calls/tools.ts`
**Patterns to follow:** Existing ToolSet injection pattern, MCP tool registration
**TDD:** yes

**Verification criteria:**
- [ ] Registry loads from static JSON config
- [ ] `open_app` tool definition generated from enabled registry entries
- [ ] Disabled apps excluded from open_app enum
- [ ] open_app injected into every LLM call's tool list
- [ ] LLM can call open_app and receive success response
- [ ] Regression: existing built-in tools (web search, etc.) still work

#### Commit 2.1.1: Registry module
- [ ] Create `src/renderer/chatbridge/registry/apps.json` — Chess, Weather, Spotify, Rubiks (disabled)
- [ ] Create `src/renderer/chatbridge/registry/index.ts` — load, filter enabled, generate open_app tool
- [ ] Write tests: load registry, filter disabled, generate correct open_app schema
- [ ] Verify: tests pass

#### Commit 2.1.2: Inject open_app into LLM calls
- [ ] Modify `tools.ts` or create `src/renderer/chatbridge/tools.ts` — ChatBridge tool provider
- [ ] Integrate with streamText tool injection (extend existing ToolSet)
- [ ] Write test: open_app appears in tool list, app-specific tools do NOT appear when no app active
- [ ] Verify: tests pass

#### Commit 2.1.3: Handle open_app tool call
- [ ] In tool call handler, detect `open_app` → set active app state → return success to LLM
- [ ] Write test: open_app({app_id: "chess"}) sets activeApp atom to "chess"
- [ ] Verify: test passes

### PR 2.2: Side panel + iframe bridge
**Branch:** `sprint-2/side-panel`
**Depends on:** PR 2.1
**Existing code touched:** `src/renderer/components/`, chat layout
**Patterns to follow:** Artifact.tsx iframe + postMessage pattern
**TDD:** yes

**Verification criteria:**
- [ ] Side panel renders when activeApp is set
- [ ] Side panel hidden when no activeApp
- [ ] SidePanel component accepts `displayMode` prop (`"panel" | "inline" | "expanded"`) defaulting to `"panel"` — inline/expanded are no-ops (post-MVP stub)
- [ ] App iframe loads bundled HTML correctly
- [ ] Iframe sandbox attributes: `sandbox="allow-scripts allow-forms"` (NO allow-same-origin)
- [ ] PostMessage bridge sends/receives messages with UUID correlation
- [ ] PostMessage origin validated on both host and app side
- [ ] CSP meta tag added to host page preventing inline script injection from app content
- [ ] Close button clears activeApp and removes iframe
- [ ] Panel width is 380px, chat area takes remaining flex space
- [ ] Regression: chat message list scroll behavior unchanged

#### Commit 2.2.1: SidePanel component
- [ ] Create `src/renderer/components/chatbridge/SidePanel.tsx`
- [ ] Header: app name + close button. Body: iframe container. Footer: status bar.
- [ ] Write test: panel renders when activeApp set, hidden when null
- [ ] Verify: test passes

#### Commit 2.2.2: Iframe bridge module
- [ ] Create `src/renderer/chatbridge/bridge.ts` — postMessage protocol implementation
- [ ] UUID generation, pending response map, timeout handling (30s), ACK/retry (5s)
- [ ] Create `src/renderer/chatbridge/bridge-sdk.js` — injected into app iframes
- [ ] Write tests: send message → receive response, timeout triggers error, duplicate UUIDs ignored
- [ ] Verify: tests pass

#### Commit 2.2.3: Wire panel into chat layout
- [ ] Modify chat page layout — flex container with SidePanel conditional
- [ ] Connect activeApp atom to SidePanel visibility
- [ ] On open_app → mount iframe with app entrypoint, send app_init message
- [ ] On close → serialize state, store as app_context message, unmount iframe
- [ ] Verify: visual layout correct, panel opens/closes

### PR 2.3: Dynamic tool scoping + tool routing
**Branch:** `sprint-2/tool-routing`
**Depends on:** PR 2.1, PR 2.2
**Existing code touched:** `src/renderer/packages/model-calls/stream-text.ts`, `tools.ts`
**Patterns to follow:** Existing tool call handling in generation.ts
**TDD:** yes

**Verification criteria:**
- [ ] When app is active, its tools appear in LLM tool list alongside open_app
- [ ] When app is closed, only open_app remains
- [ ] Tool calls for active app routed via postMessage to iframe
- [ ] Tool results from iframe fed back to LLM for continuation
- [ ] Multiple tool calls in sequence work correctly
- [ ] Regression: non-ChatBridge tool calls (web search) still work

#### Commit 2.3.1: Dynamic tool list builder
- [ ] Create `src/renderer/chatbridge/tool-builder.ts` — builds ToolSet from registry + activeApp
- [ ] Write test: no app → [open_app], chess active → [open_app, start_game, make_move, get_board, get_hint, resign]
- [ ] Verify: test passes

#### Commit 2.3.2: Tool call router
- [ ] Create `src/renderer/chatbridge/tool-router.ts` — routes tool calls to correct handler
- [ ] open_app → app lifecycle manager; app tools → postMessage to iframe
- [ ] Write test: chess tool call → postMessage sent to iframe → result returned
- [ ] Verify: test passes

#### Commit 2.3.3: Wire into streamText flow
- [ ] Modify generation.ts — use ChatBridge tool builder for tool list
- [ ] On tool_call in stream → route through tool-router → await result → continue generation
- [ ] Write test: full flow — user message → LLM calls open_app → panel opens → LLM calls app tool → result fed back
- [ ] Verify: test passes

### PR 2.4: Chess app
**Branch:** `sprint-2/chess-app`
**Depends on:** PR 2.2, PR 2.3
**Existing code touched:** none (new files)
**Patterns to follow:** Self-contained HTML with bridge-sdk.js
**TDD:** yes

**Verification criteria:**
- [ ] Chess board renders in side panel iframe
- [ ] Legal moves validated (illegal moves rejected with error)
- [ ] Board state updates on valid moves
- [ ] FEN notation sent back via bridge on every state update
- [ ] LLM can analyze board position when user asks "what should I do?"
- [ ] Game detects checkmate/stalemate and signals completion
- [ ] App state persists across close/reopen (resume game)

#### Commit 2.4.1: Chess app HTML bundle
- [ ] Create `src/renderer/chatbridge/apps/chess/index.html`
- [ ] Bundle chess.js + chessboard.js (inline, self-contained)
- [ ] Implement bridge-sdk.js integration (app_init, tool handlers, state_update, app_complete)
- [ ] Write test: chess app initializes, responds to start_game, validates moves

#### Commit 2.4.2: Chess tool definitions
- [ ] Add chess tools to registry: start_game, make_move, get_board, get_hint, resign
- [ ] Each tool has proper JSON Schema parameters and descriptions
- [ ] Write test: chess tools resolve from registry when chess is active app
- [ ] Write test: illegal move returns error message that LLM can relay to user

#### Commit 2.4.3: End-to-end chess integration
- [ ] Test full lifecycle: "let's play chess" → board appears → make moves → ask for hint → chatbot responds → game ends
- [ ] Verify: app_context messages stored in conversation history
- [ ] Verify: chatbot can reference previous game state

**Sprint 2 gate (Chrome browser):**
- [ ] Open tab → navigate to deployed URL → log in → type "let's play chess" → verify: side panel opens with chess board → click e2-e4 on board → verify: piece moves, board updates → type "what should I do here?" → verify: chatbot analyzes position and suggests move → click close on panel → verify: panel closes → type "what happened in our game?" → verify: chatbot references the game state
- [ ] Open tab → type "show me a puzzle" → verify: chatbot does NOT try to open rubiks (disabled) → type "what's the weather?" → verify: chatbot attempts to open weather app (even if not yet built, open_app call is made)

---

### PR 2.5: Context retention + app state management
**Branch:** `sprint-2/context-retention`
**Depends on:** PR 2.3, PR 2.4
**Existing code touched:** `src/renderer/chatbridge/`, `src/renderer/stores/session/`
**Patterns to follow:** Existing message model patterns
**TDD:** yes

**Verification criteria:**
- [ ] App state stored as app_context message on panel close
- [ ] Chatbot can reference past app interactions ("what happened in our chess game?")
- [ ] App state injected into system prompt for LLM awareness
- [ ] On app reopen, existing state passed via app_init (resume game)
- [ ] System prompt includes last-known state of active app (FEN for chess)
- [ ] Regression: conversation history loads correctly with app_context messages mixed in

#### Commit 2.5.1: Context manager module
- [ ] Create `src/renderer/chatbridge/context-manager.ts` — manages app state in conversation
- [ ] On state_update → persist to current message's app_state field
- [ ] On app_complete → store final state as app_context message
- [ ] Write test: state updates stored, final state creates app_context message

#### Commit 2.5.2: System prompt injection
- [ ] Inject active app state into system prompt before each LLM call
- [ ] Format: app name, state representation (FEN for chess), turn info
- [ ] Write test: system prompt includes chess FEN when chess is active

#### Commit 2.5.3: App state resume
- [ ] On open_app for previously used app, pass existingState in app_init
- [ ] Write test: chess game resumes from stored FEN after close/reopen

---

## Sprint 3: Additional Apps + Auth

**Objective:** Weather dashboard (External Public) and Spotify (External Authenticated). All 3 auth patterns demonstrated.

### PR 3.1: Weather dashboard app
**Branch:** `sprint-3/weather-app`
**Depends on:** PR 2.3 (tool routing), PR 2.5 (context retention)
**Existing code touched:** registry config only
**Patterns to follow:** Same as chess — self-contained HTML, bridge protocol
**TDD:** yes

**Verification criteria:**
- [ ] Weather app renders in side panel
- [ ] get_weather tool returns real data from OpenWeatherMap API
- [ ] get_forecast tool returns multi-day forecast
- [ ] UI displays temperature, conditions, icon
- [ ] API key passed via app_init (not hardcoded in app HTML)
- [ ] Graceful error if API key missing (shows mock data — L2 stub)
- [ ] Regression: chess app still works, switching between apps works

#### Commit 3.1.1: Weather app HTML bundle
- [ ] Create `src/renderer/chatbridge/apps/weather/index.html`
- [ ] Implement weather UI (card layout, temp, icon, conditions)
- [ ] Bridge integration: handle get_weather and get_forecast tool invocations
- [ ] Mock data fallback if API unavailable

#### Commit 3.1.2: Weather tools + registry
- [ ] Add weather tools to registry: get_weather, get_forecast
- [ ] Type: external_public, authConfig: { type: "api_key", envVar: "VITE_WEATHER_API_KEY" }
- [ ] Write test: weather tools in registry, API key passed via app_init

#### Commit 3.1.3: End-to-end weather integration
- [ ] Test: "what's the weather in San Francisco?" → panel opens → weather data displayed → chatbot discusses results
- [ ] Verify: switching from chess to weather preserves chess state

### PR 3.2: Spotify OAuth + playlist app
**Branch:** `sprint-3/spotify-app`
**Depends on:** PR 2.3 (tool routing), PR 2.5 (context retention)
**Existing code touched:** none (new files)
**Patterns to follow:** OAuth popup from host, token via postMessage
**TDD:** yes

**Verification criteria:**
- [ ] Spotify OAuth popup opens from host window (not iframe)
- [ ] User can authorize Spotify account
- [ ] Access token stored in Supabase user_app_tokens
- [ ] Token passed to app iframe via app_init
- [ ] Silent refresh works when token expires (refresh_token flow)
- [ ] search_tracks returns results from Spotify API
- [ ] create_playlist creates playlist in user's Spotify account
- [ ] add_to_playlist adds tracks to created playlist
- [ ] 30-second previews playable
- [ ] Graceful behavior when Spotify not configured (L2 — shows mock UI)
- [ ] Regression: chess and weather apps unaffected

#### Commit 3.2.1: OAuth flow implementation
- [ ] Create `src/renderer/chatbridge/oauth.ts` — popup OAuth flow with PKCE
- [ ] Token storage/refresh via Supabase user_app_tokens table
- [ ] Write test: OAuth flow generates correct authorize URL with PKCE challenge

#### Commit 3.2.2: Spotify app HTML bundle
- [ ] Create `src/renderer/chatbridge/apps/spotify/index.html`
- [ ] Search UI, track results with preview, playlist builder
- [ ] Bridge integration: handle search_tracks, create_playlist, add_to_playlist

#### Commit 3.2.3: Spotify tools + registry
- [ ] Add Spotify tools to registry with authConfig (OAuth PKCE)
- [ ] Type: external_authenticated
- [ ] On open_app("spotify") → check for valid token → if missing, trigger OAuth → then init app

#### Commit 3.2.4: End-to-end Spotify integration
- [ ] Test: "create a playlist of chill jazz" → OAuth popup → authorize → panel opens → chatbot searches tracks → adds to playlist → playlist created in Spotify account

### PR 3.3: Rubik's Cube stub (disabled)
**Branch:** `sprint-3/rubiks-stub`
**Depends on:** PR 2.1 (registry)
**Existing code touched:** registry config only
**TDD:** no (stub only)

**Verification criteria:**
- [ ] Rubik's Cube in registry with enabled: false
- [ ] Placeholder HTML at apps/rubiks/index.html (just a "Coming Soon" message)
- [ ] open_app enum does NOT include "rubiks"
- [ ] LLM correctly ignores Rubik's Cube in tool routing

#### Commit 3.3.1: Rubik's stub
- [ ] Add disabled registry entry + placeholder HTML
- [ ] Write test: rubiks excluded from open_app tool enum
- [ ] Verify: test passes

**Sprint 3 gate (Chrome browser):**
- [ ] Open tab → log in → type "what's the weather in New York?" → verify: side panel opens with weather dashboard showing NYC weather → type "how about Tokyo?" → verify: weather updates to Tokyo
- [ ] Open tab → type "make me a workout playlist on Spotify" → verify: OAuth popup appears → authorize → verify: side panel shows Spotify app → verify: chatbot searches for workout tracks → verify: playlist created
- [ ] Open tab → type "let's play chess" → play a few moves → type "now show me the weather" → verify: chess panel closes, weather opens → type "go back to my chess game" → verify: chess reopens with previous position restored

---

## Sprint 4: Polish + Error Handling + Deploy

**Objective:** Error handling, UX loading indicators, developer docs, cost analysis, final deployment.

### PR 4.1: Error handling + loading indicators
**Branch:** `sprint-4/error-handling`
**Depends on:** Sprint 3
**Existing code touched:** SidePanel.tsx, generation flow
**Patterns to follow:** Existing error handling in Chatbox
**TDD:** yes

**Verification criteria:**
- [ ] Typing indicator during LLM streaming
- [ ] "Working..." pulsing badge in panel during tool invocation
- [ ] Spinner in panel during iframe load
- [ ] 30s timeout on tool calls — chatbot continues gracefully with error message
- [ ] App crash recovery — panel closes, error context injected
- [ ] OAuth popup blocked — helpful "please allow popups" message shown
- [ ] "Connecting to Spotify..." message during OAuth popup flow
- [ ] Subtle pulse on panel border while waiting for app completion
- [ ] Invalid tool params from LLM — error returned, LLM retries
- [ ] OpenAI API 5xx errors — 1x automatic retry before surfacing error to user
- [ ] Ambiguous routing: "play something" with chess+spotify active → chatbot asks user to clarify
- [ ] Regression: all 3 apps still work correctly

### PR 4.2: Context retention + multi-app
**Branch:** `sprint-4/context-retention`
**Depends on:** Sprint 3
**Existing code touched:** `src/renderer/chatbridge/` context manager
**TDD:** yes

**Verification criteria:**
- [ ] App state stored as app_context message on panel close
- [ ] Chatbot can reference past app interactions ("what happened in our chess game?")
- [ ] Switching between apps preserves each app's state
- [ ] App state injected into system prompt for LLM awareness
- [ ] System prompt includes last-known state of active app
- [ ] Regression: conversation history loads correctly with app_context messages

### PR 4.3: Developer documentation
**Branch:** `sprint-4/dev-docs`
**Depends on:** Sprint 3
**Existing code touched:** none (new file)
**TDD:** no (documentation)

**Verification criteria:**
- [ ] `docs/developer-guide.md` exists with: app registration format, tool schema format, bridge protocol, auth patterns, example walkthrough
- [ ] A developer could read this doc and build a new app without looking at source code

### PR 4.4: Cost analysis + deployment polish
**Branch:** `sprint-4/cost-analysis`
**Depends on:** PR 1.3 (token logging)
**Existing code touched:** none (new files + deploy config)
**TDD:** no (documentation + ops)

**Verification criteria:**
- [ ] `docs/cost-analysis.md` with dev spend, token breakdown, projections at 100/1K/10K/100K users
- [ ] Production Vercel deployment with env vars configured
- [ ] Deployed app publicly accessible with all 3 apps working
- [ ] GitLab mirror pushed and accessible

**Sprint 4 gate (Chrome browser):**
- [ ] Open tab → navigate to production URL → sign up new account → play chess → ask for hint → close game → check weather → create Spotify playlist → verify: all 3 apps work → type "what did we do today?" → verify: chatbot summarizes all app interactions
- [ ] Open tab → type "play something" → verify: chatbot asks for clarification (ambiguous between chess/spotify) → type "chess" → verify: chess opens (testing scenario 6)
- [ ] Open tab → type "what's 2+2?" → verify: chatbot answers without opening any app (testing scenario 7)
- [ ] Open tab → send rapid messages during tool call → verify: no UI freeze → close app mid-operation → verify: graceful recovery → verify: loading indicators visible during all async operations

---

## Dependency Graph

```
Sprint 0: PR 0.1 (tracer bullet) ‖ PR 0.2 (live app exploration, backgrounded)
              │
Sprint 1: PR 1.1 (auth) → PR 1.2 (persistence) → PR 1.3 (token logging)
              │
Sprint 2: PR 2.1 (registry) → PR 2.2 (side panel) ─┐
                               PR 2.3 (tool routing)─┤→ PR 2.4 (chess) → PR 2.5 (context retention)
                                                      │
Sprint 3: PR 3.1 (weather)  ←── PR 2.3 + PR 2.5     │
          PR 3.2 (spotify)   ←── PR 2.3 + PR 2.5     │
          PR 3.3 (rubiks stub) ←── PR 2.1            │
              │
Sprint 4: PR 4.1 (error handling + ambiguous routing) ←── Sprint 3
          PR 4.3 (dev docs) ←── Sprint 3
          PR 4.4 (cost analysis + deploy + GitLab) ←── PR 1.3 + Sprint 3
```

## Parallelization Summary

| Sprint | Parallel PRs | Sequential Dependencies |
|--------|-------------|----------------------|
| 0 | PR 0.1 ‖ PR 0.2 (parallel — 0.2 is backgrounded live exploration) | 0.2 findings may update CLAUDE.md and revise Sprint 1+ |
| 1 | PR 1.1 → 1.2 → 1.3 (sequential chain) | Auth before persistence before logging |
| 2 | PR 2.1 solo, then 2.2 ‖ 2.3 parallel, then 2.4, then 2.5 | Registry first, panel+routing parallel, chess needs both, context needs chess |
| 3 | PR 3.1 ‖ PR 3.2 ‖ PR 3.3 (all parallel) | All depend on Sprint 2 completion but independent of each other |
| 4 | PR 4.1 ‖ PR 4.3 ‖ PR 4.4 (all parallel) | All depend on Sprint 3 but independent of each other |

**Max parallelism:** Sprint 3 (3 simultaneous PRs), Sprint 4 (3 simultaneous PRs)

---

## Task IDs (for parallel-pr-execution)

Tasks will be created by parallel-pr-execution skill at execution time, one per PR, with dependencies matching the graph above.
