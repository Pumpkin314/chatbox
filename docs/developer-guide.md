# ChatBridge Developer Guide

Build apps that run inside ChatBridge without reading the source code.

## 1. Overview

ChatBridge is an app integration system for the ChatBridge AI chat platform (K-12 education). Third-party apps run in sandboxed iframes inside a 380px-wide side panel and communicate with the AI assistant through a PostMessage bridge protocol.

### Architecture

```
+---------------------------+     +-------------------+
|   ChatBridge Host         |     |  App iframe       |
|                           |     |  (sandboxed)      |
|  LLM  <-->  Tool Router   |<--->|  bridge-sdk.js    |
|              |             | PM  |  App HTML/JS/CSS  |
|         App Registry       |     +-------------------+
|         (apps.json)        |
+---------------------------+
         PM = PostMessage
```

**How it works:**

1. The LLM decides to open an app via the `open_app` tool.
2. The host loads the app's HTML into a sandboxed iframe in the side panel.
3. The host sends `app_init`, the app replies with `app_init_ack`.
4. When the LLM invokes an app tool, the host sends a `tool_call` message to the iframe.
5. The app processes it and replies with `tool_call_result`.
6. The app can also push `state_update` or `app_complete` messages at any time.

## 2. App Registration

Every app must be registered in `src/renderer/chatbridge/registry/apps.json`. This is a JSON array of `AppRegistration` objects.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | Unique identifier, lowercase, no spaces (e.g. `"calculator"`) |
| `name` | `string` | yes | Human-readable display name |
| `description` | `string` | yes | One-line description shown to the LLM and users |
| `type` | `string` | yes | One of: `"internal"`, `"external_public"`, `"external_authenticated"` |
| `tools` | `ToolSchema[]` | yes | Array of tools the app exposes (can be empty `[]`) |
| `entrypoint` | `string` | yes | Relative path to the app's HTML file (e.g. `"./apps/calculator/index.html"`) |
| `authConfig` | `AuthConfig \| null` | yes | Authentication configuration, or `null` for internal apps |
| `enabled` | `boolean` | yes | Set to `false` to hide the app from the LLM |

### App Types

- **`internal`** -- No external API calls. Runs entirely in the iframe. Auth is `null`.
- **`external_public`** -- Calls a public API that requires an API key. Auth type is `api_key`.
- **`external_authenticated`** -- Calls an API on behalf of the user (OAuth). Auth type is `oauth2_pkce`.

### Example Registration

```json
{
  "id": "calculator",
  "name": "Calculator",
  "description": "Perform arithmetic calculations with a visual display",
  "type": "internal",
  "tools": [
    {
      "name": "calculate",
      "description": "Evaluate a math expression",
      "parameters": {
        "type": "object",
        "properties": {
          "expression": {
            "type": "string",
            "description": "Math expression to evaluate (e.g. '2 + 3 * 4')"
          }
        },
        "required": ["expression"]
      }
    },
    {
      "name": "clear",
      "description": "Clear the calculator display",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  ],
  "entrypoint": "./apps/calculator/index.html",
  "authConfig": null,
  "enabled": true
}
```

## 3. Tool Schema Format

Each tool in the `tools` array follows the `ToolSchema` interface:

```typescript
interface ToolSchema {
  name: string          // Tool name, unique within the app
  description: string   // What the tool does (shown to the LLM)
  parameters: {
    type: 'object'
    properties: Record<string, unknown>  // JSON Schema property definitions
    required?: string[]                  // Which properties are required
  }
}
```

