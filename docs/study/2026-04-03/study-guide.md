# ChatBridge Demo-Prep Study Guide

**Generated:** 2026-04-03
**Codebase:** `/Users/Rajiv/Documents/Gauntlet/week_7/chatbox`
**Branch:** `main` (50+ commits ahead of upstream Chatbox fork)

---

## 1. Executive Summary

ChatBridge is an AI chat platform built for K-12 education that lets third-party apps live inside the conversation. Built as a fork of Chatbox (an open-source Electron/React chat client), it adds a plugin architecture where apps like Chess, Weather, and Spotify register tools the AI can discover and invoke, render their UI in a sandboxed side panel, and communicate bidirectionally with the chatbot via a postMessage bridge protocol. Students can say "let's play chess," see a board appear, ask "what should I do?" mid-game, and have the AI analyze the position -- all without leaving the chat window. The platform handles three auth patterns (internal, API-key, OAuth2 PKCE), persists conversations to Supabase, and deploys as a static web app to Railway.

---

## 2. Architecture Overview

```mermaid
graph TB
    subgraph Browser["Browser (React SPA)"]
        UI[Chat UI<br/>React + Jotai + Mantine]
        SP[SidePanel<br/>380px fixed-position]
        IF[App Iframe<br/>sandbox=allow-scripts allow-forms]
        
        subgraph Orchestration["ChatBridge Orchestration Layer"]
            LLM[LLM Service<br/>Vercel AI SDK + streamText]
            TR[Tool Router<br/>open_app / close_app / app tools]
            TB[Tool Builder<br/>Registry -> Vercel AI SDK tool()]
            CM[Context Manager<br/>App state in conversation]
            AL[App Lifecycle<br/>Mount / unmount / timeout]
            SP2[System Prompt<br/>Active app context injection]
        end
        
        REG[App Registry<br/>apps.json static config]
        BR[Bridge<br/>postMessage + UUID correlation]
        SDK[Bridge SDK<br/>ChatBridge.onToolCall etc.]
    end
    
    subgraph External["External Services"]
        OAI[OpenAI API<br/>GPT-4o / GPT-4o-mini]
        SB[Supabase<br/>Auth + PostgreSQL + RLS]
        OWM[OpenWeatherMap API]
        SPOT[Spotify Web API]
    end
    
    subgraph Deploy["Deployment"]
        RW[Railway<br/>Static SPA hosting]
    end

    UI -->|user message| LLM
    LLM -->|streaming response| UI
    LLM -->|tool_call| TR
    TR -->|open_app| AL
    TR -->|app tool| BR
    BR -->|postMessage| IF
    IF -->|tool_result| BR
    BR -->|result| TR
    TR -->|feed back| LLM
    AL -->|mount iframe| SP
    SP --> IF
    IF --> SDK
    TB -->|build ToolSet| LLM
    REG -->|app definitions| TB
    CM -->|state| SP2
    SP2 -->|system prompt| LLM
    LLM -->|API call| OAI
    UI -->|auth + CRUD| SB
    TR -->|weather proxy| OWM
    IF -->|Spotify API| SPOT
    Browser -->|deploy| RW
```

### Data Flow (numbered steps)

```
1. User types message in Chat UI
2. generation.ts calls streamText() with:
   - Conversation history (from Supabase or local)
   - System prompt (with active app context from system-prompt.ts)
   - Tools (from tool-builder.ts: open_app + active app tools)
3. OpenAI returns streaming response via Vercel AI SDK
4. If tool_call detected:
   a. open_app -> app-lifecycle.ts opens SidePanel, loads iframe, injects app tools
   b. App-specific tool -> tool-router.ts sends postMessage to iframe via bridge.ts
   c. Weather tools -> host-side API proxy in tool-router.ts (bypasses iframe sandbox)
5. Iframe processes tool call via bridge-sdk.js, returns tool_result
6. tool-router feeds result back to LLM for continuation (maxSteps: 5)
7. Messages + app state saved to Supabase
8. Token usage logged to token_usage_log table
```

