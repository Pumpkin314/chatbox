# ChatBridge Plugin Contract v1.0

## Overview

ChatBridge is a plugin system that extends the chat interface with interactive side-panel apps. Apps run in sandboxed iframes and communicate with the host via a structured postMessage bridge. The LLM discovers apps through a tool-based interface and interacts with them by invoking app-specific tools.

This document is the stable contract for building new plugins. It is verified against the Sprint 4 codebase and covers all four app tiers.

See also: [Architecture Overview](architecture-overview.md) | [Developer Guide](developer-guide.md)

## App Registry Schema

Apps are declared in `src/renderer/chatbridge/registry/apps.json`. Each entry conforms to the `AppRegistration` interface defined in `src/renderer/chatbridge/registry/index.ts`.

```typescript
interface AppRegistration {
  id: string                  // Unique app identifier (e.g. "chess", "weather")
  name: string                // Human-readable display name
  description: string         // Short description shown to the LLM
  type: 'internal' | 'external_public' | 'external_authenticated'
  tools: ToolSchema[]         // Tools the app exposes to the LLM
  entrypoint: string          // Path to the app's HTML file (e.g. "/apps/chess/index.html")
  authConfig: AuthConfig | null  // null for internal apps
  enabled: boolean            // false = hidden from LLM and UI
}
```

### Entrypoint

The `entrypoint` field determines whether an iframe is rendered:

- **Non-empty** (e.g. `"/apps/chess/index.html"`): The app gets an iframe in the side panel. This is the default for Tier 2 and Tier 3 apps.
- **Empty string** (`""`): No iframe is rendered. The app is **Tier 1 (JSON-only)** -- tool calls are handled entirely in the host process. Example: FlashForge.

### App Tiers

| Tier | Type | Iframe | Auth | Example |
|------|------|--------|------|---------|
| **Tier 1** — JSON-only | `internal` | No (`entrypoint: ""`) | None | FlashForge |
| **Tier 2** — Internal iframe | `internal` | Yes | None | Chess, contract-test |
| **Tier 3** — External public | `external_public` | Yes | API key (host-proxied) | Weather, NASA Space Explorer |
| **Tier 4** — External authenticated | `external_authenticated` | Yes | OAuth2 PKCE | Spotify (disabled) |

**Tier 1 pattern:** FlashForge is the reference implementation. Its tool handlers live directly in `tool-router.ts` as pure functions (no bridge, no iframe). The LLM generates flashcard content and the tool returns JSON results. This is the simplest app pattern -- ideal for apps that need no UI.

## Tool Schema

Each app declares zero or more tools. The `ToolSchema` interface:

```typescript
interface ToolSchema {
  name: string                // Tool name (unique across all enabled apps)
  description: string         // Description for the LLM
  parameters: {
    type: 'object'
    properties: Record<string, unknown>  // JSON Schema properties
    required?: string[]
  }
}
```

Tools are registered in the app's `tools` array in `apps.json`. The LLM sees them via `getChatBridgeTools()` in `src/renderer/chatbridge/tools.ts`.

## Auth Config Patterns

### No auth (internal apps)

```json
"authConfig": null
```

### API key (external_public)

The host holds the API key and proxies all network requests. The iframe never sees the key.

```json
"authConfig": {
  "type": "api_key",
  "envVar": "VITE_WEATHER_API_KEY"
}
```

### OAuth2 PKCE (external_authenticated)

The app handles its own OAuth flow. The host provides configuration.

```json
"authConfig": {
  "type": "oauth2_pkce",
  "provider": "spotify",
  "authUrl": "https://accounts.spotify.com/authorize",
  "tokenUrl": "https://accounts.spotify.com/api/token",
  "clientIdEnvVar": "VITE_SPOTIFY_CLIENT_ID",
  "scopes": ["playlist-modify-public", "playlist-modify-private"]
}
```

## Message Protocol

