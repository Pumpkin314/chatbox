# Plan 2: Google Books OAuth — Skeleton Spec

**Date:** 2026-04-05 (skeleton), to be updated after Plan 1 Sprint 1 completes
**Type:** Brownfield — separate CC session, user-driven interactive
**Goal:** Add a Google Books app with real OAuth2 authentication, demonstrating the Tier 3 (external_authenticated) integration pattern.
**Branch:** `feat/google-books-oauth` (worktree)

---

## Status: SKELETON

This spec is intentionally incomplete. It will be updated with fresh codebase context after Plan 1 Sprint 1 finishes. The following sections are stable. Sections marked **[UPDATE AFTER P1S1]** need fresh data.

---

## Why This Is Separate

OAuth2 in a sandboxed iframe is the single riskiest piece of this project. Peers have warned it's painful. This plan isolates that risk into a dedicated CC session where:
- Context is singular and focused (no distraction from other app work)
- The user drives interactively (not backgrounded — too unpredictable)
- Research comes before code (Sprint 1 is pure research)
- Verification is extremely careful and well-grounded

---

## What This App Does

**Google Books** — an AI-powered reading assistant for K-12 students.

- **Search books** by topic, author, reading level (API key, no OAuth needed)
- **Manage personal reading list** via Google Bookshelves (requires Google OAuth2):
  - "To Read", "Reading Now", "Have Read" shelves (pre-built by Google)
  - Add/remove books from shelves
  - View current reading list

**Educational value:** Book discovery tied to curriculum topics. Teacher says "we're studying the solar system" → student asks chatbot → chatbot searches books → student adds to reading list → chatbot tracks progress.

**Chatbot interaction:**
- "Find me books about dinosaurs" → `search_books("dinosaurs")` → panel shows book cards
- "Add that one to my reading list" → OAuth popup if not authenticated → `add_to_shelf(volumeId, "To Read")`
- "What's on my reading list?" → `get_reading_list()` → panel shows saved books
- "I finished reading it" → chatbot calls `remove_from_shelf(volumeId, "reading_now")` then `add_to_shelf(volumeId, "have_read")` (two-call pattern, no compound tool needed)

---

## Google Books API Details

**Base URL:** `https://www.googleapis.com/books/v1`

**Endpoints needed:**
- `GET /volumes?q={query}` — search (API key only)
- `GET /volumes/{volumeId}` — book details (API key only)
- `GET /mylibrary/bookshelves` — list user's shelves (OAuth2)
- `GET /mylibrary/bookshelves/{shelfId}/volumes` — list books on shelf (OAuth2)
- `POST /mylibrary/bookshelves/{shelfId}/addVolume?volumeId={id}` — add book (OAuth2)
- `POST /mylibrary/bookshelves/{shelfId}/removeVolume?volumeId={id}` — remove book (OAuth2)

**Auth:**
- API key for public search: `VITE_GOOGLE_BOOKS_API_KEY`
- OAuth2 for personal bookshelves:
  - Scope: `https://www.googleapis.com/auth/books`
  - Auth URL: `https://accounts.google.com/o/oauth2/v2/auth`
  - Token URL: `https://oauth2.googleapis.com/token`
  - Client ID: from Google Cloud Console project
  - Flow: Authorization Code with PKCE (popup-based)

**Free tier:** ~1,000 requests/day, no credit card required for API key. OAuth requires Google Cloud project but no billing.

**Google Bookshelves (pre-built shelf IDs):**
- 0: Favorites
- 2: To Read
- 3: Reading Now
- 4: Have Read

---

## Tools (5)

| Tool | Parameters | Returns | Auth Required |
|------|-----------|---------|---------------|
| `search_books` | `query`, `maxResults?` | `{books: [{id, title, authors, thumbnail, pageCount, description}]}` | API key |
| `get_book_details` | `volume_id` | `{title, authors, description, pageCount, categories, previewLink, thumbnail}` | API key |
| `get_reading_list` | `shelf?` (default: all) | `{shelves: [{name, books: [...]}]}` | OAuth2 |
| `add_to_shelf` | `volume_id`, `shelf` | `{success, shelfName, bookTitle}` | OAuth2 |
| `remove_from_shelf` | `volume_id`, `shelf` | `{success}` | OAuth2 |

