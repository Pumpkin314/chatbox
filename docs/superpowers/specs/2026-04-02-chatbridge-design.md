# ChatBridge Design Spec

**Date:** 2026-04-02
**Status:** Draft
**Target:** MVP (Tuesday 2026-04-03), Early Submit (Friday 2026-04-06), Final (Sunday 2026-04-08)
**Platform:** Web build only (`CHATBOX_BUILD_PLATFORM=web`)
**Base:** Fork of Chatbox (Electron/React/Vite AI chat client)

---

## 1. Problem Statement

TutorMeAI needs to expand its AI chatbot from pure conversation to orchestrating third-party apps inside the chat experience. Students should be able to play chess, check weather, create Spotify playlists — all without leaving the chat window. The chatbot must discover app capabilities, invoke tools, render app UI, track app state, and resume conversation when the app completes.

The core engineering challenge is the boundary between chat and third-party app: tool discovery, invocation, UI rendering, completion signaling, and context retention across the full lifecycle.

## 2. Architecture

### 2.1 Overview

Host-Orchestrated (Architecture 1) — all orchestration runs client-side in the React app. No backend orchestration server.

```
Browser
├── Chat UI (React, existing Chatbox)
│   ├── Message stream
│   ├── Input bar
│   └── System prompt injection
├── Side Panel (new)
│   └── App Iframe (sandboxed)
├── Orchestration Layer (new React context)
│   ├── LLM Service (OpenAI calls + token logging)
│   ├── Tool Router (postMessage dispatch)
│   ├── App Lifecycle Manager (mount/unmount/timeout)
│   └── Context Manager (app state in conversation)
└── Supabase Client
    ├── Auth
    ├── Conversations + Messages
    ├── App Registry
    └── Token Usage Log
```

### 2.2 Data Flow

```
1. User sends message
2. Orchestration Layer builds LLM request:
   - Conversation history from Supabase
   - System prompt with active app context (if any)
   - Tools: always `open_app` meta-tool + active app's tools (if panel open)
3. OpenAI streaming response
4. If tool_call detected:
   a. `open_app` → open side panel, load app iframe, inject app tools into next call
   b. App-specific tool → postMessage to iframe → await result → feed back to LLM
5. LLM continues with tool result, generates text response
6. Message + tool results + app state saved to Supabase
7. Token usage logged
```

### 2.3 External Services

| Service | Purpose | CLI/Automation | Human Steps |
|---|---|---|---|
| Supabase | Auth + DB + Realtime | `supabase init`, `supabase db push`, `supabase start` | 1 (create project) |
| OpenAI | LLM + function calling | API key in env | 1 (get key) |
| OpenWeatherMap | Weather data (External Public) | API key in env | 1 (get free key) |
| Spotify | OAuth example | App registered in dashboard | 1 (register + get client ID) |
| Vercel or Railway | Deployment | `vercel deploy` / `railway up` | 1 (link project) |

Total human steps: 5 one-time setup actions.

## 3. Components

### 3.1 App Registry

Static JSON config file at `src/renderer/chatbridge/registry/apps.json` is the **single source of truth for MVP**. The `app_registry` DB table is not used in MVP — it exists in the schema for post-MVP dynamic registration. The JSON file is loaded at app startup into memory. Each entry:

```ts
interface AppRegistration {
  id: string                    // "chess" | "weather" | "spotify"
  name: string                  // Display name
  description: string           // Used in open_app tool description for LLM
  type: "internal" | "external_public" | "external_authenticated"
  tools: ToolSchema[]           // JSON Schema tool definitions
  entrypoint: string            // Path to bundled HTML or URL (post-MVP)
  authConfig: AuthConfig | null // OAuth config for authenticated apps
  enabled: boolean
}

interface ToolSchema {
  name: string
  description: string
  parameters: JSONSchema        // OpenAI function calling format
}

interface AuthConfig {
  provider: string              // "spotify"
  authUrl: string
  tokenUrl: string
  clientId: string              // From env var
  scopes: string[]
  pkce: boolean
}
```

