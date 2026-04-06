# Plan 2 Context: Lessons from Plan 1

Fill into the skeleton spec's `[UPDATE AFTER P1S1]` sections.

## Plugin Contract Reference
Frozen at `docs/plugin-contract.md` (285 lines). Covers registry schema, message protocol, lifecycle, auth patterns, tool gating, known quirks.

## New Files Added in Plan 1

### Apps
- `src/renderer/chatbridge/apps/chess/index.html` — Tier 2 internal, chess game
- `src/renderer/chatbridge/apps/weather/index.html` — Tier 3 external_public, dark theme, `__proxyResult` handler
- `src/renderer/chatbridge/apps/nasa/index.html` — Tier 3 external_public (897 lines), dark theme, bridge-sdk.js inlined, two-tab layout
- `src/renderer/chatbridge/apps/contract-test/index.html` — Tier 2 internal, bridge-sdk.js validation
- FlashForge — Tier 1 JSON-only (no HTML file, no entrypoint)

### Infrastructure
- `src/renderer/chatbridge/tool-builder.ts` — Converts JSON Schema tools to Vercel AI SDK ToolSet with execute functions
- `src/renderer/chatbridge/tool-router.ts` — Routes tool calls: open_app/close_app (lifecycle), app tools (bridge or host proxy). ~470 lines. FlashForge handlers at bottom. NASA handlers in middle.
- `src/renderer/chatbridge/tools.ts` — Tool gating: `getChatBridgeTools(activeAppId)` returns only active app's tools + open_app
- `src/renderer/chatbridge/app-lifecycle.ts` — Jotai atoms for activeApp state
- `src/renderer/chatbridge/system-prompt.ts` — Injects available tools into LLM system prompt
- `src/renderer/components/chatbridge/SidePanel.tsx` — 270 lines. Fixed right panel, iframe sandbox, bridge wiring, loading/error/retry UX, 15s timeout

### Playwright E2E
- `tests/e2e/playwright.config.ts` — chromium, localhost:3000, webServer auto-start
- `tests/e2e/helpers/mock-llm.ts` — Intercepts OpenAI API via `page.route()`, SSE streaming format
- `tests/e2e/helpers/chat-harness.ts` — Login (mocks Supabase auth), sendChatMessage, waitForAssistantResponse
- `tests/e2e/helpers/app-harness.ts` — waitForPanel, closePanel, getPanelTitle (uses `data-testid` selectors)
- `tests/e2e/core-scenarios.spec.ts` — 7 brief scenarios
- `tests/e2e/app-flows/` — chess (6), weather (3), nasa (3) tests
- `tests/e2e/resilience.spec.ts` — 4 resilience tests

## Iframe/Sandbox Lessons Learned

1. **bridge-sdk.js MUST be inlined.** `sandbox="allow-scripts allow-forms"` blocks cross-origin script loading. Every app copies the full bridge-sdk.js source into a `<script>` tag.

2. **No `allow-same-origin`.** Iframe cannot access localStorage, sessionStorage, or cookies. All state must be in-memory or proxied through host.

3. **No `allow-popups`.** Current sandbox blocks popup windows. Google Books OAuth will need the HOST to open the popup, not the iframe. This is the core architectural constraint for Plan 2.

4. **PostMessage origin is `"null"` from sandboxed iframes.** The bridge uses `"*"` as target origin because sandboxed iframes have null origin. Origin validation happens via message structure (UUID correlation), not origin checking.

5. **`__proxyResult` pattern:** For external_public apps, tool-router.ts calls the external API, then sends the result to BOTH the LLM (as tool result) AND the iframe (as `tool_call` args with `__proxyResult` key). The iframe detects this and renders the pre-fetched data.

6. **Iframe `onLoad` fires even on error pages.** The SidePanel uses a 15s timeout as fallback — if bridge handshake doesn't complete in 15s, show error card.

## tool-router.ts Architecture

The routing logic (line 40-80):
```
open_app → handleOpenApp(store, appId) → returns available tools list
close_app → handleCloseApp(store) → returns success
app tool with no active app → error "use open_app first"
app tool with wrong app active → error "requires {app} to be open"
app tool (api_key type) → executeHostProxiedTool() → calls external API, returns result
app tool (internal type) → bridgeRef.sendToolCall() → forwards to iframe via postMessage
```

**Missing for Plan 2:** There is NO code path for `oauth2_pkce` auth type. The `executeHostProxiedTool()` function only handles `api_key`. A new path is needed that:
- Checks if user has a valid token in Supabase
- If no token: returns `{error: "auth_required", authUrl: "..."}` so LLM can tell user to sign in
- If token exists but expired: refreshes it
- If valid token: makes API call with Bearer token

## Supabase Integration

- Auth works: `test@chatbridge.dev / TestPass123!` login flow verified
- `user_app_tokens` table ready: `(user_id UUID, app_id TEXT, access_token TEXT, refresh_token TEXT, expires_at TIMESTAMPTZ)`
- RLS enabled: users can only see their own tokens
- The web app uses Supabase client-side SDK (`@supabase/supabase-js`)
- Supabase URL and anon key are in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## GPT-4o Tool Call Behavior

- GPT-4o sometimes calls `open_app` multiple times before using app tools (5x in one test)
- GPT-4o sometimes returns empty streaming responses (API 200 but no content) — intermittent, not reproducible
- The `maxSteps: 5` in `stream-text.ts` allows multi-step tool call chains
- Tool definitions are built ONCE per API call (line 333-334 of stream-text.ts) — they don't update between steps. This means after `open_app` changes the active app, the NEW tools aren't available until the NEXT user message.

## Testing Patterns for Plan 2

- **Unit tests:** Use `createStore()` from jotai, `setStoreRef(store)`, `handleOpenApp(store, appId)` to set up state, then call `routeToolCall()` directly
- **Playwright E2E:** Mock OpenAI via `page.route('**/chat/completions**')`. Mock Supabase auth via `page.route('**/auth/v1/**')`. For Google OAuth tests, will also need to mock `page.route('**/googleapis.com/**')` and the OAuth callback flow.
