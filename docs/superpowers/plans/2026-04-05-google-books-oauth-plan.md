# Google Books OAuth Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers-extended-cc:parallel-pr-execution to implement this plan.

**Goal:** Add a Tier 4 Google Books app with search (API key) and bookshelf management (OAuth2 PKCE) to ChatBridge.
**Architecture:** Host-mediated OAuth popup flow. All Google API calls proxied through tool-router.ts. Tokens stored in Supabase. Layered sprints — search first, then OAuth.
**Tech Stack:** Electron + Vite + React + TypeScript + Jotai + Supabase + Vitest + Playwright (all existing)
**Project type:** brownfield
**Compaction:** auto

**Spec:** `docs/superpowers/specs/2026-04-05-google-books-oauth-design.md`
**Sprint numbering:** This plan uses Sprint 0/1/2. The spec uses Sprint 2/3 (inherited from the skeleton). Mapping: Plan Sprint 0 = foundation, Plan Sprint 1 = Spec Sprint 2 (search), Plan Sprint 2 = Spec Sprint 3 (OAuth).

**External services:**
- Google Books API — API key for search, OAuth2 for bookshelves
- Google OAuth2 — authorization + token exchange
- Supabase — token storage in `user_app_tokens`
- Human steps: 1 (~10 min) — Google Cloud Console setup

**Total estimated human setup time:** ~10 minutes

**Service integration levels:**
- Supabase (existing) — **L5** critical: already working, don't break
- OpenAI LLM (existing) — **L5** critical: already working
- OpenWeatherMap (existing) — **L5** critical: already working
- NASA APIs (existing) — **L5** critical: already working
- Google Books API (new) — **L3** degraded: mock fallback for search when API key missing, auth_required for OAuth tools when no token
- Google OAuth2 (new) — **L3** degraded: app works for search without OAuth, bookshelf features require real credentials

---

## Sprint 0: Tracer Bullet (Brownfield)

**Objective:** Prove the change path works — register app, modify tool-router, extend Vite plugin — without breaking existing functionality. Commit CLAUDE.md updates.

### PR 0.1: CLAUDE.md + google-books registry entry + Vite callback route
**Branch:** `sprint-0/tracer-bullet`
**Depends on:** nothing
**Existing code touched:** `apps.json`, `electron.vite.config.ts`, `CLAUDE.md` files
**Patterns to follow:** Existing app registration format, Vite plugin middleware pattern
**TDD:** no (config-only changes)
**Verification criteria:**
- [ ] CLAUDE.md files updated and committed (chatbridge/, chatbridge/apps/)
- [ ] google-books entry in apps.json (enabled, all 5 tools, oauth2_pkce authConfig)
- [ ] `open_app` tool lists google-books as available
- [ ] Vite plugin serves `/auth/callback.html` in dev mode
- [ ] Existing tests still pass (`pnpm test -- --testPathPattern=chatbridge`)
- [ ] Regression: weather, NASA, chess apps still work (tool-router unchanged)

#### Commit 0.1.1: Update CLAUDE.md files
- [ ] Update `src/renderer/chatbridge/CLAUDE.md` — add oauth.ts description, clarify auth.ts vs oauth.ts
- [ ] Update `src/renderer/chatbridge/apps/CLAUDE.md` — add nasa, contract-test, google-books entries
- [ ] Verify: git status clean

#### Commit 0.1.2: Register google-books in apps.json
- [ ] Add full registry entry from design spec Section 1 (all 5 tools, oauth2_pkce authConfig, enabled)
- [ ] Add `remove_from_shelf` with enum constraint on shelf param
- [ ] Verify: `pnpm test -- --testPathPattern=chatbridge` passes (registry loads without error)

#### Commit 0.1.3: Extend Vite plugin for /auth/ path
- [ ] In `electron.vite.config.ts` `chatbridgeAppsPlugin()`:
  - Add middleware branch in `configureServer` for `/auth/callback.html` → serves `src/renderer/chatbridge/oauth-callback.html`
  - Add copy logic in `writeBundle` for oauth-callback.html → `dist/auth/callback.html`