### 3.2 Meta-Tool: `open_app`

Single tool always present in LLM context. Lists all enabled apps from registry.

```ts
{
  name: "open_app",
  description: "Open a third-party app in the side panel. Available apps: Chess (play chess games), Weather (check weather for any city), Spotify (create playlists). Call this before using any app-specific tools.",
  parameters: {
    type: "object",
    properties: {
      app_id: {
        type: "string",
        enum: ["chess", "weather", "spotify"],
        description: "The app to open"
      }
    },
    required: ["app_id"]
  }
}
```

When invoked: side panel opens, iframe loads app entrypoint, app-specific tools injected into subsequent LLM calls.

### 3.3 Dynamic Tool Scoping

```
No app active:    LLM sees [open_app] only
Chess active:     LLM sees [open_app, start_game, make_move, get_board, get_hint, resign]
Weather active:   LLM sees [open_app, get_weather, get_forecast]
Spotify active:   LLM sees [open_app, search_tracks, create_playlist, add_to_playlist]
App closed:       LLM sees [open_app] only (tools removed)
```

Active app's tools are resolved from the registry at panel-open time. Removed at panel-close.

### 3.4 App Bridge Protocol

JavaScript file (`chatbridge-bridge.js`) injected into every app iframe. Defines the postMessage contract.

**Message envelope:**

```ts
interface BridgeMessage {
  id: string              // UUID v4
  type: "tool_invoke" | "tool_result" | "app_complete" | "state_update" | "app_init" | "error"
  method?: string         // Tool name (for tool_invoke)
  params?: object         // Tool parameters (for tool_invoke)
  status?: "success" | "error"  // For results
  result?: object         // Structured result data
  state?: object          // Serialized app state
  error?: string          // Error message
}
```

**Lifecycle:**

```
1. Host mounts iframe with app HTML
2. Host sends { type: "app_init", params: { appId, userId, theme, existingState? } }
3. App initializes, sends { type: "state_update", state: { ... } }
4. Host sends tool invocations as needed: { type: "tool_invoke", method: "make_move", params: { ... } }
5. App processes, sends: { type: "tool_result", status: "success", result: { ... } }
6. When done, app sends: { type: "app_complete", result: { summary: "..." } }
7. Host removes iframe, stores final state in conversation
```

**Timeout:** 30 seconds per tool invocation. On timeout, host injects error context and LLM continues conversationally.

**Origin validation:** Both sides validate `event.origin` on every postMessage.

**Acknowledgment & retry:** Every `tool_invoke` message expects a `tool_result` response with matching UUID within 30s. If no response in 5s, host sends one retry with the same UUID. If still no response by 30s, host treats it as a timeout error. App-side bridge ignores duplicate UUIDs (idempotent). Rapid-fire messages (e.g., fast chess moves) are queued and processed sequentially by the app.

### 3.5 Side Panel UI

New React component mounted alongside existing Chatbox chat area.

```
┌─────────────────────────────────────┬──────────────────┐
│           Chat Area (flex: 1)       │  Side Panel      │
│                                     │  (380px, cond.)  │
│  [message stream]                   │  ┌──────────────┐│
│                                     │  │ Header       ││
│                                     │  │ App Name  ✕  ││
│                                     │  ├──────────────┤│
│                                     │  │              ││
│                                     │  │  App Iframe  ││
│                                     │  │  (sandboxed) ││
│                                     │  │              ││
│                                     │  ├──────────────┤│
│                                     │  │ Status bar   ││
│  [input bar]                        │  └──────────────┘│
└─────────────────────────────────────┴──────────────────┘
```

- Panel visibility toggled by `open_app` / close button / `app_complete`
- One app at a time. Switching serializes previous app state to conversation.
- Iframe sandbox: `sandbox="allow-scripts allow-forms"` (NO `allow-same-origin`)
- Close button triggers `app_complete` flow — stores final state, removes tools from LLM context

