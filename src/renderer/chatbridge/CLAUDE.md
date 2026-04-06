# ChatBridge Module

The core bridge system connecting LLM tool calls to embedded app iframes.

## Architecture

- `bridge.ts` — PostMessage bridge between host and app iframes
- `tool-builder.ts` / `tool-router.ts` / `tools.ts` — Tool pipeline: build schemas, route calls to apps
- `app-lifecycle.ts` — Iframe creation, loading, teardown
- `context-manager.ts` — Manages conversation context for tool calls
- `system-prompt.ts` — Injects available tools into the system prompt
- `bridge-sdk.js` — Injected into app iframes; provides the app-side API
- `registry/` — App registry (apps.json + types)
- `apps/` — App HTML source of truth (served via Vite plugin, NOT from public/)
- `auth.ts` / `supabase.ts` / `storage.ts` / `chatStoreSupabase.ts` — Supabase user auth and persistence
- `oauth.ts` — Third-party app OAuth (e.g., Google Books OAuth2 PKCE flow). Separate from auth.ts which handles Supabase user authentication.
- `messagePersistence.ts` — Message save helpers
- `token-logger.ts` — Token usage tracking

## Key Conventions

- App HTML lives ONLY in `apps/` here. The Vite plugin in `electron.vite.config.ts` copies them to build output.
- `bridge-sdk.js` is the contract between host and apps. Changes require updating all apps.
- Tests live in `__tests__/` subdirectory.
- Exports are centralized through `index.ts`.

## Testing

```bash
pnpm test -- --testPathPattern=chatbridge
```