- [ ] Create placeholder `src/renderer/chatbridge/oauth-callback.html` (just "Callback page placeholder")
- [ ] Verify: `curl http://localhost:3000/auth/callback.html` returns the placeholder (dev server running)

**Sprint 0 gate:**
- [ ] `pnpm test -- --testPathPattern=chatbridge` — all pre-existing passing tests still pass
- [ ] Verify google-books appears in `getChatBridgeTools(null)` open_app enum (unit test or manual)

---

## Sprint 1: Search App (API Key Only)

**Objective:** Build working Google Books search with book cards UI, host-proxied API calls, mock fallback, and full test coverage. OAuth tools return `auth_required`.

### PR 1.1: Host proxy for search_books and get_book_details
**Branch:** `sprint-1/search-proxy`
**Depends on:** PR 0.1
**Existing code touched:** `tool-router.ts` (add branches after line 103)
**Patterns to follow:** Weather/NASA proxy pattern — fetch with catch, mock fallback, `__proxyResult` forwarding
**TDD:** yes
**Verification criteria:**
- [ ] `search_books({query: "dinosaurs"})` returns `{books: [{id, title, authors, ...}]}`
- [ ] `get_book_details({volume_id: "abc123"})` returns book detail object
- [ ] Mock fallback returns 3 hardcoded books when `VITE_GOOGLE_BOOKS_API_KEY` missing
- [ ] OAuth tools (`get_reading_list`, `add_to_shelf`, `remove_from_shelf`) return `{error: "auth_required", message: "..."}`
- [ ] `__proxyResult` forwarded to iframe via bridge
- [ ] Regression: weather and NASA proxy calls unaffected

#### Commit 1.1.1: Write unit tests for Google Books proxy
- [ ] In `tool-router.test.ts`: add tests for search_books and get_book_details proxy routing, OAuth tools returning auth_required
- [ ] Create `src/renderer/chatbridge/apps/google-books/__tests__/google-books.test.ts`:
  - Test response shape mapping from Google API format to tool schema (books array structure)
  - Test mock data fallback when API key missing (3 hardcoded books, correct shape)
  - Test get_book_details response mapping
- [ ] Verify: tests fail (TDD red)

#### Commit 1.1.2: Implement search proxy in tool-router.ts
- [ ] Add `oauth2_pkce` code path after line 103: check `OAUTH_REQUIRED_TOOLS` set, return `auth_required` for those
- [ ] For non-OAuth tools (search_books, get_book_details): read `VITE_GOOGLE_BOOKS_API_KEY`, call Google Books API, return mapped result
- [ ] Add `getMockBooks()` fallback function
- [ ] Forward result to iframe via `bridgeRef.sendToolCall(toolName, { ...args, __proxyResult: result })`
- [ ] Verify: tests pass (TDD green)

### PR 1.2: Google Books iframe app (search UI)
**Branch:** `sprint-1/search-ui`
**Depends on:** PR 0.1 (authored in parallel with PR 1.1, but merged and verified AFTER PR 1.1 — search card rendering requires proxy code)
**Existing code touched:** none (new file only)
**Patterns to follow:** NASA app dark theme, card layout, bridge-sdk inlined, `__proxyResult` handler
**TDD:** no (HTML/UI — tested via E2E)
**Verification criteria:**
- [ ] `src/renderer/chatbridge/apps/google-books/index.html` exists
- [ ] Dark theme, 380px width, bridge-sdk.js inlined
- [ ] `onToolCall` handles all 5 tools via `__proxyResult`
- [ ] `search_books` renders book cards (thumbnail, title, authors, description)
- [ ] `get_book_details` expands a card with full info
- [ ] "Sign in with Google" banner visible at top
- [ ] "Add to shelf" buttons disabled when unauthenticated
- [ ] `auth_request` message sent when sign-in button clicked
- [ ] `auth_result` message handler updates UI state

#### Commit 1.2.1: Create Google Books app HTML
- [ ] Create `src/renderer/chatbridge/apps/google-books/index.html`
- [ ] Inline bridge-sdk.js (copy from weather app pattern)
- [ ] Implement: auth banner, search results section, bookshelf tabs section (hidden until auth)
- [ ] Tool handlers: check `__proxyResult`, render cards
- [ ] Auth UI: sign-in button sends `auth_request`, listens for `auth_result`
- [ ] Verify: file loads without JS errors when opened directly