All messages use the `BridgeMessage` structure defined in `src/renderer/chatbridge/bridge.ts`:

```typescript
interface BridgeMessage {
  type: string       // Message type identifier
  id: string         // UUID v4 — used for request-response correlation
  payload: unknown   // Type-specific data
  timestamp: number  // Date.now() at send time
}
```

### Host -> Iframe

| Type | Payload | Purpose |
|------|---------|---------|
| `app_init` | `{ appId, ... }` | Handshake -- app should initialize |
| `tool_call` | `{ name, parameters }` | LLM invoked a tool; app should execute and respond |

### Iframe -> Host

| Type | Payload | Purpose |
|------|---------|---------|
| `tool_call_result` | `{ result }` | Tool call response (correlated by message `id`) |
| `app_init_ack` | `{}` | Acknowledgement of `app_init` |
| `state_update` | `{ ... }` | App state changed (non-blocking, no response expected) |
| `app_complete` | `{ ... }` | App finished its task |
| `error` | `{ message }` | Error occurred |

### Response correlation

Responses are matched to requests by the `id` field, not by message type. The host's `bridge.ts` resolves pending promises when it receives any message with a matching `id`. This means both `tool_call_result` and `tool_result` (or any other type) will resolve correctly as long as the `id` matches.

## Lifecycle Sequence

1. User triggers app via chat. The LLM calls the `open_app` tool with `{ app_id: "..." }`.
2. `handleOpenApp()` sets `activeAppAtom`. `SidePanel` renders an iframe with the app's `entrypoint`.
3. Iframe loads. `SidePanel` sets panel state to `connected` on iframe `onLoad`.
4. Host installs the postMessage listener via `installMessageListener()` and wires the `AppBridge` into `tool-router.ts` via `setBridgeRef()`.
5. LLM calls app tools. `routeToolCall()` forwards them through `bridgeRef.sendToolCall()`, which calls `sendMessage(iframe, 'tool_call', { toolName, args })`.
6. The iframe's `bridge-sdk.js` dispatches tool calls to handlers registered via `ChatBridge.onToolCall()`. The handler returns a result (or Promise), and the SDK sends a `tool_call_result` response with the same `id`.
7. App may send `state_update` at any time via `ChatBridge.sendStateUpdate()`. These are dispatched to registered message handlers on the host (non-blocking).
8. LLM calls `close_app` or user clicks the close button. `handleCloseApp()` clears `activeAppAtom`, `SidePanel` unmounts the iframe, and `clearPending()` / `clearHandlers()` clean up the bridge.

## Tool Gating

Tool visibility is managed by `getChatBridgeTools()` in `tools.ts` and `buildToolSet()` in `tool-builder.ts`:

- **No app active:** Only `open_app` is available. The LLM must open an app before it can use app-specific tools.
- **App active:** `open_app` + the active app's tools + `close_app`. Only the active app's tools are exposed, not all apps' tools.
- `close_app` is a system tool (not in `apps.json`) -- it is injected by `buildToolSet()` only when an app is active.
- If the LLM calls an app tool without first calling `open_app`, `routeToolCall()` returns an error message telling it to call `open_app` first.
- For Tier 1 apps (like FlashForge), tool calls are handled in-process by `routeToolCall()` without going through the bridge.

## bridge-sdk.js API Reference

Standard SDK for iframe apps. Located at `src/renderer/chatbridge/bridge-sdk.js`.

Must be **inlined** in the app's HTML (the iframe sandbox `allow-scripts allow-forms` blocks cross-origin script loading because `allow-same-origin` is not set).

### ChatBridge.on(type, handler)

Register a handler for a specific message type.

```javascript
ChatBridge.on('app_init', function(payload) {
  // Initialize app with payload data
})
```

Handler signature: `(payload: any, messageId: string) => void`

### ChatBridge.onToolCall(handler)

Register a tool call handler. The handler receives `(toolName, params)` and should return a result (or a Promise that resolves to a result).

