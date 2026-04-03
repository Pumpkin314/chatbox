# Continuation 2: ChatBridge Implementation
**Written at:** Sprint 3 complete on main, Sprint 2+3 gates NOT yet verified in browser, Sprint 4 partially done
**Plan:** `docs/superpowers/plans/2026-04-02-chatbridge-implementation.md`
**Spec:** `docs/superpowers/specs/2026-04-02-chatbridge-design.md`
**Risks:** `docs/chatbridge_risks.md`
**Post-MVP:** `docs/chatbridge_post_mvp.md`
**Previous handover:** `docs/superpowers/plans/2026-04-02-chatbridge-continuation-1.md`

## Session Summary

This session fixed the build blocker from session 1, ran the Sprint 1 gate, merged all of Sprint 2 and Sprint 3, and added a host-side API proxy for weather tools.

### Key Actions Taken
1. **Build fix**: `pnpm install` resolved missing `@supabase/supabase-js`. Created `.erb/scripts/delete-source-maps-runner.js` (was referenced in package.json but never existed).
2. **Sprint 1 gate PASSED**: `pnpm build:web` + `pnpm serve:web` → Chrome E2E → app loads, auth works (sign up, sign in, session persists, AuthGuard redirects). Test user: `test@chatbridge.dev` / `TestPass123!` (email confirmed via Supabase admin API).
3. **Sprint 2 gate PASSED** (partial — build + load verified, full chess E2E not run): Build succeeds after all Sprint 2 merges. App loads with no console errors. Auth still works.
4. **Merged 13 PRs** onto main (see commit log below).
5. **Host-side API proxy** added to `tool-router.ts` — weather tools execute fetch on the host (bypassing iframe sandbox), with mock data fallback.

### What Was Merged This Session (in order)