### PR 1.3: E2E tests for search flow
**Branch:** `sprint-1/search-e2e`
**Depends on:** PR 1.1 + PR 1.2
**Existing code touched:** none (new test files only)
**Patterns to follow:** Weather E2E pattern — mockOpenAIStream, login, sendChatMessage, waitForPanel
**TDD:** no (E2E written after feature)
**Verification criteria:**
- [ ] Search flow: open app → search books → book cards render in iframe
- [ ] Auth-required flow: call add_to_shelf → LLM receives auth_required → tells user to sign in
- [ ] Mock fallback: search works without API key (mock data renders)
- [ ] Regression: existing E2E tests still pass

#### Commit 1.3.1: Write Google Books E2E tests
- [ ] Create `tests/e2e/app-flows/google-books.spec.ts`
- [ ] Test 1: Search — mock LLM calls open_app + search_books, intercept googleapis route, verify panel + cards
- [ ] Test 2: Auth required — mock LLM calls add_to_shelf, verify auth_required in response
- [ ] Test 3: Mock fallback — no API key, search still returns mock books
- [ ] Verify: `npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/app-flows/google-books.spec.ts`

**Sprint 1 gate:**
- [ ] `pnpm test -- --testPathPattern=chatbridge` — all tests pass
- [ ] `npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/app-flows/google-books.spec.ts` — all pass
- [ ] Regression: `npx playwright test --config=tests/e2e/playwright.config.ts` — pre-existing passing tests still pass

---

## Sprint 2: OAuth Implementation

**Objective:** Wire up full OAuth2 PKCE flow — popup, callback, token exchange, Supabase storage, token refresh, bookshelf tools.

**Human steps required before Sprint 2:**
1. Register Google Cloud project + OAuth consent screen (testing mode)
2. Create OAuth 2.0 credentials (Web application, redirect URI: `http://localhost:3000/auth/callback.html`)
3. Enable Google Books API in the project
4. Add to `.env`: `VITE_GOOGLE_BOOKS_API_KEY=...` and `VITE_GOOGLE_BOOKS_CLIENT_ID=...`

### PR 2.1: Supabase migration — seed app_registry + insert google-books
**Branch:** `sprint-2/supabase-migration`
**Depends on:** Sprint 1 complete
**Existing code touched:** `supabase/migrations/` (new migration file)
**TDD:** no (SQL migration)
**Verification criteria:**
- [ ] New migration file inserts google-books into `app_registry` table
- [ ] Migration also inserts existing enabled apps (chess, weather, nasa, flashforge, contract-test) so FK constraint works for future apps
- [ ] `user_app_tokens` INSERT with `app_id = 'google-books'` succeeds (FK satisfied)
- [ ] Migration is idempotent (INSERT ... ON CONFLICT DO NOTHING)

#### Commit 2.1.1: Create app_registry seed migration
- [ ] Create `supabase/migrations/20260405000000_seed_app_registry.sql`
- [ ] INSERT all enabled apps from apps.json into app_registry (id, name, description, type, tools, entrypoint, auth_config, enabled)
- [ ] Use ON CONFLICT (id) DO NOTHING for idempotency
- [ ] Verify: `supabase db reset` succeeds (if local Supabase available), or verify SQL is syntactically valid

### PR 2.2: OAuth core — PKCE, token exchange, refresh, callback page
**Branch:** `sprint-2/oauth-core`
**Depends on:** PR 2.1
**Existing code touched:** `bridge.ts` (add message type constants)
**Patterns to follow:** Design spec Section 3 (OAuth popup flow sequence)
**TDD:** yes
**Verification criteria:**
- [ ] `generateCodeVerifier()` returns 43-128 char random string
- [ ] `generateCodeChallenge(verifier)` returns correct base64url SHA-256
- [ ] `exchangeCodeForTokens(code, verifier, clientId, redirectUri)` calls Google token endpoint, returns tokens with computed `expires_at = Date.now() + expires_in * 1000`
- [ ] `refreshAccessToken(refreshToken, clientId)` calls Google refresh endpoint, returns new access token with computed `expires_at`
- [ ] Refresh mutex: concurrent refresh calls share same promise
- [ ] PKCE state map: stores and retrieves verifier by state, cleans up after 5 min
- [ ] Error handling: exchange failure, refresh failure, invalid state
- [ ] `oauth-callback.html` extracts code+state from URL, posts to opener, handles errors
- [ ] `bridge.ts` has `auth_request` and `auth_result` in message type constants

