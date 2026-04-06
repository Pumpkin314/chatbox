# Google Books OAuth — Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Approach:** Layered sprints — search first (Sprint 2), then OAuth (Sprint 3)
**Branch:** `feat/google-books-oauth` (worktree)

---

## Overview

Google Books is a Tier 4 (`external_authenticated`) ChatBridge app providing AI-powered book search and personal reading list management for K-12 students. Search uses an API key (no auth). Bookshelf management uses Google OAuth2 PKCE via a host-mediated popup flow.

**5 tools:** `search_books`, `get_book_details` (API key), `get_reading_list`, `add_to_shelf`, `remove_from_shelf` (OAuth2).

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth-required tool visibility | Always visible, return `auth_required` error | Simplest — no changes to tool gating. LLM relays auth message to user. |
| Callback page | Static HTML at `/auth/callback.html` | No server-side changes. Works in dev and Electron. |
| tool-router extension | Add if/else branch, defer dispatch refactor | YAGNI — 4 integrations doesn't justify refactor risk. |
| Token storage | Supabase `user_app_tokens`, no in-memory cache | Consistent state, simple code. DB round-trip negligible vs Google API call. |
| Token refresh | Check `expires_at` before API call, mutex for concurrent refresh | Transparent to user. Mutex prevents duplicate refresh calls. |
| `__proxyResult` for OAuth tools | Yes, same as weather/NASA | Iframe renders host-fetched data. Consistent pattern. |
| Sandbox attributes | Unchanged (`allow-scripts allow-forms`) | Host opens popup, not iframe. No `allow-popups` needed. |
| Implementation strategy | Layered sprints (B) | Incremental delivery with abort points. Search validates plumbing before OAuth. |

---

## 1. Registry & Tool Schema

Register in `apps.json` as specified in the skeleton spec. All 5 tools visible after `open_app`. The registry entry is exactly:

```json
{
  "id": "google-books",
  "name": "Reading Assistant",
  "description": "Search books and manage your reading list with Google Books",
  "type": "external_authenticated",
  "tools": [
    {"name": "search_books", "description": "Search for books by topic, author, or title", "parameters": {"type": "object", "properties": {"query": {"type": "string"}, "maxResults": {"type": "number", "default": 5}}, "required": ["query"]}},
    {"name": "get_book_details", "description": "Get detailed information about a book", "parameters": {"type": "object", "properties": {"volume_id": {"type": "string"}}, "required": ["volume_id"]}},
    {"name": "get_reading_list", "description": "Get the student's reading list from Google Books", "parameters": {"type": "object", "properties": {"shelf": {"type": "string", "enum": ["to_read", "reading_now", "have_read", "all"], "default": "all"}}}},
    {"name": "add_to_shelf", "description": "Add a book to a reading list shelf", "parameters": {"type": "object", "properties": {"volume_id": {"type": "string"}, "shelf": {"type": "string", "enum": ["to_read", "reading_now", "have_read"]}}, "required": ["volume_id", "shelf"]}},
    {"name": "remove_from_shelf", "description": "Remove a book from a shelf", "parameters": {"type": "object", "properties": {"volume_id": {"type": "string"}, "shelf": {"type": "string", "enum": ["to_read", "reading_now", "have_read"]}}, "required": ["volume_id", "shelf"]}}
  ],
  "entrypoint": "/apps/google-books/index.html",
  "authConfig": {
    "type": "oauth2_pkce",
    "provider": "google",
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth",
    "tokenUrl": "https://oauth2.googleapis.com/token",
    "clientIdEnvVar": "VITE_GOOGLE_BOOKS_CLIENT_ID",
    "scopes": ["https://www.googleapis.com/auth/books"]
  },
  "enabled": true
}
```

**Tool-level auth gating:** `tool-router.ts` hardcodes which tools require OAuth:

```typescript
const OAUTH_REQUIRED_TOOLS = new Set(['get_reading_list', 'add_to_shelf', 'remove_from_shelf'])
```