| PR | Description | Merge Method |
|----|-------------|-------------|
| 2.1 | App registry (registry/apps.json, registry/index.ts, tools.ts, app-lifecycle.ts) | git merge |
| 2.2 | SidePanel component, bridge.ts, bridge-sdk.js, __root.tsx wiring | git merge (conflict resolution: kept main's app-lifecycle/registry/tools, took new SidePanel + bridge files) |
| 2.3 | tool-builder.ts, tool-router.ts, stream-text.ts integration | git merge (clean) |
| 2.4 | Chess app HTML bundle (1466 lines, self-contained) | git merge (clean) |
| 2.5 | context-manager.ts, system-prompt.ts + tests | git cherry-pick (conflict: kept main's app-lifecycle/registry/tools) |
| 3.1 | Weather dashboard HTML + tests (20 tests) | git cherry-pick (conflict: kept main's apps.json) |
| 3.2 | Spotify playlist HTML + tests (11 tests) | git cherry-pick (clean) |
| 3.3 | Rubik's Cube stub (placeholder HTML, already in registry as disabled) | Direct commit |
| 4.3 | Developer guide (docs/developer-guide.md, 552 lines) | git cherry-pick (clean) |
| - | API proxy in tool-router.ts | Direct commit |
| - | app-lifecycle.ts wired to context-manager (recordAppComplete on close, getLastAppState on open) | Direct commit |
| - | Test fixes for context-manager + system-prompt (removed registerApp references) | Direct commit |

### Merge Conflict Pattern
Every worktree agent recreated `app-lifecycle.ts`, `registry/index.ts`, and `tools.ts` from scratch. Resolution was always: **keep main's version** (which has the canonical PR 2.1 code), take only new files from the branch.

## Current State

### Build
- `pnpm build:web` — **PASSES**
- Output at `release/app/dist/renderer/`
- `delete-source-maps-runner.js` exists and works

### Tests
- **730 passed**, 84 skipped, 7 failed (all pre-existing)
- Pre-existing failures (do NOT fix): migration.test.ts, settingsStore.persist.test.ts, provider contracts, token-estimation analyzer (5 tests)
- All ChatBridge tests pass

### Supabase
- Project ref: `tmiwxelndsfcwmybsckj`
- `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Service role key: available via `npx supabase projects api-keys --project-ref tmiwxelndsfcwmybsckj`
- Test user: `test@chatbridge.dev` / `TestPass123!` (confirmed, ID: `5fc3bdd2-889d-4a9e-bf59-4f7165cf72e9`)
- 5 tables with RLS

### Git
- Branch: `main`, 40+ commits ahead of origin
- NOT pushed to remote yet
- Stale worktree branches can be cleaned up: `worktree-agent-*`, `chatbridge/side-panel-iframe-bridge`, `precook/2.5-context-retention`

### Files Modified This Session (key ones)
- `src/renderer/routes/__root.tsx` — Added SidePanel import, activeAppAtom, panelWidth logic with RTL support
- `src/renderer/chatbridge/app-lifecycle.ts` — Added context-manager integration (recordAppComplete, getLastAppState)
- `src/renderer/chatbridge/tool-router.ts` — Added host-side API proxy for weather tools with mock fallback
- `.erb/scripts/delete-source-maps-runner.js` — Created (was missing)

### New Files Created This Session
- `src/renderer/components/chatbridge/SidePanel.tsx` — 380px fixed panel, iframe sandbox, status footer
- `src/renderer/components/chatbridge/__tests__/SidePanel.test.tsx` — 7 tests
- `src/renderer/chatbridge/bridge.ts` — Host-side postMessage bridge with UUID correlation, 30s timeout
- `src/renderer/chatbridge/bridge-sdk.js` — Iframe-side SDK (ChatBridge.onToolCall, sendStateUpdate, sendComplete)
- `src/renderer/chatbridge/__tests__/bridge.test.ts` — 9 tests
- `src/renderer/chatbridge/tool-builder.ts` — Converts registry ToolSchema to Vercel AI SDK tool() instances
- `src/renderer/chatbridge/tool-router.ts` — Routes open_app/close_app/app tools + API proxy
- `src/renderer/chatbridge/__tests__/tool-builder.test.ts` — 5 tests
- `src/renderer/chatbridge/__tests__/tool-router.test.ts` — 6 tests
- `src/renderer/chatbridge/context-manager.ts` — App state history tracking
- `src/renderer/chatbridge/system-prompt.ts` — ChatBridge context injection for LLM
- `src/renderer/chatbridge/__tests__/context-manager.test.ts` — 8 tests
- `src/renderer/chatbridge/__tests__/system-prompt.test.ts` — 6 tests
- `src/renderer/chatbridge/apps/chess/index.html` — 1466 lines, inline chess.js
- `src/renderer/chatbridge/apps/weather/index.html` — Mock data for 10 cities
- `src/renderer/chatbridge/apps/weather/__tests__/weather.test.ts` — 20 tests
- `src/renderer/chatbridge/apps/spotify/index.html` — Mock playlists + tracks
- `src/renderer/chatbridge/apps/spotify/__tests__/spotify.test.ts` — 11 tests
- `src/renderer/chatbridge/apps/rubiks/index.html` — Placeholder "Coming Soon"
- `docs/developer-guide.md` — 552 lines

## What Remains

### MUST DO (MVP delivery)

1. **Sprint 3 gate (Chrome E2E)** — NOT YET RUN. The plan says:
   - Log in → "what's the weather in New York?" → side panel opens with weather → "how about Tokyo?" → weather updates
   - "let's play chess" → play moves → "now show me the weather" → chess closes, weather opens → "go back to my chess game" → chess resumes
   - Note: The ChatBridge tools are wired into streamText, but the actual tool invocation flow through the LLM hasn't been E2E tested yet. The LLM needs an OpenAI API key configured in Settings to make tool calls.

2. **Sprint 4 remaining:**
   - PR 4.1: Error handling + loading indicators (SidePanel spinner, tool call timeout, app crash recovery) — POLISH
   - PR 4.4: Cost analysis doc + deployment (Vercel or static host) + push to remote

3. **Deployment** — `pnpm build:web` output is a static SPA. Deploy via `vercel deploy` or any static host. Env vars needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

4. **Push to remote** — 40+ commits on main, not pushed.

### NICE TO HAVE
- PR 4.2: Multi-app context retention polish
- Cost analysis document (`docs/cost-analysis.md`)
- GitLab mirror

## Known Issues

1. **Circular dependency risk**: `app-lifecycle.ts` imports from `context-manager.ts`, and `context-manager.ts` imports from `app-lifecycle.ts`. Currently works because the imports are only types/atoms (no circular execution), but worth watching.

2. **SidePanel iframe entrypoint resolution**: The registry `entrypoint` field uses `./apps/chess/index.html` — the SidePanel needs to resolve this relative to the chatbridge directory. Not yet verified that the iframe actually loads the HTML in the built app.

3. **Bridge not wired to tool-router**: `tool-router.ts` exports `setBridgeRef()` and `setStoreRef()` for wiring. These are NOT yet called anywhere in the app initialization. The SidePanel creates a bridge instance but doesn't call `setBridgeRef`. This means app-specific tool calls will return "Bridge not available" errors. **This needs to be wired up.**

4. **Tool-router store not initialized**: `setStoreRef()` is never called, so `open_app` and `close_app` tool calls will return "Store not initialized". **Needs initialization in app startup.**

5. **API proxy verification**: The host-side weather API proxy was added but NOT tested. Verification criteria exist but haven't been checked.