#### Commit 2.2.1: Write oauth.ts unit tests
- [ ] Create `src/renderer/chatbridge/__tests__/oauth.test.ts`
- [ ] Test PKCE: verifier length, challenge computation (known test vector)
- [ ] Test token exchange: mock fetch, verify request body, handle success + failure
- [ ] Test refresh: mock fetch, verify grant_type=refresh_token, handle success + failure + 401
- [ ] Test mutex: two concurrent refreshes resolve to same token
- [ ] Test state map: store, retrieve, TTL cleanup
- [ ] Test `deleteToken`: mock Supabase delete, verify called with correct user_id + app_id
- [ ] Verify: tests fail (TDD red)

#### Commit 2.2.2: Implement oauth.ts
- [ ] Create `src/renderer/chatbridge/oauth.ts`
- [ ] `generateCodeVerifier()`: crypto.getRandomValues, base64url encode
- [ ] `generateCodeChallenge(verifier)`: SHA-256 via SubtleCrypto, base64url encode
- [ ] `startOAuthFlow(appId)`: read authConfig, generate PKCE, store in stateMap, build auth URL, return URL
- [ ] `exchangeCodeForTokens(code, verifier, authConfig, redirectUri)`: POST to tokenUrl
- [ ] `refreshAccessToken(refreshToken, authConfig)`: POST with grant_type=refresh_token
- [ ] `getOrRefreshToken(appId)`: check Supabase, refresh if expired, mutex
- [ ] `storeToken(userId, appId, tokens)`: upsert into user_app_tokens
- [ ] `deleteToken(userId, appId)`: delete row (for revocation)
- [ ] Export `stateMap` for callback handler, `refreshInProgress` for mutex
- [ ] Verify: tests pass (TDD green)

#### Commit 2.2.3: Build oauth-callback.html
- [ ] Replace placeholder in `src/renderer/chatbridge/oauth-callback.html` with real implementation
- [ ] Extract `code`, `state`, `error` from `URLSearchParams`
- [ ] If `window.opener`: post `{type: 'oauth_callback', code, state}` or `{type: 'oauth_callback', error}`
- [ ] If no opener: show "please close this tab" message
- [ ] Auto-close via `window.close()` after posting
- [ ] Verify: open file directly in browser, see fallback message

#### Commit 2.2.4: Update bridge.ts message type constants
- [ ] Add `'auth_request'` to `IFRAME_MESSAGE_TYPES`
- [ ] Add `'auth_result'` to `HOST_MESSAGE_TYPES`
- [ ] Verify: existing bridge tests still pass

### PR 2.3: SidePanel OAuth wiring — popup + callback handling
**Branch:** `sprint-2/sidepanel-oauth`
**Depends on:** PR 2.2
**Existing code touched:** `SidePanel.tsx` (add listeners in effect block around line 79-100)
**Patterns to follow:** Existing message listener pattern in SidePanel
**TDD:** yes
**Verification criteria:**
- [ ] `auth_request` from iframe triggers `startOAuthFlow()` → `window.open()` with Google auth URL
- [ ] `oauth_callback` from popup triggers `exchangeCodeForTokens()` → stores in Supabase → sends `auth_result` to iframe
- [ ] Popup blocked detection: `window.open()` returns null → sends `auth_result` with error
- [ ] Consent denied: callback posts error → sends `auth_result` with error
- [ ] Token exchange failure → sends `auth_result` with error
- [ ] Regression: existing message handling (app_init, tool_call) unaffected