If the tool requires auth and no valid token exists → return `{error: "auth_required", message: "Please sign in with Google to manage your reading list"}`.

---

## 2. Host-Proxied API Calls (Search)

Same pattern as weather/NASA. New if/else branches in `executeHostProxiedTool()`.

**`search_books`:**
```
GET https://www.googleapis.com/books/v1/volumes?q={query}&maxResults={maxResults}&key={apiKey}
```
Parse `items[]` → map to `{id, title, authors, thumbnail, pageCount, description}`.

**`get_book_details`:**
```
GET https://www.googleapis.com/books/v1/volumes/{volumeId}?key={apiKey}
```
Parse `volumeInfo` → return `{title, authors, description, pageCount, categories, previewLink, thumbnail}`.

**Return shape:** `search_books` returns `{books: [{id, title, authors, thumbnail, pageCount, description}]}` (wrapped in `books` array). `get_book_details` returns the flat object.

**Mock fallback:** When `VITE_GOOGLE_BOOKS_API_KEY` is missing, return 3 hardcoded book objects in the same shape.

**Result forwarding:** Both tools forward results to iframe via `__proxyResult`.

### Host-Proxied API Calls (OAuth — Bookshelf Tools)

All three OAuth tools are also host-proxied. The iframe never receives or stores tokens. The host retrieves the access token from Supabase, makes the Google API call with a `Bearer` header, and forwards the result to the iframe via `__proxyResult`.

**`get_reading_list`:**
- If `shelf` is a specific shelf: `GET https://www.googleapis.com/books/v1/mylibrary/bookshelves/{shelfId}/volumes` with `Authorization: Bearer {token}`
- If `shelf` is `"all"`: make 3 parallel requests for shelves 2, 3, and 4. Merge results into `{shelves: [{name, id, books: [...]}]}`.
- Shelf enum → ID mapping: `to_read=2, reading_now=3, have_read=4`

**`add_to_shelf`:**
```
POST https://www.googleapis.com/books/v1/mylibrary/bookshelves/{shelfId}/addVolume?volumeId={volume_id}
Authorization: Bearer {token}
```
Returns 204 No Content. Synthesize result: `{success: true, shelfName, bookTitle}` (bookTitle from a follow-up `GET /volumes/{id}` or cached from prior search).

**`remove_from_shelf`:**
```
POST https://www.googleapis.com/books/v1/mylibrary/bookshelves/{shelfId}/removeVolume?volumeId={volume_id}
Authorization: Bearer {token}
```
Returns 204 No Content. Synthesize result: `{success: true}`.

---

## 3. OAuth Popup Flow

Host-mediated OAuth. The iframe never touches Google directly.

### Sequence

```
 1. LLM calls add_to_shelf
 2. tool-router checks for token in Supabase → not found
 3. Returns {error: "auth_required", message: "Sign in with Google..."}
 4. LLM relays to user
 5. User clicks "Sign in with Google" button in iframe
 6. Iframe sends postMessage: {type: "auth_request", payload: {provider: "google", appId: "google-books"}}
 7. SidePanel.tsx receives auth_request → calls startOAuthFlow(appId)
 8. startOAuthFlow():
    a. Reads authConfig from registry (authUrl, clientIdEnvVar, scopes)
    b. Generates PKCE code_verifier (random 43-128 char string)
    c. Computes code_challenge = base64url(SHA-256(code_verifier))
    d. Generates state = crypto.randomUUID()
    e. Stores {state → code_verifier, appId} in in-memory Map
    f. Opens popup via window.open(authUrl + params)
 9. User consents in Google popup
10. Google redirects popup to http://localhost:3000/auth/callback.html?code=ABC&state=XYZ
11. Callback page extracts code + state, posts to opener:
    window.opener.postMessage({type: "oauth_callback", code, state}, "*")
    Closes itself.
12. Host receives oauth_callback:
    a. Looks up state in Map → gets code_verifier + appId
    b. POST https://oauth2.googleapis.com/token with {code, client_id, redirect_uri, grant_type, code_verifier}
    c. Receives {access_token, refresh_token, expires_in}
    d. Stores in Supabase user_app_tokens
    e. Removes state from Map
    f. Sends postMessage to iframe: {type: "auth_result", payload: {success: true, provider: "google"}}
13. Iframe updates UI: hides sign-in button, shows "Signed in ✓"
14. Next OAuth tool call → token found → proceeds with Bearer token
```

