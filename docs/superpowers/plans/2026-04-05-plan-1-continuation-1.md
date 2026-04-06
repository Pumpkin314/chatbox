# Continuation: ChatBridge Sprint Plan 1
**Written at:** Sprint 2 complete, before Sprint 2 gate
**Plan:** `docs/superpowers/plans/2026-04-05-plan-1-chatbridge-sprint.md`

## Completed

### Sprint 0: Tracer Bullet
- PR 0.1: Fixed dual app copy problem. `chatbridge/apps/` is single source of truth. Vite plugin `chatbridgeAppsPlugin()` in `electron.vite.config.ts` copies to build output. `public/apps/` deleted.
- CLAUDE.md files added for chatbridge/, registry/, apps/, components/chatbridge/
- Chrome verified: login page renders, chess iframe loads at `/apps/chess/index.html`

### Sprint 1: Contract Standardization
- PR 1.1: Fixed HOST_MESSAGE_TYPES (`tool_call` not `tool_call_result`). **Implemented tool gating** — only `open_app` when no app active, app tools appear after open_app, close_app hides them. Auto-open removed from tool-router.ts.
- PR 1.2: Contract test app created at `chatbridge/apps/contract-test/index.html`. First real bridge-sdk.js consumer. bridge-sdk.js MUST be inlined (sandbox blocks cross-origin scripts).
- PR 1.3: Spotify disabled in apps.json. Plugin contract frozen at `docs/plugin-contract.md` (231 lines).
- Chrome verified: chess loads, contract-test loads, tool gating works.

### Sprint 2: Weather + NASA
- PR 2.1: Weather `__proxyResult` handler added. `mapConditionToIcon()` maps OpenWeatherMap conditions to emoji. Forecast reshaping: host returns `{forecasts}`, iframe expects `{forecast}` with different shape.
- PR 2.2: NASA Space Explorer app (897 lines). 3 tools: get_apod, get_mars_photos, get_asteroids. Dark theme, two-tab layout (Explore + Dashboard). bridge-sdk.js inlined. Host proxy extended in tool-router.ts with mock fallbacks.

## Divergences from Plan

1. **Agent worktree base commits:** Every agent branched from older commits (missing prior PRs). Required manual merge conflict resolution each time — always the same pattern: agent tests assumed old behavior (no tool gating, old app counts), resolved by keeping HEAD + adding new app assertions.

2. **public/apps/ ghost copies:** Agents kept creating copies in `public/apps/` since their worktrees had the old directory. Removed during each merge. Future agents should be told NOT to create public/apps/ copies.

3. **Contract-test at 158 lines:** Spec said ~50 lines but bridge-sdk.js inlining makes it ~158. App logic is ~30 lines. Unavoidable.

4. **Registry counts:** 6 apps total (chess, weather, spotify, rubiks, contract-test, nasa). 4 enabled (chess, weather, contract-test, nasa). 2 disabled (spotify, rubiks).

## Current State

- **Branch:** main at `4f28b28b`
- **Tests:** 174 chatbridge tests passing, 7 pre-existing failures (token-estimation/settingsStore — not ours)
- **Apps registered:** chess (internal), weather (external_public), contract-test (internal), nasa (external_public), spotify (disabled), rubiks (disabled)
- **Railway vars set:** All 5 VITE_* keys configured on exciting-nature production
- **All worktrees cleaned up**
- **.env configured:** Supabase, OpenAI, Weather, NASA keys all set

## Pending

### Sprint 2 Gate (next action)
Rebuild web app and Chrome-verify:
1. Weather with real API data (Tokyo)
2. Close weather → open NASA → APOD displays
3. Tab switch, context retention
4. Chess regression

### Sprint 3: Playwright E2E (PR 3.1 → 3.2)
- User needs to install: `pnpm add -D @playwright/test && npx playwright install chromium`
- PR 3.1: Config + helpers + 7 core scenarios
- PR 3.2: App-specific tests (chess, weather, nasa, resilience)

### Sprint 4: Polish + Docs (PR 4.1, 4.2, 4.3)
- PR 4.1: Tier 1 JSON edu app (FlashForge or WordLab)
- PR 4.2: UX polish (loading states, error cards, dark theme)
- PR 4.3: Docs + architecture overview
- M7: Manual exploratory testing (non-PR activity)

## Key Architecture Decisions

1. **Tool gating:** LLM only sees `open_app` until an app is opened. Then that app's tools + `close_app`. Must call `close_app` before switching apps.
2. **Single source of truth:** App HTML in `chatbridge/apps/` ONLY. Vite plugin copies to build output. Do NOT create `public/apps/` copies.
3. **bridge-sdk.js inlined:** Iframe sandbox blocks cross-origin scripts. All apps must inline bridge-sdk.js content.
4. **Host proxy pattern:** `api_key` auth apps → tool-router.ts calls API, sends result to LLM AND iframe (via `__proxyResult` in tool_call args). Iframe renders the real data.
5. **Mock fallbacks:** Missing API keys → mock data returned. `{ mock: true }` flag in response.

## Known Issues
- Supabase anon key format: User provided `sb_publishable_...` format. Standard Supabase anon keys are JWTs starting with `eyJ...`. Auth may not work — verify at Sprint 2 gate.
- Node 25.9.0 vs project requirement <23: Use `engine-strict=false` in .npmrc, or `npx` directly.