#### Commit 2.3.1: Write SidePanel OAuth tests
- [ ] Test auth_request handling: mock postMessage from iframe, verify window.open called with correct URL
- [ ] Test oauth_callback handling: mock postMessage from popup, verify exchangeCodeForTokens called
- [ ] Test error paths: popup blocked, consent denied, exchange failure
- [ ] Verify: tests fail (TDD red)

#### Commit 2.3.2: Implement SidePanel OAuth listeners
- [ ] In SidePanel.tsx effect block (~line 79):
  - Add `auth_request` handler on bridge message listener: call `startOAuthFlow(appId)`, `window.open(authUrl)`
  - Add `window.addEventListener('message')` for `oauth_callback`: validate state, exchange code, store token, send `auth_result` to iframe
- [ ] **Note:** `oauth_callback` uses raw `postMessage` (NOT BridgeMessage) — the popup does not use bridge-sdk. Validate by checking `event.data.type === 'oauth_callback'` and looking up `state` in PKCE map. Do NOT route through bridge.
- [ ] Import `startOAuthFlow`, `exchangeCodeForTokens`, `storeToken` from oauth.ts
- [ ] Cleanup: remove window listener on unmount
- [ ] Verify: tests pass (TDD green)

### PR 2.4: tool-router OAuth code path — token lookup + bookshelf proxy
**Branch:** `sprint-2/oauth-toolrouter`
**Depends on:** PR 2.2 (oauth.ts), PR 2.1 (migration)
**Existing code touched:** `tool-router.ts` (modify oauth2_pkce branch from Sprint 1)
**Patterns to follow:** Existing proxy pattern + Bearer token header
**TDD:** yes
**Verification criteria:**
- [ ] OAuth tools with valid token: host fetches Google API with Bearer header, returns result
- [ ] `get_reading_list` shelf="all" makes 3 parallel requests, merges results
- [ ] `add_to_shelf` handles 204 response, synthesizes `{success, shelfName, bookTitle}`
- [ ] `remove_from_shelf` handles 204 response, returns `{success: true}`
- [ ] Expired token: triggers refresh, retries with new token
- [ ] Refresh failure: deletes token, returns `auth_required`
- [ ] `__proxyResult` forwarded to iframe for all OAuth tools
- [ ] Regression: search_books and get_book_details still work unchanged

#### Commit 2.4.1: Write OAuth tool-router tests
- [ ] Test `get_reading_list` with mocked fetch + mocked Supabase token lookup
- [ ] Test `add_to_shelf` with 204 response → synthesized result
- [ ] Test `remove_from_shelf` with 204 response
- [ ] Test expired token → refresh → retry
- [ ] Test refresh failure → auth_required
- [ ] Test shelf enum → numeric ID mapping
- [ ] Verify: tests fail (TDD red)

#### Commit 2.4.2: Implement OAuth tool-router code path
- [ ] Replace `auth_required` stub from Sprint 1 with real logic:
  - Call `getOrRefreshToken('google-books')` from oauth.ts
  - If no token → return auth_required (unchanged)
  - If token → call Google API with `Authorization: Bearer {token}`
- [ ] Implement `get_reading_list`: shelf mapping, parallel fetch for "all", response mapping
- [ ] Implement `add_to_shelf`: POST with volumeId, handle 204, synthesize result
- [ ] Implement `remove_from_shelf`: POST with volumeId, handle 204
- [ ] Forward all results to iframe via `__proxyResult`
- [ ] Verify: tests pass (TDD green)

### PR 2.5: OAuth E2E tests
**Branch:** `sprint-2/oauth-e2e`
**Depends on:** PR 2.3 + PR 2.4
**Existing code touched:** `tests/e2e/app-flows/google-books.spec.ts` (extend from Sprint 1)
**Patterns to follow:** Existing E2E mock patterns
**TDD:** no (E2E)
**Verification criteria:**
- [ ] OAuth popup flow: mock window.open, simulate callback postMessage, verify token stored, iframe updated
- [ ] Bookshelf flow: with token pre-seeded, get_reading_list renders shelves, add_to_shelf shows confirmation
- [ ] Error: consent denied → iframe shows sign-in button
- [ ] Regression: Sprint 1 search tests still pass