Parameter properties use standard [JSON Schema](https://json-schema.org/) types:

```json
{
  "name": "search_tracks",
  "description": "Search for tracks on Spotify",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (artist, track name, genre)"
      }
    },
    "required": ["query"]
  }
}
```

Supported JSON Schema types: `string`, `number`, `boolean`, `array`, `object`. You can use `enum`, `default`, `description`, and `items` (for arrays) within property definitions.

**Tips:**
- Write clear `description` fields -- they are the LLM's only guide for when and how to call the tool.
- Keep `required` minimal. The LLM handles optional params better when they have `default` values.
- An app with an empty `tools: []` array (like Rubik's Cube) can still receive `state_update` and `app_complete` messages but won't be invoked by the LLM via tool calls.

## 4. Bridge Protocol

All communication between the host and app iframe uses `window.postMessage`. Every message has this shape:

```typescript
{
  type: string      // Message type identifier
  id: string        // UUID v4 for request/response correlation
  payload: object   // Type-specific data
  timestamp: number // Date.now() when the message was created
}
```

### Host to App Messages

| Type | Payload | Description |
|------|---------|-------------|
| `app_init` | `{}` | Sent after iframe loads. App must reply with `app_init_ack` using the same `id`. |
| `tool_call` | `{ name: string, parameters: object }` | Invokes a tool. App must reply with `tool_call_result` or `error` using the same `id`. |
| `ping` | `{}` | Health check. App should reply with any message using the same `id`. |

### App to Host Messages

| Type | Payload | Description |
|------|---------|-------------|
| `ready` | `{}` | (Optional) App signals it is ready for tool calls. |
| `tool_call_result` | `{ result: any }` | Response to a `tool_call`. Must reuse the same `id`. |
| `state_update` | `{ ...state }` | Push updated app state to the host (e.g. board position, score). |
| `app_complete` | `{ ...result }` | Signal that the app's task is finished. |
| `error` | `{ message: string }` | Report an error. Can be a response (same `id`) or unsolicited. |
| `app_init_ack` | `{}` | Acknowledge `app_init`. Must reuse the same `id`. |

### Correlation and Timeouts

- Request/response pairs are correlated by `id`. When the host sends a `tool_call`, the app must reply with a message carrying the **same** `id`.
- The host has a **30-second timeout** per message. If the app does not respond, the host rejects the call.
- For `app_init`, the host retries up to **5 times** with 5-second delays between retries.

## 5. Bridge SDK

The file `bridge-sdk.js` is included inline in your app's HTML. It exposes a global `window.ChatBridge` object.

### API Reference

#### `ChatBridge.onToolCall(handler)`

Register a handler for incoming tool calls from the LLM.

```javascript
ChatBridge.onToolCall(function(toolName, params) {
  // toolName: string - the tool that was called
  // params: object - the parameters passed by the LLM
  // Return a value (or a Promise) as the result
  return { success: true, data: '...' };
});
```

The handler receives `(toolName, params)` and must return a result. If you return a `Promise`, the SDK waits for it to resolve. The return value is sent back to the host as `tool_call_result`.

#### `ChatBridge.sendStateUpdate(state)`

Push a state update to the host at any time. The host stores this in `appStateAtom`.

```javascript
ChatBridge.sendStateUpdate({ board: '...', turn: 'white', moveCount: 12 });
```

#### `ChatBridge.sendComplete(result)`

Signal that the app has finished its task.

```javascript
ChatBridge.sendComplete({ winner: 'white', moves: 42 });
```

#### `ChatBridge.on(type, handler)`

Listen for a specific message type from the host.

```javascript
ChatBridge.on('init', function(payload) {
  console.log('App initialized with:', payload);
});
```

#### `ChatBridge.send(type, payload)`

Send a custom message to the host. Returns the generated message `id`.

```javascript
var msgId = ChatBridge.send('custom_event', { key: 'value' });
```

## 6. Auth Patterns

### `null` -- Internal Apps

No authentication needed. The app runs entirely in the iframe with no external API calls.

```json
"authConfig": null
```

### `api_key` -- External Public APIs

The app calls a public API that requires a key. The key is stored in an environment variable.

```json
"authConfig": {
  "type": "api_key",
  "envVar": "VITE_WEATHER_API_KEY"
}
```

The host injects the key into the app via `app_init` payload. The key is read from the Vite environment at build time.

### `oauth2_pkce` -- User-Authenticated APIs

The app acts on behalf of the user via OAuth 2.0 PKCE flow.

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

| Field | Description |
|-------|-------------|
| `provider` | Identifier for the OAuth provider |
| `authUrl` | OAuth authorization endpoint |
| `tokenUrl` | OAuth token exchange endpoint |
| `clientIdEnvVar` | Env var holding the OAuth client ID |
| `scopes` | Array of OAuth scopes to request |

## 7. Example Walkthrough: Building a Calculator App

### Step 1: Create the app directory

```
src/renderer/chatbridge/apps/calculator/index.html
```

### Step 2: Register in apps.json

Add to the `apps.json` array:

```json
{
  "id": "calculator",
  "name": "Calculator",
  "description": "Perform arithmetic calculations with a visual display",
  "type": "internal",
  "tools": [
    {
      "name": "calculate",
      "description": "Evaluate a math expression and show the result",
      "parameters": {
        "type": "object",
        "properties": {
          "expression": {
            "type": "string",
            "description": "Math expression (e.g. '2 + 3 * 4')"
          }
        },
        "required": ["expression"]
      }
    },
    {
      "name": "clear",
      "description": "Clear the calculator display",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  ],
  "entrypoint": "./apps/calculator/index.html",
  "authConfig": null,
  "enabled": true
}
```

### Step 3: Write the app HTML

Everything must be in a **single HTML file** -- inline CSS, inline JS, no external resources.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Calculator - ChatBridge</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1e1e2e;
    color: #e0e0e8;
    padding: 16px;
    max-width: 380px;
  }

  #display {
    background: #2a2a3c;
    border-radius: 8px;
    padding: 16px;
    font-size: 24px;
    text-align: right;
    min-height: 60px;
    word-break: break-all;
    margin-bottom: 12px;
  }

  #expression {
    font-size: 14px;
    color: #8888a0;
    margin-bottom: 4px;
  }

  #result {
    font-size: 28px;
    font-weight: 600;
  }

  #history {
    margin-top: 16px;
    font-size: 13px;
    color: #8888a0;
  }

  .history-entry {
    padding: 4px 0;
    border-bottom: 1px solid #33334a;
  }
</style>
</head>
<body>

<div id="display">
  <div id="expression">Ready</div>
  <div id="result">0</div>
</div>
<div id="history"></div>

