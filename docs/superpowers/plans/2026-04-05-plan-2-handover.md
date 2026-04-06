# Plan 2 Handover — Google Books OAuth

Copy everything below the line into a fresh Claude Code session.

---

## Task

Design and implement the Google Books OAuth app (Plan 2) using the brainstorming skill, then brownfield-planning + parallel-pr-execution.

## Context

ChatBridge is a fork of Chatbox (Electron/React AI chat client) with third-party app integration via iframe sandboxing + postMessage. Plan 1 is complete — all code pushed to `main`.

### Documents to Read (in this order)

1. **Skeleton spec (your starting point):** `docs/superpowers/specs/2026-04-05-plan-2-google-books-oauth-skeleton.md`
   - Google Books API details, tools, registry entry, OAuth challenge analysis, sprint structure
   - Sections marked [UPDATE AFTER P1S1] need fresh data — fill from current codebase

2. **Plan 1 context (fills the skeleton gaps):** `docs/superpowers/plans/2026-04-05-plan-2-context-from-plan-1.md`
   - Iframe/sandbox lessons, tool-router architecture, Supabase integration, testing patterns
   - This is what the skeleton's [UPDATE AFTER P1S1] sections need

3. **Plugin contract:** `docs/plugin-contract.md`
   - Frozen contract. Google Books must conform to it.

4. **Architecture overview:** `docs/architecture-overview.md`
   - System diagram, component inventory, data flow, app tiers

5. **Developer guide:** `docs/developer-guide.md`
   - How to add apps at each tier. Tier 4 (OAuth) section is skeletal — you're building it.

6. **Brief:** `docs/chatbridge_brief.md`
   - Lines 204-239: OAuth requirements ("handle the OAuth flow, store tokens securely, refresh tokens automatically")

### Current Codebase State

- **Branch:** main at `f0fe22c7`, pushed to origin
- **7 apps in registry:** chess, weather, contract-test, nasa, flashforge (enabled) + spotify, rubiks (disabled)
- **192 chatbridge unit tests + 23 Playwright E2E tests passing**
- **Supabase `user_app_tokens` table exists** with RLS — unused, ready for OAuth tokens
- **.env keys:** Supabase, OpenAI, Weather, NASA all configured. Google Books keys NOT yet set up.

### Key Architecture Constraints

- **Iframe sandbox:** `allow-scripts allow-forms` — NO `allow-popups`, NO `allow-same-origin`
- **Host proxy pattern:** All external API calls go through `tool-router.ts`, never from iframe directly
- **Tool gating:** Only `open_app` visible when no app open. App tools appear after open_app.
- **Single source of truth:** App HTML in `src/renderer/chatbridge/apps/` only. Vite plugin copies to build.
- **bridge-sdk.js inlined:** Iframe sandbox blocks cross-origin scripts.

### Design Decision Already Made

**Host-mediated OAuth (Approach A):** Iframe sends `auth_request` → host opens popup → Google consent → callback page posts token to host → host stores in Supabase → host notifies iframe. The iframe never touches Google directly. This preserves sandbox security.

### What Needs Building

1. OAuth popup flow (host-side: open popup, handle callback, exchange code for token via PKCE)
2. Token storage in Supabase `user_app_tokens` + refresh middleware
3. New auth code path in `tool-router.ts` for `oauth2_pkce` type
4. Google Books iframe app (`apps/google-books/index.html`) with search UI + bookshelf management
5. Callback page for OAuth redirect
6. Playwright E2E tests (mock Google OAuth in tests)
7. Google Cloud Console setup (user action: create project, OAuth consent screen, credentials)

### Human Steps Required

- Register Google Cloud project + OAuth consent screen + credentials
- Add `VITE_GOOGLE_BOOKS_API_KEY` and `VITE_GOOGLE_BOOKS_CLIENT_ID` to `.env`