#### Commit 2.5.1: Add OAuth E2E tests
- [ ] Extend `google-books.spec.ts` with:
  - Test: OAuth popup — mock window.open, fire oauth_callback postMessage, intercept token endpoint, verify auth_result sent to iframe
  - Test: Bookshelf — pre-seed token via mocked Supabase, mock LLM calls get_reading_list, verify shelf data renders
  - Test: Add to shelf — mock LLM calls add_to_shelf, intercept Google API (204), verify confirmation
  - Test: Consent denied — callback posts error, verify iframe shows sign-in
  - Test: Callback page — navigate to `/auth/callback.html?code=test&state=test` directly, verify it posts correct `{type: 'oauth_callback', code, state}` shape to opener (or shows fallback if no opener)
- [ ] Verify: all google-books E2E tests pass

**Sprint 2 gate:**
- [ ] `pnpm test -- --testPathPattern=chatbridge` — all tests pass
- [ ] `npx playwright test --config=tests/e2e/playwright.config.ts tests/e2e/app-flows/google-books.spec.ts` — all pass
- [ ] Regression: `npx playwright test --config=tests/e2e/playwright.config.ts` — pre-existing passing tests still pass
- [ ] Full OAuth flow works with real Google credentials (manual verification with env vars set)

---

## Dependency Graph

```
Sprint 0:
  PR 0.1 (tracer bullet)

Sprint 1:
  PR 1.1 (search proxy)      ← depends on PR 0.1
  PR 1.2 (search UI)         ← depends on PR 0.1 (parallel with PR 1.1)
  PR 1.3 (search E2E)        ← depends on PR 1.1 + PR 1.2

Sprint 2:
  PR 2.1 (Supabase migration) ← depends on Sprint 1 gate
  PR 2.2 (OAuth core)         ← depends on Sprint 1 gate (parallel with PR 2.1)
  PR 2.3 (SidePanel wiring)   ← depends on PR 2.2
  PR 2.4 (tool-router OAuth)  ← depends on PR 2.2 + PR 2.1
  PR 2.5 (OAuth E2E)          ← depends on PR 2.3 + PR 2.4
```

## Parallelization Summary

| Sprint | Parallel Set | PRs | Why Parallel |
|--------|-------------|-----|-------------|
| 0 | — | PR 0.1 | Single PR, foundation |
| 1 | Set A | PR 1.1 + PR 1.2 | Authored in parallel; PR 1.2 merged after PR 1.1 (runtime dependency) |
| 1 | Set B | PR 1.3 | Needs both 1.1 + 1.2 merged |
| 2 | Set A | PR 2.1 + PR 2.2 | Migration and OAuth core are independent |
| 2 | Set B | PR 2.3 + PR 2.4 | Both need PR 2.2; PR 2.4 also needs PR 2.1 (asymmetric deps, but neither blocks the other) |
| 2 | Set C | PR 2.5 | Needs all Sprint 2 PRs merged |

**Max parallel agents:** 2 (Sprint 1 Set A, Sprint 2 Set A and Set B)

---

## Existing System Analysis

**Architecture:** Electron + Vite + React + Jotai. Apps in sandboxed iframes, bridge-sdk postMessage.
**Test infrastructure:** Vitest (192 chatbridge unit tests), Playwright (23 E2E). Mock LLM via page.route.
**Conventions:** Single HTML apps, dark theme, __proxyResult, mock fallback.
**Areas touched:** tool-router.ts, SidePanel.tsx, bridge.ts, apps.json, electron.vite.config.ts, supabase migrations.
**Verified user flows:** Static analysis only (no live environment explored).

**Risks:**
1. `app_registry` FK constraint — user_app_tokens.app_id references app_registry. Need migration to seed it. (Addressed in PR 2.1)
2. 7 pre-existing test failures — baseline before our changes. Don't fix these, but don't add new failures.
3. Vite plugin only serves `/apps/*` — extending for `/auth/callback.html` in PR 0.1.
4. No live environment verification — runtime behavior unverified. Mitigated by comprehensive E2E mocks.