```javascript
ChatBridge.onToolCall(function(toolName, params) {
  if (toolName === 'my_tool') {
    return { result: 'done' }
  }
})
```

Handler signature: `(toolName: string, params: object) => any | Promise<any>`

### ChatBridge.sendStateUpdate(state)

Send current app state to host for LLM context. Non-blocking; no response expected.

```javascript
ChatBridge.sendStateUpdate({ board: currentBoard, turn: 'white' })
```

### ChatBridge.sendComplete(result)

Signal that the app has completed its task.

```javascript
ChatBridge.sendComplete({ summary: 'Game over, white wins' })
```

### ChatBridge.send(type, payload)

Send a custom message to the host. Returns the generated message ID.

```javascript
var id = ChatBridge.send('custom_event', { data: 123 })
```

## Host-Side API Proxy

For apps with `api_key` auth type, the host executes API calls on behalf of the iframe (bypassing sandbox network restrictions). This is implemented in `routeToolCall()` in `src/renderer/chatbridge/tool-router.ts`.

Flow:
1. LLM calls an app tool (e.g. `get_weather`)
2. `routeToolCall()` detects `authConfig.type === 'api_key'`
3. Host reads the API key from `import.meta.env[authConfig.envVar]`
4. Host calls the external API directly via `fetch()`
5. Result is returned to the LLM as JSON
6. Result is also forwarded to the iframe as `args.__proxyResult` in a `tool_call` message (so the iframe can update its UI)

If the API key is missing or the request fails, mock data is returned as a fallback.

### `__proxyResult` pattern

When a host-proxied tool call completes, the result is forwarded to the iframe as `args.__proxyResult` in a `tool_call` message. Apps with `api_key` auth should check for this field in their `onToolCall` handler to display pre-fetched data without making their own API call:

```javascript
ChatBridge.onToolCall(function(toolName, params) {
  if (params.__proxyResult) {
    // Host already fetched the data -- just render it
    renderWeatherData(params.__proxyResult);
    return params.__proxyResult;
  }
  // Fallback: should not normally reach here for proxied tools
});
```

## Timeouts

| Timeout | Value | Location |
|---------|-------|----------|
| Tool call response | 30,000ms | `bridge.ts` `TIMEOUT_MS` |
| Iframe load | 15,000ms | `SidePanel.tsx` `IFRAME_LOAD_TIMEOUT_MS` |
| ACK retry delay | 5,000ms | `bridge.ts` `ACK_RETRY_MS` |
| Max retries | 5 | `bridge.ts` `MAX_RETRIES` |

## Known Quirks

1. **Response type naming:** Both `tool_result` and `tool_call_result` work as response types. The bridge resolves pending requests by matching the UUID `id`, not the message `type`. The SDK uses `tool_call_result` by convention.

2. **Iframe sandbox:** The iframe uses `sandbox="allow-scripts allow-forms"` only (no `allow-same-origin`). This means `bridge-sdk.js` must be inlined in the HTML file -- `<script src="...">` will fail for cross-origin resources. The iframe's origin is `null`.

3. **PostMessage target origin:** Both host and iframe use `'*'` as the target origin for `postMessage()`. This is required because sandboxed iframes have a `null` origin.

4. **`__proxyResult` injection:** For host-proxied API tools, the result is injected as `args.__proxyResult` in the `tool_call` payload sent to the iframe. Apps should check for this field to display pre-fetched results.

5. **Tool gating enforcement:** If the LLM calls an app-specific tool without first calling `open_app`, `routeToolCall()` returns an error message telling the LLM to call `open_app` first. It does NOT auto-open the app.

6. **HOST_MESSAGE_TYPES constant:** The `HOST_MESSAGE_TYPES` array in `bridge.ts` is a type-level constant and may not reflect all message types actually sent by the host. The actual protocol is defined by what `SidePanel.tsx` and `tool-router.ts` send.