---

## Critical Codebase Facts

**Current sandbox value:** `sandbox="allow-scripts allow-forms"` in `SidePanel.tsx` line 196. This is the single most important constraint — no `allow-popups`, no `allow-same-origin`.

**No oauth.ts exists.** There is no OAuth stub anywhere in the codebase. The OAuth flow must be built from scratch.

**tool-router.ts only handles `api_key` auth type.** Line 81 checks `authConfig?.type === 'api_key'` and routes to `executeHostProxiedTool()`. There is NO code path for `oauth2_pkce`. This must be built from scratch.

**executeHostProxiedTool() is hardcoded to weather endpoints.** It only handles `get_weather` and `get_forecast` (lines 114-168). After P1S1, NASA endpoints will also be there. But the function is not generic — each API is a separate if/else branch. Google Books will need its own branch or a refactor to a dispatch pattern.

**Spotify's OAuth is entirely mock.** The Spotify app in `apps.json` is registered as `oauth2_pkce` but its implementation (`apps/spotify/index.html`) uses only hardcoded mock data with no actual OAuth flow. Do NOT study it as a reference for working OAuth — it will mislead you.

**bridge-sdk.js exists** at `src/renderer/chatbridge/bridge-sdk.js` and is the standard way apps communicate with the host. The Google Books app must use it.

## The OAuth-in-Iframe Challenge

### Known Issues to Research (Sprint 1)

1. **Popup from sandboxed iframe:** Current sandbox is `allow-scripts allow-forms` — popups are blocked. Need `allow-popups` and possibly `allow-popups-to-escape-sandbox`. What are the security implications for a K-12 platform?

2. **Redirect URI in popup:** Google OAuth redirects to a callback URL. In a popup spawned from a sandboxed iframe, where does the redirect go? Options:
   - Redirect to the platform host (platform captures the code, exchanges for token, sends to iframe via postMessage)
   - Redirect to a dedicated callback page that uses `window.opener.postMessage()` to send the token back
   - Platform-mediated flow: iframe asks platform to initiate OAuth, platform handles everything, sends token to iframe

3. **Token storage:** The `user_app_tokens` Supabase table exists but is unused. Tokens should be stored server-side (or in Supabase) and refreshed by the platform, not the iframe.

4. **Token refresh:** Google access tokens expire in 1 hour. The platform needs to refresh them transparently. The iframe can't call Google directly (sandbox CORS restrictions).

5. **Consent screen:** Google requires app verification for production. "Testing" mode allows 100 users — fine for demo. But the consent screen shows "unverified app" warning. Is this acceptable for the demo?

6. **CORS for API calls:** The iframe CANNOT call `googleapis.com` directly — sandbox is `allow-scripts allow-forms` without `allow-same-origin`, confirmed by the existing weather/NASA host-proxy pattern. All Google API calls MUST be proxied through the host via `tool-router.ts`. This is a known constraint, not a research question.

7. **PKCE code verifier/challenge:** OAuth2 PKCE requires generating a `code_verifier` (random string), computing a `code_challenge` (SHA-256 hash), sending the challenge in the auth URL, and including the verifier in the token exchange. The platform side must generate and store the verifier. This is non-trivial and must be understood before coding.

### Likely Architecture (To Be Validated)

```
Student clicks "Sign in with Google" in iframe
  → iframe sends postMessage to host: {type: 'auth_request', provider: 'google'}
  → host opens popup: accounts.google.com/o/oauth2/v2/auth?...
  → student authorizes in popup
  → popup redirects to platform callback URL
  → platform exchanges code for tokens, stores in Supabase user_app_tokens
  → platform sends token to iframe via postMessage: {type: 'auth_result', token: '...'}
  → iframe stores token in memory (not localStorage — sandbox blocks it)
  → subsequent API calls: iframe asks host to proxy with token
```

