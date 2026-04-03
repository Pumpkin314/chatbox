# Honest Assessment Bundle

## Strengths

- **Clean architecture.** Meta-tool + dynamic scoping + postMessage bridge is well-separated and extensible.
- **Strong security.** Iframe sandbox without `allow-same-origin` is the right call for K-12 education.
- **Comprehensive testing.** 85+ ChatBridge-specific tests across all modules, 730+ total passing.
- **Low cost.** GPT-4o-mini at ~$2/month per classroom makes deployment realistic for schools.
- **Good documentation.** 552-line developer guide, design spec, risk register, cost analysis.

## Known Issues (Unresolved)

1. **Bridge wiring incomplete.** `setBridgeRef()` and `setStoreRef()` in `tool-router.ts` may not be called during app initialization, causing "Bridge not available" errors for app tool calls.
2. **Iframe entrypoint resolution.** Registry paths like `./apps/chess/index.html` -- untested in production Vite build output.
3. **Spotify OAuth untested E2E.** Module exists (`oauth.ts`) but full popup flow never verified in browser.
4. **Circular dependency.** `app-lifecycle.ts` <-> `context-manager.ts`. Works today (type-only imports) but fragile.

## Tech Debt

- No CI/CD pipeline (inherited from Chatbox fork)
- 7 pre-existing test failures left unfixed
- API keys in client-side code (mitigated by build-time env vars)
- MUI + Mantine dual framework (historical, not our doing)
- `pnpm dev:web` runs Electron -- confusing for developers

## What We Would Change

1. **Server-side orchestration.** Move LLM calls to Supabase Edge Functions to keep API keys off the client.
2. **Playwright E2E.** Replace manual Chrome MCP sprint gates with automated Playwright tests.
3. **Streaming tool results.** Currently blocks until tool completes. Add `partial_result` message type to bridge protocol.
4. **Conversation compaction.** Context window grows unbounded over long sessions. Add sliding window or summarization.
5. **Developer SDK on npm.** Extract `bridge-sdk.js` as `@chatbridge/bridge-sdk` package with TypeScript types.

## Risk Assessment (from risks doc)

| Risk | Status |
|------|--------|
| R1 Token bloat | Mitigated (dynamic scoping) |
| R2 App state persistence | Implemented (app_context messages) |
| R3 Completion signaling | Implemented (app_complete + 30s timeout) |
| R4 OAuth in web | Partially implemented (module exists, not E2E tested) |
| R5 Iframe security | Fully implemented |
| R6 Communication reliability | Implemented (UUID envelopes, retry, timeout) |
| R7 Multi-app routing | Implemented (LLM handles disambiguation) |
| R8 No Electron APIs | Fully mitigated (web build works) |
| R9 3D rendering (Rubiks) | Deferred (stub only) |
| R10 Local->server migration | Implemented (Supabase + local fallback) |
| R11 Spotify playback | Scoped to preview URLs only |