---

## 3. Running and Deploying

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase CLI (`npx supabase`)
- A Supabase project (ref: `tmiwxelndsfcwmybsckj`)

### Environment Variables

Create `.env` in project root:

```bash
VITE_SUPABASE_URL=https://tmiwxelndsfcwmybsckj.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_OPENAI_API_KEY=<optional -- can also set in Settings UI>
VITE_WEATHER_API_KEY=<openweathermap-free-key>
VITE_SPOTIFY_CLIENT_ID=<spotify-app-client-id>
```

### Local Development

```bash
# Install dependencies
pnpm install

# Build the web version (IMPORTANT: dev:web runs Electron, not true web)
pnpm build:web

# Serve locally (SPA with proper routing)
pnpm serve:web
# -> http://localhost:3000

# Run tests
pnpm test
# Expect: ~730 passed, ~84 skipped, 7 pre-existing failures
```

### Deploying to Railway

```bash
# Railway expects a static SPA
# 1. Build
pnpm build:web
# Output: release/app/dist/renderer/

# 2. Deploy (Railway CLI or dashboard)
railway up

# 3. Set env vars in Railway dashboard:
#    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

### Supabase Setup

```bash
# Link to existing project
npx supabase link --project-ref tmiwxelndsfcwmybsckj

# Push schema (5 tables: conversations, messages, app_registry, token_usage_log, user_app_tokens)
npx supabase db push