### Error Paths

- **Consent denied:** Google redirects with `?error=access_denied` → callback posts error → host sends `{type: "auth_result", payload: {success: false, error: "access_denied"}}` → iframe shows sign-in button again.
- **Popup blocked:** `window.open()` returns null → host sends `{type: "auth_result", payload: {success: false, error: "popup_blocked"}}` → iframe shows "Please allow popups" message.
- **Token exchange fails:** Host sends `auth_result` with `success: false`.

### PKCE Details

- `code_verifier`: 43-128 character random string (RFC 7636)
- `code_challenge`: `base64url(SHA-256(code_verifier))`
- `code_challenge_method`: `S256`
- Stored in `Map<state, {verifier, appId}>` with 5-minute TTL cleanup

### Message Protocol Clarification

Three new message types are introduced. They use different protocols:

| Message | Direction | Protocol | Notes |
|---------|-----------|----------|-------|
| `auth_request` | Iframe → Host | BridgeMessage (has `id`, `timestamp`) | Sent via `ChatBridge.send()` through the existing bridge |
| `auth_result` | Host → Iframe | BridgeMessage (has `id`, `timestamp`) | Sent via `bridge.sendMessage()` to iframe |
| `oauth_callback` | Popup → Host | Raw `postMessage` (no `id`, no `timestamp`) | The popup does NOT use bridge-sdk.js. It sends a plain `{type, code, state}` object. The host listener for this message is on `window` (not the iframe bridge), and validates by checking `type === 'oauth_callback'` and looking up `state` in the PKCE map. |

The plugin contract is not modified — `auth_request`/`auth_result` are implementation-level messages for the OAuth subsystem, not part of the general bridge protocol.

---

## 4. Token Storage & Refresh

**Storage:** Supabase `user_app_tokens` table: `(user_id, app_id, access_token, refresh_token, expires_at)`.

**Lookup before OAuth API calls:**
1. Query `user_app_tokens` for `(current_user_id, "google-books")`
2. No row → return `auth_required`
3. `expires_at > now + 60s` → use `access_token`
4. Expired → refresh

**Refresh flow:**
1. `POST https://oauth2.googleapis.com/token` with `{grant_type: "refresh_token", refresh_token, client_id}`
2. Google returns `{access_token, expires_in}` (refresh_token unchanged)
3. Update Supabase row
4. If refresh fails (400/401) → delete row → return `auth_required`

**Concurrent refresh mutex:**

```typescript
const refreshInProgress = new Map<string, Promise<string>>()
```

If refresh already in-progress for an app, second caller awaits the same promise.

---

## 5. Google Books Iframe App

Single HTML file: `src/renderer/chatbridge/apps/google-books/index.html`. Dark theme matching weather/NASA. 380px width. `bridge-sdk.js` inlined.

### UI States

- **Initial:** Search section visible. "Sign in with Google" banner at top (if unauthenticated). Search works without auth.
- **Authenticated:** Banner replaced with "Signed in ✓". Bookshelf tabs appear below search.
- **Auth tracked in-memory:** Boolean `isAuthenticated`, set via `auth_result` message from host.

### Layout

- **Top:** Conditional auth banner
- **Middle:** Book cards — thumbnail left, title/author/page count right. Truncated description. "Add to shelf" dropdown on each card (disabled if unauthenticated).
- **Bottom:** Tabbed bookshelf view (To Read / Reading Now / Have Read) — shown after auth.

### Tool Handlers

All 5 tools check `params.__proxyResult` first (host already fetched data):