**Post-MVP stub:** Panel component accepts a `displayMode` prop (`"panel" | "inline" | "expanded"`) defaulting to `"panel"`. Inline and expanded modes are no-ops for now.

### 3.6 LLM Service

Wraps OpenAI API calls. Responsibilities:

- Build messages array from conversation history
- Inject system prompt with app context
- Inject tools (open_app + active app tools)
- Stream response chunks to Chat UI
- Detect and extract tool_calls from stream
- Log token usage to Supabase after each call
- Handle errors and retries (1x retry on 5xx)

**System prompt injection format:**

```
You are ChatBridge, an AI assistant that can open and interact with third-party apps.

[If app active:]
Currently active app: Chess
Current app state: FEN: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1
The user is playing as White. It is Black's turn (move 1).
Use the chess tools to interact with the game when the user asks about it.

[If no app active:]
No app is currently active. Use open_app to launch an app when the user requests one.
```

**Token logging:** After each OpenAI response, extract `usage.prompt_tokens`, `usage.completion_tokens`, `model` and insert into `token_usage_log` table.

**Post-MVP stub:** LLM Service exposes a `provider` config field. MVP hardcodes OpenAI. Post-MVP swaps in Anthropic or other providers via Chatbox's existing multi-provider support.

### 3.7 Context Manager

Maintains running app state in conversation context.

- On `state_update` from app → update in-memory state, persist to current message's `app_state` field
- On `app_complete` → store final state as an `app_context` message in conversation
- On new LLM call → inject last-known app state into system prompt
- On app reopen → pass `existingState` to app via `app_init` message

This ensures the LLM can reference app state ("your chess position was...") and apps can resume from previous state.

### 3.8 Auth Flows

**Internal (Chess, Weather API key):** No user auth needed. Weather API key stored in env var, passed to app via `app_init` params.

**External Authenticated (Spotify):**

```
1. User says "create a playlist"
2. LLM calls open_app({ app_id: "spotify" })
3. Host checks user_app_tokens for existing valid token
4. If no token: Host opens popup window → Spotify /authorize (PKCE)
5. User authorizes in popup
6. Popup redirects to host callback URL
7. Host exchanges code for tokens, stores in Supabase user_app_tokens
8. Host sends app_init to iframe with access_token in params
9. App uses token for Spotify API calls
```

Token refresh: MVP implements silent refresh using stored `refresh_token`. Before each `app_init`, check `expires_at`. If expired or within 5 minutes of expiry, call Spotify's `/api/token` with `grant_type=refresh_token` to get a new access token. Update `user_app_tokens` row. Only re-trigger full OAuth popup if refresh fails (e.g., token revoked).

## 4. Database Schema

```sql
-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'app_context')),
  content TEXT,
  tool_call JSONB,
  app_state JSONB,
  token_usage JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- App Registry (seeded, not user-managed in MVP)
CREATE TABLE app_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('internal', 'external_public', 'external_authenticated')),
  tools JSONB NOT NULL DEFAULT '[]',
  entrypoint TEXT NOT NULL,
  auth_config JSONB,
  enabled BOOLEAN DEFAULT true
);

-- Token Usage Log
CREATE TABLE token_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  conversation_id UUID REFERENCES conversations,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  estimated_cost NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_token_usage_user ON token_usage_log(user_id, created_at);

-- OAuth Tokens
CREATE TABLE user_app_tokens (
  user_id UUID REFERENCES auth.users NOT NULL,
  app_id TEXT REFERENCES app_registry NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);

-- Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own messages" ON messages
  FOR ALL USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users see own token usage" ON token_usage_log
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own tokens" ON user_app_tokens
  FOR ALL USING (auth.uid() = user_id);
```

## 5. Apps

### 5.1 Chess (Internal, No Auth)