# Test user: test@chatbridge.dev / TestPass123!
```

### Key Commands Reference

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all dependencies |
| `pnpm build:web` | Build static SPA for web deployment |
| `pnpm serve:web` | Serve built SPA locally (uses `npx serve`) |
| `pnpm dev:web` | Dev mode -- WARNING: runs in Electron, not true WebPlatform |
| `pnpm test` | Run all Vitest tests |
| `pnpm test:coverage` | Tests with coverage report |
| `pnpm lint` | Biome linter |

---

## 4. Design Decisions (Q&A)

### Q1: Why fork Chatbox instead of building from scratch?

**A:** Chatbox gives us a production-quality chat UI, streaming response rendering, 15+ AI provider integrations via Vercel AI SDK, Jotai state management, and Vite build tooling -- all for free. Building from scratch would have taken 2-3 days just to reach feature parity on basic chat. The fork lets us focus the entire week on the hard problem: third-party app integration. The tradeoff is dealing with Electron-first assumptions in the codebase (platform abstraction, build system quirks).

### Q2: Why iframe sandbox for apps instead of React components?

**A:** Security in a K-12 context. Iframes with `sandbox="allow-scripts allow-forms"` (no `allow-same-origin`) create a hard security boundary -- third-party app code cannot access the parent DOM, localStorage, cookies, or any host resources. React components would run in the same execution context as the host, meaning a malicious or buggy app could steal tokens, read chat history, or crash the entire application. The tradeoff is more complex communication (postMessage protocol) and no shared state.

### Q3: Why Supabase over Firebase?

**A:** Three reasons: (1) Supabase is PostgreSQL under the hood, giving us full SQL with row-level security (RLS) policies that Firebase's NoSQL rules can't match. (2) The CLI automation is superior -- `supabase init`, `supabase db push`, migrations as SQL files. (3) The free tier is generous enough for our scale (50K MAU, unlimited API requests). Firebase would work but its security rules language is harder to audit and its client SDK is heavier.

### Q4: Why OpenAI as the default LLM provider?

**A:** OpenAI has the most mature function calling implementation, which is the core of our tool invocation system. The `tool_choice` parameter, structured JSON Schema tool definitions, and multi-step tool call chains all work reliably. The LLM Service is designed with a `provider` config field so post-MVP can swap in Anthropic or others via Chatbox's existing multi-provider support (`@ai-sdk/anthropic`, `@ai-sdk/google`, etc. are already installed).

### Q5: Why a static tool set instead of dynamic per-step tool resolution?

**A:** The tool set changes only when an app opens or closes, not between individual LLM steps. The tool-builder reads the registry once at call time, checks `activeAppAtom`, and builds the appropriate ToolSet. This is simpler and more predictable than dynamically resolving tools between each step of a multi-step chain. The LLM sees a consistent tool list within a single generation, which reduces confusion and hallucinated tool calls.

### Q6: Why host-side API proxy for weather instead of letting the iframe call APIs?

**A:** The iframe sandbox blocks `fetch` to external origins because `allow-same-origin` is disabled. Even if we enabled it, the API key would need to be inside the iframe, exposed to third-party code. Instead, `tool-router.ts` intercepts weather tool calls and executes the fetch on the host side, where the API key is safely in an environment variable. The iframe only receives the result data via postMessage. This pattern works for any External Public app.

### Q7: Why did we hit a bug with Zod 4 inputSchema vs parameters?

**A:** The Vercel AI SDK's `tool()` function expects an `inputSchema` using Zod 4's `~standard` protocol, not a raw JSON Schema `parameters` object. Our registry stores tools as OpenAI-format JSON Schema (with `parameters`), but `tool-builder.ts` needs to convert these to Zod schemas via `z.object()` for the AI SDK. The bug was that `~standard.jsonSchema` on Zod 4 schemas produced empty objects when built programmatically. The fix was to use `jsonSchema()` from `@ai-sdk/provider` to wrap the raw JSON Schema directly, bypassing Zod entirely.

### Q8: Why maxSteps: 5?

**A:** This limits the LLM to 5 tool call rounds per user message. A typical flow is: (1) open_app, (2) app tool call, (3) maybe another tool call, (4) final text response. Five steps gives enough room for the LLM to open an app and make a couple of tool calls while preventing infinite loops if the LLM keeps calling tools without producing a text response. Higher values increase cost and latency; lower values risk truncating legitimate multi-tool workflows.

### Q9: Why are all tools always included (open_app + active app tools)?

**A:** They aren't all always included -- that is the point of dynamic scoping. When no app is active, the LLM sees only `open_app`. When Chess is active, it sees `open_app` plus the 5 chess tools. When the panel closes, chess tools are removed. This keeps the token overhead minimal (~100 tokens for `open_app` alone, ~300-500 with an active app). The `open_app` tool is always present so the LLM can switch apps at any time.

### Q10: Why Railway over Vercel for deployment?

**A:** Both work for a static SPA. Railway was chosen because it offers a simple `railway up` deploy with persistent environment variables and no serverless cold starts. Vercel's free tier would also work (and is recommended in the cost analysis for production). The choice is mostly a preference -- either platform serves the static `release/app/dist/renderer/` output correctly.

### Q11: Why postMessage with UUID envelopes instead of a simpler event system?

**A:** postMessage is fire-and-forget with no built-in request-response correlation. The UUID envelope pattern (`{ id, type, payload, timestamp }`) gives us: (1) request-response pairing (host sends `tool_call` with id X, app replies with `tool_call_result` with id X), (2) timeout detection (30s per message), (3) retry with deduplication (app ignores duplicate UUIDs), (4) audit trail. This pattern was inspired by Chatbox's existing Artifact.tsx iframe but extended from one-way to bidirectional.

### Q12: Why store app state in conversation messages instead of a separate store?

**A:** Keeping app state in the message stream (as `app_context` messages and `app_state` JSONB fields) means the LLM naturally sees it in conversation history. When a user says "what happened in our chess game?", the context manager injects the last-known state into the system prompt. A separate store would require explicit hydration logic and risk state getting out of sync with the conversation timeline.

### Q13: Why three specific apps (Chess, Weather, Spotify)?

**A:** They demonstrate all three auth patterns required by the brief: (1) Chess is internal (no auth, self-contained), (2) Weather is external-public (API key, host-side proxy), (3) Spotify is external-authenticated (OAuth2 PKCE, user authorization). They also cover different complexity levels: Chess has complex bidirectional state, Weather is simple request-response, Spotify involves multi-step workflows (search, create, add).

### Q14: Why client-side orchestration instead of server-side?

**A:** Chatbox is a client-side app -- all LLM calls already happen from the browser via direct API calls. Adding a server-side orchestration layer would mean building a new backend, handling WebSocket connections for real-time updates, and managing API keys server-side. Client-side orchestration matches the existing architecture and ships faster. The tradeoff is that API keys are in the client (mitigated by Supabase RLS and env vars at build time). Post-MVP plans include moving to Supabase Edge Functions for server-side orchestration.

### Q15: Why Mantine for new components instead of MUI?

**A:** The codebase uses both MUI (older code) and Mantine (newer code). The components/CLAUDE.md explicitly states "new components should use Mantine." Mantine has better TypeScript support, smaller bundle size, and a more modern API. The SidePanel, LoginPage, and AuthGuard all use Mantine components.

### Q16: Why the `open_app` meta-tool pattern instead of exposing all app tools directly?

**A:** Without `open_app`, the LLM would need all tools from all apps in every call -- causing token bloat (Risk R1). The meta-tool pattern creates a two-phase flow: (1) LLM calls `open_app` to select an app, (2) app-specific tools are injected for subsequent calls. This keeps the baseline overhead to ~100 tokens regardless of how many apps are registered. It also gives the orchestration layer a clear lifecycle event (app opened) to mount the iframe and prepare the bridge.

### Q17: Why `npx serve` for local testing instead of `pnpm dev:web`?

**A:** `pnpm dev:web` runs `electron-vite dev` with `CHATBOX_BUILD_PLATFORM=web`, but it still launches inside Electron. This means `window.electronAPI` exists and the DesktopPlatform activates instead of WebPlatform. For true web behavior (Supabase auth, browser storage, no Electron APIs), you must build first (`pnpm build:web`) and serve the static output (`pnpm serve:web` / `npx serve`). This is a critical gotcha for testing.

---

## 5. Honest Assessment

### What Works Well

- **Architecture is sound.** The meta-tool + dynamic scoping + postMessage bridge pattern cleanly separates concerns and scales to many apps.
- **Security model is strong.** Iframe sandbox with no `allow-same-origin` is the correct choice for K-12.
- **Test coverage is solid.** 730+ tests pass, all ChatBridge modules have dedicated test suites (bridge, tool-builder, tool-router, context-manager, system-prompt, weather, spotify).
- **Cost model is attractive.** GPT-4o-mini at ~$2/month per classroom makes this viable for schools.

### Known Tech Debt

1. **Bridge not fully wired.** `tool-router.ts` exports `setBridgeRef()` and `setStoreRef()` that must be called during initialization, but the wiring in `__root.tsx` may be incomplete. App-specific tool calls could return "Bridge not available" errors in the live app.
2. **Circular dependency.** `app-lifecycle.ts` imports from `context-manager.ts` and vice versa. Works because imports are types/atoms only, but it is fragile.
3. **No CI/CD.** Everything is manual -- `pnpm build:web`, `railway up`, manual test gates. Pre-existing from the Chatbox fork.
4. **Pre-existing test failures.** 7 tests fail that existed before our changes (migration, settings persistence, token estimation). We left them alone.
5. **Iframe entrypoint resolution untested in production build.** The registry uses relative paths like `./apps/chess/index.html` -- whether these resolve correctly in the Vite-built output has not been verified end-to-end.
6. **OAuth flow for Spotify not E2E tested.** The `oauth.ts` module exists but the full popup flow has not been verified in a browser.

### What We Would Improve

- Move LLM calls to Supabase Edge Functions (API keys out of client)
- Add Playwright E2E tests replacing manual Chrome MCP gates
- Implement streaming tool results and progress indicators (currently tool calls block until complete)
- Add conversation compaction to manage context window growth over long sessions
- Build a proper developer portal with `@chatbridge/bridge-sdk` on npm

---

## 6. Gotchas

### Zod 4 `~standard.jsonSchema` Produces Empty Objects

When building Zod schemas programmatically (e.g., `z.object({ city: z.string() })`), the `~standard` protocol's `jsonSchema` getter can return `{}` instead of the expected JSON Schema. **Fix:** Use `jsonSchema()` from `@ai-sdk/provider` to wrap raw JSON Schema objects directly, bypassing Zod schema construction entirely.

### `appStateAtom` Type Mismatch

The `appStateAtom` in `app-lifecycle.ts` stores state as a generic object, but context-manager expects a specific shape. Ensure you always read state through `context-manager.ts` APIs, not directly from the atom.

### `pnpm dev:web` Runs Electron, Not WebPlatform

This is the single most confusing aspect of the dev workflow. `pnpm dev:web` sets `CHATBOX_BUILD_PLATFORM=web` but still boots Electron, so `window.electronAPI` exists and `DesktopPlatform` activates. For true web testing: `pnpm build:web && pnpm serve:web`.

### `serve` Does Not Handle SPA Routing

`npx serve ./release/app/dist/renderer` serves static files but returns 404 for client-side routes. Use `npx serve -s ./release/app/dist/renderer` (the `-s` flag enables SPA mode, rewriting all routes to `index.html`).

### Merge Conflict Pattern

Every worktree agent recreated `app-lifecycle.ts`, `registry/index.ts`, and `tools.ts` from scratch during parallel development. Resolution was always: keep main's canonical version, take only new files from branches.

### Weather API Proxy Runs on Host

Weather tool calls (`get_weather`, `get_forecast`) do NOT go through the iframe. The `tool-router.ts` intercepts them and makes `fetch()` calls directly from the host, then returns mock data if the API key is missing or the call fails. This is intentional -- the iframe sandbox blocks external fetch.

### `delete-source-maps-runner.js` Was Missing

The `pnpm build:web` script references `.erb/scripts/delete-source-maps-runner.js` which did not exist in the fork. It was created during Session 2 to fix the build. If the build breaks with "cannot find delete-source-maps-runner," check that this file exists.

### Test User Already Confirmed

The Supabase test user `test@chatbridge.dev` / `TestPass123!` has been email-confirmed via the Supabase admin API. No confirmation email needed.

---

## 7. Directory Structure

```
src/renderer/chatbridge/           # ChatBridge orchestration layer
  index.ts                         # Barrel exports
  supabase.ts                      # Supabase client singleton
  auth.ts                          # Auth atoms + signIn/signUp/signOut
  storage.ts                       # Supabase CRUD for conversations/messages
  chatStoreSupabase.ts             # Bridge between chatStore and Supabase
  messagePersistence.ts            # Fire-and-forget message saving
  token-logger.ts                  # Token usage logging + cost estimation
  app-lifecycle.ts                 # Active app atom, mount/unmount handlers
  bridge.ts                        # Host-side postMessage bridge (UUID correlation, 30s timeout)
  bridge-sdk.js                    # Iframe-side SDK (ChatBridge.onToolCall, sendStateUpdate)
  tool-builder.ts                  # Converts registry ToolSchema -> Vercel AI SDK tool()
  tool-router.ts                   # Routes open_app/close_app/app tools + weather API proxy
  tools.ts                         # getChatBridgeTools() for dynamic scoping
  context-manager.ts               # App state history tracking
  system-prompt.ts                 # ChatBridge context injection for LLM
  registry/
    apps.json                      # Static app registry (Chess, Weather, Spotify, Rubiks)
    index.ts                       # Registry loader + open_app tool generator
  apps/
    chess/index.html               # 1466-line self-contained chess app (chess.js + board)
    weather/index.html             # Weather dashboard with mock data for 10 cities
    spotify/index.html             # Spotify playlist creator (mock tracks)
    rubiks/index.html              # Placeholder "Coming Soon"
  __tests__/                       # Vitest tests for all modules