<!-- Bridge SDK (inline) -->
<script>
;(function () {
  'use strict';
  if (window.ChatBridge) return;

  var toolCallHandlers = [];
  var messageHandlers = {};

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function sendToHost(type, payload, id) {
    var message = {
      type: type,
      id: id || generateId(),
      payload: payload || {},
      timestamp: Date.now(),
    };
    window.parent.postMessage(message, '*');
    return message.id;
  }

  function handleMessage(event) {
    var data = event.data;
    if (!data || typeof data !== 'object' || !data.type || !data.id) return;

    if (data.type === 'tool_call') {
      var p = data.payload || {};
      var handled = false;
      for (var i = 0; i < toolCallHandlers.length; i++) {
        try {
          var result = toolCallHandlers[i](p.name, p.parameters || {});
          if (result !== undefined) {
            if (result && typeof result.then === 'function') {
              result.then(
                function (r) { sendToHost('tool_call_result', { result: r }, data.id); },
                function (e) { sendToHost('error', { message: e.message || 'fail' }, data.id); }
              );
            } else {
              sendToHost('tool_call_result', { result: result }, data.id);
            }
            handled = true;
            break;
          }
        } catch (e) {
          sendToHost('error', { message: e.message || 'error' }, data.id);
          handled = true;
          break;
        }
      }
      if (!handled) sendToHost('error', { message: 'No handler for: ' + p.name }, data.id);
      return;
    }

    if (data.type === 'app_init') {
      if (messageHandlers.init) messageHandlers.init(data.payload);
      sendToHost('app_init_ack', {}, data.id);
      return;
    }

    if (messageHandlers[data.type]) messageHandlers[data.type](data.payload, data.id);
  }

  window.addEventListener('message', handleMessage);

  window.ChatBridge = {
    onToolCall: function (h) { if (typeof h === 'function') toolCallHandlers.push(h); },
    on: function (t, h) { if (typeof h === 'function') messageHandlers[t] = h; },
    sendStateUpdate: function (s) { sendToHost('state_update', s); },
    sendComplete: function (r) { sendToHost('app_complete', r); },
    send: function (t, p) { return sendToHost(t, p); },
  };
})();
</script>

<!-- App logic -->
<script>
  var history = [];

  ChatBridge.onToolCall(function(toolName, params) {
    if (toolName === 'calculate') {
      return handleCalculate(params.expression);
    }
    if (toolName === 'clear') {
      return handleClear();
    }
  });

  function handleCalculate(expression) {
    try {
      // Sanitize: allow only numbers, operators, parens, dots, spaces
      var sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
      if (sanitized !== expression) {
        return { success: false, error: 'Invalid characters in expression' };
      }

      var result = Function('"use strict"; return (' + sanitized + ')')();

      // Update display
      document.getElementById('expression').textContent = expression;
      document.getElementById('result').textContent = String(result);

      // Track history
      history.push({ expression: expression, result: result });
      updateHistoryDisplay();

      // Push state to host
      ChatBridge.sendStateUpdate({
        lastExpression: expression,
        lastResult: result,
        historyCount: history.length,
      });

      return { success: true, expression: expression, result: result };
    } catch (e) {
      return { success: false, error: 'Could not evaluate: ' + e.message };
    }
  }

  function handleClear() {
    history = [];
    document.getElementById('expression').textContent = 'Ready';
    document.getElementById('result').textContent = '0';
    document.getElementById('history').innerHTML = '';
    ChatBridge.sendStateUpdate({ lastExpression: null, lastResult: null, historyCount: 0 });
    return { success: true };
  }

  function updateHistoryDisplay() {
    var el = document.getElementById('history');
    el.innerHTML = history
      .slice(-5)
      .reverse()
      .map(function (h) {
        return '<div class="history-entry">' + h.expression + ' = ' + h.result + '</div>';
      })
      .join('');
  }
</script>

</body>
</html>
```

### Step 4: Test

1. Start the dev server (`pnpm dev`).
2. In the chat, type something like "open the calculator" -- the LLM will call `open_app` with `app_id: "calculator"`.
3. Ask "what is 2 + 3 * 4" -- the LLM calls your `calculate` tool, the iframe evaluates it, and returns the result.

## 8. Constraints

- **Iframe sandbox:** `sandbox="allow-scripts allow-forms"`. No `allow-same-origin`, meaning `localStorage`, `cookies`, and `fetch` to same-origin endpoints are unavailable.
- **No external resources:** All CSS, JS, and assets must be **inline** in the single HTML file. External `<script src="...">` and `<link>` tags will be blocked by the sandbox.
- **380px width:** The side panel is exactly 380px wide. Design your UI accordingly.
- **PostMessage origin:** Because the sandbox strips origin, the SDK uses `'*'` as `targetOrigin`. All messages are validated by structure (`type` + `id` fields), not by origin.
- **30-second timeout:** If your tool handler takes longer than 30 seconds the host will reject the call. For long operations, send `state_update` messages as progress indicators and return the result promptly.
- **No Node.js / Electron APIs:** Apps run in a browser iframe. There is no access to `require`, `fs`, or any system APIs.