- **Libraries:** chess.js (logic/validation), chessboard.js (rendering)
- **Bundled as:** `apps/chess/index.html` (self-contained, inline JS/CSS/assets)
- **LLM state format:** FEN notation + move history in algebraic notation
- **Tools:**
  - `start_game` — initialize board, returns starting FEN
  - `make_move({ from, to })` — validate and execute move, returns new FEN + move result
  - `get_board` — returns current FEN + legal moves
  - `get_hint` — returns current FEN for LLM to analyze and suggest
  - `resign` — end game, return summary

### 5.2 Weather Dashboard (External Public, API Key)

- **API:** OpenWeatherMap free tier (or similar)
- **Bundled as:** `apps/weather/index.html`
- **Auth:** API key passed via `app_init` params (key stored in env var on host)
- **Tools:**
  - `get_weather({ city })` — current conditions, returns temp/humidity/description
  - `get_forecast({ city, days })` — multi-day forecast
- **UI:** Simple card layout showing conditions, temperature, icon

### 5.3 Spotify Playlist Creator (External Authenticated, OAuth 2.0)

- **API:** Spotify Web API (search, create playlist, add tracks)
- **Bundled as:** `apps/spotify/index.html`
- **Auth:** OAuth 2.0 PKCE via host popup. Token passed via `app_init`.
- **Tools:**
  - `search_tracks({ query })` — search Spotify, returns track list
  - `create_playlist({ name, description })` — create playlist in user's account
  - `add_to_playlist({ playlist_id, track_uris })` — add tracks to playlist
- **UI:** Search bar, track results with 30-second preview, playlist builder
- **Limitation:** No Web Playback SDK in iframe. Preview URLs only.

### 5.4 Rubik's Cube (Stubbed for Post-MVP)

- Registry entry with `enabled: false`
- Placeholder entrypoint at `apps/rubiks/index.html`
- See `docs/chatbridge_post_mvp.md` for full plan

## 6. Iframe Sandboxing & Security

- Sandbox attributes: `sandbox="allow-scripts allow-forms"` — NO `allow-same-origin`
- All apps served as `srcdoc` (bundled HTML string) or from separate origin
- postMessage origin validated on both host and app side
- Apps cannot access: parent DOM, localStorage, cookies, IndexedDB of host
- CSP on host page prevents inline script injection from app content
- OAuth tokens never stored in iframe — passed via postMessage, held in memory only
- API keys for External Public apps passed via `app_init`, not embedded in app HTML

## 7. Error Handling

| Scenario | Behavior |
|---|---|
| App iframe fails to load | Error message in panel, chatbot says "app couldn't load" |
| Tool invocation timeout (30s) | Close panel, inject error context, chatbot continues |
| Invalid tool parameters from LLM | App returns error via bridge, LLM retries with correction |
| OAuth popup blocked | Show "please allow popups" message in panel |
| OAuth token expired | Re-trigger OAuth flow on next app open |
| OpenAI API error | Retry 1x on 5xx, then surface error to user |
| App crashes (no heartbeat) | 30s timeout catches it, same as tool timeout |
| User closes panel mid-interaction | Serialize last-known state, store as app_context message |

## 8. Testing Strategy

### Per-Sprint (Mandatory)
- **Chrome MCP E2E tests** against the brief's 7 testing scenarios:
  1. Tool discovery and invocation
  2. App UI renders correctly in side panel
  3. Completion signaling — app done, chatbot resumes
  4. Context retention — chatbot references app results
  5. Multi-app switching in same conversation
  6. Ambiguous routing — chatbot asks for clarification
  7. Refusal — chatbot ignores apps for unrelated queries
- Run after each sprint gate, and for major PRs

### Per-PR
- Unit tests for bridge protocol (message envelope, UUID correlation, timeout)
- Unit tests for tool router (registry lookup, dynamic scoping)
- Unit tests for context manager (state serialization, injection)

### Post-MVP
- Playwright E2E suite mirroring Chrome MCP tests
- Mock app fixtures for automated integration testing
- Load testing concurrent app sessions