src/renderer/components/
  chatbridge/
    SidePanel.tsx                   # 380px fixed panel with iframe, status footer
    __tests__/SidePanel.test.tsx
  auth/
    LoginPage.tsx                   # Login/signup form (Mantine)
    AuthGuard.tsx                   # Route guard (redirect if unauthenticated)

src/renderer/routes/__root.tsx     # Modified: SidePanel wiring, activeAppAtom, RTL padding
src/renderer/packages/model-calls/
  stream-text.ts                   # Modified: token logging, ChatBridge tool injection
  tools.ts                         # Modified: ChatBridge tool provider integration

docs/
  chatbridge_brief.md              # Original PRD / case study
  chatbridge_risks.md              # 11 risks with verification criteria
  chatbridge_post_mvp.md           # Post-MVP continuation plan
  cost-analysis.md                 # Token costs, Supabase costs, scaling projections
  developer-guide.md               # 552-line guide for building apps
  superpowers/specs/               # Design spec
  superpowers/plans/               # Implementation + continuation plans

supabase/migrations/               # SQL migrations (5 tables + RLS)
.env.example                       # Required environment variables
```

---

## 8. Tech Stack Inventory

| Dependency | Category | Why |
|-----------|----------|-----|
| **React** | UI Framework | Chatbox's existing framework; component model for SidePanel, LoginPage |
| **Vite (electron-vite)** | Build Tool | Chatbox's existing bundler; `pnpm build:web` produces static SPA |
| **Jotai** | State Management | Chatbox's existing atom-based state; `activeAppAtom`, `appStateAtom`, auth atoms |
| **Vercel AI SDK** | LLM Integration | `streamText()` with tool support, streaming, multi-provider abstraction |
| **@ai-sdk/openai** | LLM Provider | OpenAI function calling -- most mature tool call implementation |
| **@ai-sdk/provider** | Schema Utilities | `jsonSchema()` wrapper to bypass Zod 4 issues |
| **@supabase/supabase-js** | Backend | Auth (email/password), PostgreSQL (conversations, messages), RLS |
| **Mantine** | UI Components | New ChatBridge components (LoginPage, SidePanel, AuthGuard) |
| **MUI** | UI Components (Legacy) | Existing Chatbox components; not used for new code |
| **TanStack React-Query** | Data Fetching | Chatbox's existing caching layer for session data |
| **TanStack React-Router** | Routing | Client-side routing with route guards (AuthGuard) |
| **Vitest** | Testing | 730+ tests, co-located test files, mock factories |
| **Biome** | Linting/Formatting | Replaces ESLint + Prettier in the Chatbox fork |
| **chess.js** | Chess Logic | Move validation, FEN notation, legal move generation (bundled inline in app) |
| **TypeScript** | Language | Strict mode, Zod for runtime validation |
| **Tailwind CSS** | Styling | Utility classes (existing); combined with Mantine/MUI |
| **localforage** | Local Storage | IndexedDB wrapper for web platform fallback storage |
| **Zod 4** | Schema Validation | Runtime type checking; `~standard` protocol for AI SDK integration |
| **Supabase CLI** | Dev Tooling | `supabase init`, `supabase db push`, migrations |
| **Railway** | Deployment | Static SPA hosting with env var management |
| **serve (npx)** | Local Serving | `pnpm serve:web` for local testing of production build |
| **cross-env** | Build Scripts | Cross-platform env var setting for `CHATBOX_BUILD_PLATFORM=web` |
| **Husky** | Git Hooks | Pre-commit hooks (inherited from Chatbox) |