- `search_books` → render book cards
- `get_book_details` → expand card with full description
- `get_reading_list` → populate bookshelf tabs
- `add_to_shelf` → flash confirmation, refresh shelf view
- `remove_from_shelf` → remove card from shelf, flash confirmation

### Auth Flow Trigger

- User clicks "Sign in with Google" button in iframe
- Button calls `ChatBridge.send('auth_request', {provider: 'google', appId: 'google-books'})` — this sends a postMessage to the host
- **The host (SidePanel.tsx) calls `window.open()` to open the Google consent popup.** The iframe never opens a popup — `allow-popups` is not in the sandbox. The popup is opened from host context.
- On receiving `auth_result` message (host → iframe via postMessage) with `success: true` → `isAuthenticated = true`, update UI

### State Resilience

No localStorage (sandbox blocks it). If iframe reloads, auth UI state resets — but Supabase still has the token, so next OAuth tool call works seamlessly.

---

## 6. OAuth Callback Page

`src/renderer/chatbridge/oauth-callback.html` — ~30 lines of HTML/JS. Copied to build output at `/auth/callback.html` by the Vite copy plugin (same plugin that copies app HTML files, configured in `electron.vite.config.ts`). The source path is `src/renderer/chatbridge/oauth-callback.html` and the output path is `dist/auth/callback.html`, served at `http://localhost:3000/auth/callback.html` in dev.

**Behavior:**
1. Extracts `code` and `state` (or `error`) from URL query params
2. Posts to opener: `window.opener.postMessage({type: 'oauth_callback', code, state}, '*')`
3. Shows "Signing in..." then closes via `window.close()`
4. If `error` param → posts `{type: 'oauth_callback', error}` instead

**Edge cases:**
- `window.opener` is null → show "This page should be opened automatically. Please close this tab."
- No `code` or `error` → show generic error

**Redirect URI in Google Cloud Console:** `http://localhost:3000/auth/callback.html`

---

## 7. Testing Strategy

### Unit Tests (Vitest)

**`oauth.test.ts`:** PKCE helpers (verifier generation, challenge computation), token exchange (mock fetch), token refresh, mutex behavior, error paths (consent denied, exchange failure, refresh failure).

**`tool-router.test.ts` additions:** Google Books search proxy (API key), OAuth tools with valid token, OAuth tools with no token (auth_required), OAuth tools with expired token (triggers refresh), mock data fallback.

**`google-books.test.ts`:** Response shape mapping from Google API format to tool schema, mock data fallback when API key missing.

### E2E Tests (Playwright)

**`google-books.spec.ts`:**

1. **Search flow:** Mock LLM calls `open_app` → `search_books`. Intercept `googleapis.com/books/v1/volumes` with mock response. Verify book cards render in iframe.
2. **Auth-required flow:** Mock LLM calls `add_to_shelf` → verify LLM receives `auth_required` error → mock LLM tells user to sign in.
3. **OAuth popup flow:** Mock `window.open()` on the page. Simulate callback via `postMessage({type: 'oauth_callback', code, state})`. Intercept Google token endpoint. Verify token stored. Verify iframe receives `auth_result`.
4. **Bookshelf flow (post-auth):** With token pre-seeded in mocked Supabase, mock LLM calls `get_reading_list` → verify shelf data renders. Mock `add_to_shelf` → verify success.

**Mock patterns:**
- `page.route('**/googleapis.com/books/**')` — mock Google Books API
- `page.route('**/oauth2.googleapis.com/token**')` — mock token exchange
- `page.evaluate(() => window.open = ...)` — intercept popup creation
- Existing Supabase auth mocking reused from `chat-harness.ts`

---