## 9. Risks & Mitigations

Full risk register with verification criteria: `docs/chatbridge_risks.md`

Top risks for MVP:
- **R1 Token bloat** — mitigated by `open_app` + dynamic scoping
- **R2 App state persistence** — mitigated by `app_state` field in messages + `app_context` message type
- **R3 Completion signaling** — mitigated by explicit protocol + 30s timeout
- **R4 OAuth in web** — mitigated by host popup approach
- **R8 No Electron APIs** — mitigated by web-only target, browser equivalents

## 10. Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Platform | Web build only | PRD requires publicly accessible deployment |
| LLM Provider | OpenAI (MVP), configurable | Most mature function calling |
| Backend | Supabase | Fastest path to auth + DB, CLI-automated |
| Architecture | Host-Orchestrated (client-side) | Simplest, matches existing Chatbox patterns |
| App Rendering | Side panel | Persistent, spacious, doesn't disrupt chat |
| App Hosting | Bundled HTML (MVP) | Reliable for demo, URL-loaded stubs for post-MVP |
| Communication | postMessage with UUID envelopes | Proven in existing Artifact component |
| Tool Strategy | open_app meta-tool + dynamic scoping | Minimal token overhead, clean lifecycle |
| Tool Format | OpenAI function calling JSON Schema | Direct compatibility, no translation layer |
| Apps | Chess + Weather + Spotify | Covers all 3 auth patterns |

## 11. AI Cost Analysis Plan

**Dev spend tracking:** `token_usage_log` table captures every LLM call with model, prompt/completion tokens, and estimated cost. Aggregation query for the deliverable:

```sql
SELECT model,
       COUNT(*) as total_calls,
       SUM(prompt_tokens) as total_prompt,
       SUM(completion_tokens) as total_completion,
       SUM(estimated_cost) as total_cost
FROM token_usage_log
GROUP BY model;
```

**Production projections:** Based on observed averages from dev/testing:
- Average tokens per message (with/without tool calls)
- Average tool invocations per session
- Average sessions per user per month
- Scale linearly to 100 / 1K / 10K / 100K users
- Include Supabase costs (DB rows, auth, realtime connections) at each tier

Deliverable format: markdown table in the repo + section in the demo video.

## 12. Developer Documentation (MVP)

MVP API docs in `docs/developer-guide.md` covering:
- **App registration format** — JSON schema for `AppRegistration` interface
- **Tool schema format** — OpenAI-compatible function calling JSON Schema
- **Bridge protocol** — message envelope types, lifecycle events, postMessage contract
- **Auth patterns** — how each auth type (internal, external_public, external_authenticated) works
- **Example app** — annotated walkthrough of the Weather app as the simplest reference implementation

Post-MVP: full developer portal, published npm SDK, app template generator CLI.

## 13. UX Loading Indicators

The PRD warns against missing progress indicators. MVP implements:

| State | Indicator |
|---|---|
| LLM streaming | Typing indicator + streamed text chunks |
| Tool invocation in progress | Pulsing "Working..." badge in side panel header |
| App iframe loading | Skeleton/spinner in side panel body |
| OAuth popup flow | "Connecting to Spotify..." message in panel |
| App processing tool call | Spinner overlay on app iframe |
| Waiting for app completion | Subtle pulse on panel border |

## 14. Post-MVP

See `docs/chatbridge_post_mvp.md` for full continuation plan including:
- Inline + expand rendering (Option C)
- Rubik's Cube app
- URL-loaded external apps
- Server-side orchestration evolution
- Langfuse/Langchain tracing
- Embedding-based tool relevance scoring
- Developer SDK and documentation portal

## 15. Related Documents

- `docs/chatbridge_brief.md` — Original PRD
- `docs/chatbridge_risks.md` — Risk register with verification criteria
- `docs/chatbridge_post_mvp.md` — Post-MVP continuation plan
- `docs/mockups/layout-comparison.html` — Visual mockup of layout options