This is **platform-mediated OAuth** — the iframe never touches Google directly. This is more secure (aligns with the presearch's "platform-mediated auth over direct OAuth" principle) but requires more host-side code.

---

## Sprint Structure

### Sprint 1: Pure Research (No Code)

**Goal:** Answer every question above. Produce a go/no-go recommendation.

1. Research OAuth-in-iframe issues comprehensively (spawn research agents)
2. Test Google Books API manually with curl — verify endpoints, response shapes, shelf IDs
3. Set up Google Cloud Console project (OAuth consent screen, credentials)
4. Document the exact popup flow with sequence diagram
5. Identify which sandbox attributes are needed and their security implications
6. Test the popup flow in a minimal HTML page (outside of ChatBridge) to verify it works
7. Write research findings doc

**Deliverable:** Research doc with:
- Confirmed Google Books API behavior
- Tested OAuth popup flow (working or identified blockers)
- Recommended architecture for platform-mediated OAuth
- Go/no-go for Sprint 2

### Sprint 2: Foundation (Search Only, No OAuth)

**Goal:** Build the Google Books app with search functionality (API key only).

1. Create `apps/google-books/index.html` — book search UI, card layout
2. Register in `apps.json` with search tools only
3. Host-side proxy for Google Books API calls (same pattern as weather/NASA)
4. Verify against frozen plugin contract
5. Playwright tests for search flow

**Deliverable:** Working Tier 2 app with search. OAuth tools registered but returning "auth required" until Sprint 3.

### Sprint 3: OAuth Implementation

**Goal:** Wire up the full OAuth flow.

1. Implement platform-mediated OAuth popup flow
2. Token storage in Supabase `user_app_tokens`
3. Token refresh middleware
4. Bookshelf tools (add, list, remove)
5. Playwright tests for OAuth flow (mock Google in tests)
6. MCP Chrome verification of full flow

**Deliverable:** Full Tier 3 app with real Google OAuth.

---

## Codebase Context

### Key Files to Read First (Stable — read these before anything else)
- `src/renderer/chatbridge/registry/apps.json` — registry format, existing app entries
- `src/renderer/chatbridge/registry/index.ts` — TypeScript interfaces (note: `AuthConfig.type` is typed as `string`, not an enum)
- `src/renderer/chatbridge/tool-router.ts` — routing logic, host proxy pattern (weather-only), `api_key` auth handling
- `src/renderer/chatbridge/bridge-sdk.js` — standard iframe↔host communication SDK
- `src/renderer/components/chatbridge/SidePanel.tsx` — iframe sandbox attributes (line 196), bridge wiring
- `supabase/migrations/20260403021307_init.sql` — `user_app_tokens` table schema (exists but unused)
- `src/renderer/chatbridge/bridge.ts` — host-side postMessage protocol

### [UPDATE AFTER P1S1] Fresh Context
*Fill these in after Plan 1 Sprint 1 completes:*

#### Plugin Contract Reference
*Reference `docs/plugin-contract.md` once written. Until then, use `apps.json` format and bridge message types as the de facto contract.*

#### Lessons Learned from P1S1
*Any iframe quirks, sandbox surprises, or bridge issues discovered during Sprint 1.*

#### New Files Added
*NASA app, contract test app, Playwright infrastructure — list paths and relevant patterns.*

### Google Books API Response Notes
- `POST /mylibrary/bookshelves/{shelfId}/addVolume` returns `204 No Content` (not JSON). Tool return values (`{success, shelfName, bookTitle}`) must be synthesized by the implementation, not parsed from the API response.
- Same for `removeVolume` — `204 No Content`.

### Shelf ID Mapping
| Shelf Name | Numeric ID | Tool Enum Value |
|-----------|-----------|-----------------|
| Favorites | 0 | `favorites` |
| Purchased | 1 | (not used) |
| To Read | 2 | `to_read` |
| Reading Now | 3 | `reading_now` |
| Have Read | 4 | `have_read` |
| Reviewed | 5 | (not used) |
| Recently Viewed | 6 | (not used) |
| My eBooks | 7 | (not used) |
| Books For You | 8 | (not used) |

---

## Registry Entry (Final)

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
    {"name": "remove_from_shelf", "description": "Remove a book from a shelf", "parameters": {"type": "object", "properties": {"volume_id": {"type": "string"}, "shelf": {"type": "string"}}, "required": ["volume_id", "shelf"]}}
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