## 8. File Inventory

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/chatbridge/oauth.ts` | PKCE helpers, startOAuthFlow, handleOAuthCallback, exchangeCodeForTokens, refreshToken, mutex. **Note:** `auth.ts` already exists for Supabase user auth (session atoms, sign-in/sign-out). `oauth.ts` is app-level OAuth for third-party providers — distinct concern. |
| `src/renderer/chatbridge/oauth-callback.html` | Minimal popup callback page (~30 lines) |
| `src/renderer/chatbridge/apps/google-books/index.html` | Iframe app — search UI, bookshelf tabs, auth banner |
| `src/renderer/chatbridge/__tests__/oauth.test.ts` | OAuth unit tests |
| `src/renderer/chatbridge/apps/google-books/__tests__/google-books.test.ts` | App-specific unit tests |
| `tests/e2e/app-flows/google-books.spec.ts` | Playwright E2E tests |

### Modified Files

| File | Change |
|------|--------|
| `src/renderer/chatbridge/registry/apps.json` | Add google-books entry |
| `src/renderer/chatbridge/tool-router.ts` | Add `oauth2_pkce` code path, Google Books API proxy branches, token check/refresh |
| `src/renderer/components/chatbridge/SidePanel.tsx` | Add `auth_request` listener (from iframe), `oauth_callback` listener (from popup) |
| `src/renderer/chatbridge/bridge.ts` | Add `auth_request`, `auth_result` to message type constants |
| Vite config / copy plugin | Add `oauth-callback.html` → `dist/auth/callback.html` mapping |

### Not Modified

- `bridge-sdk.js` — existing `ChatBridge.send()` supports custom types
- `docs/plugin-contract.md` — frozen
- Iframe sandbox attribute — unchanged

---

## 9. Sprint Structure

### Sprint 2: Search Only (API Key, No OAuth)

1. Register google-books in `apps.json`
2. Add search/details proxy branches in `tool-router.ts`
3. Build iframe app with search UI and book cards
4. Mock data fallback
5. Unit + E2E tests for search flow
6. **Deliverable:** Working app with search. Registry uses `external_authenticated` with `oauth2_pkce` from day one (not temporarily `external_public`). OAuth tools are registered but return `auth_required` until Sprint 3 wires up the token flow.

### Sprint 3: OAuth Implementation

1. Build `oauth.ts` (PKCE, token exchange, refresh, mutex)
2. Build `oauth-callback.html`
3. Add `auth_request` / `oauth_callback` listeners in `SidePanel.tsx`
4. Add OAuth code path in `tool-router.ts` (token lookup, refresh, Bearer header)
5. Add bookshelf UI to iframe (tabs, add/remove buttons)
6. Update bridge.ts message type constants
7. Vite config: copy callback page
8. Unit + E2E tests for OAuth and bookshelf flows
9. **Deliverable:** Full Tier 4 app with real Google OAuth.

### Human Steps (Before Sprint 3)

- Register Google Cloud project
- Create OAuth consent screen (testing mode, 100 users)
- Create OAuth 2.0 credentials (Web application type)
- Set redirect URI: `http://localhost:3000/auth/callback.html`
- Add to `.env`:
  ```
  VITE_GOOGLE_BOOKS_API_KEY=<your-api-key>
  VITE_GOOGLE_BOOKS_CLIENT_ID=<your-client-id>
  ```

---

## 10. External Services & Integration Points

| Service | Purpose | Resilience Notes |
|---------|---------|-----------------|
| Google Books API (`googleapis.com/books/v1`) | Book search and bookshelf management | Mock fallback for search. Auth-required tools fail gracefully. |
| Google OAuth2 (`accounts.google.com`, `oauth2.googleapis.com`) | User authentication | Popup flow with error handling for denial/blocking. |
| Supabase (`user_app_tokens` table) | Token persistence | If unreachable, OAuth tool calls fail with error. No silent fallback. |

---

## Appendix: Google Bookshelves

| Shelf Name | Numeric ID | Tool Enum Value |
|-----------|-----------|-----------------|
| To Read | 2 | `to_read` |
| Reading Now | 3 | `reading_now` |
| Have Read | 4 | `have_read` |

`addVolume` and `removeVolume` return 204 No Content. Tool results are synthesized:
- `add_to_shelf` returns `{success: true, shelfName, bookTitle}` (bookTitle from prior search context or a follow-up GET)
- `remove_from_shelf` returns `{success: true}`
