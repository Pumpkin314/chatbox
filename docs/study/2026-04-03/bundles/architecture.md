# Architecture Bundle

## Pattern: Host-Orchestrated Client-Side

All orchestration runs in the browser. No backend orchestration server. Supabase provides auth + DB only.

## Core Flow

1. User message -> `generation.ts` -> `streamText()` (Vercel AI SDK)
2. Tool list built by `tool-builder.ts` from registry + `activeAppAtom`
3. OpenAI returns streaming response with optional `tool_call`
4. `tool-router.ts` dispatches: `open_app` -> lifecycle, app tools -> bridge postMessage, weather -> host-side fetch proxy
5. Bridge correlates requests/responses via UUID, 30s timeout
6. Tool result fed back to LLM via `maxSteps: 5` continuation
7. Messages saved to Supabase, token usage logged

## Key Modules

| Module | Role |
|--------|------|
| `tool-builder.ts` | Registry JSON Schema -> Vercel AI SDK `tool()` instances |
| `tool-router.ts` | Routes tool calls to correct handler (lifecycle / bridge / proxy) |
| `bridge.ts` | Host-side postMessage with UUID correlation + timeout |
| `bridge-sdk.js` | Iframe-side SDK: `ChatBridge.onToolCall`, `sendStateUpdate`, `sendComplete` |
| `app-lifecycle.ts` | `activeAppAtom`, `openApp()`, `closeApp()` |
| `context-manager.ts` | Tracks app state history per conversation |
| `system-prompt.ts` | Injects active app context into LLM system prompt |
| `registry/index.ts` | Loads `apps.json`, generates `open_app` meta-tool definition |

## Dynamic Tool Scoping

```
No app active:  [open_app]
Chess active:   [open_app, start_game, make_move, get_board, get_hint, resign]
Weather active: [open_app, get_weather, get_forecast]
App closed:     [open_app] (tools removed)
```

## Iframe Sandbox

`sandbox="allow-scripts allow-forms"` -- NO `allow-same-origin`. Apps cannot access parent DOM, localStorage, cookies, or host APIs. All communication via postMessage with structure validation.

## Database

5 Supabase tables with RLS: `conversations`, `messages`, `app_registry` (seeded, unused in MVP), `token_usage_log`, `user_app_tokens`. Messages have optional `app_state` JSONB and `app_context` role.
