# Session Context — 2026-04-05 Brainstorming Session

Auxiliary context captured from the brainstorming session that doesn't fit in the spec files but may be useful for future sessions.

---

## Edu App Research Results

Five educational app ideas were researched as potential replacements for non-educational apps (Spotify, Weather). Full analysis below.

### Apps Selected for Implementation

| App | Tier | Auth | Sprint | Status |
|-----|------|------|--------|--------|
| Chess | 2 (iframe) | None | P1S1 | Protocol fixed, needs browser verification |
| Weather | 2 (iframe) | API key | P1S1 | Needs real API wiring + iframe display fix |
| NASA Space Explorer | 2 (iframe) | API key | P1S1 | New build |
| Google Books | 2+3 (iframe+OAuth) | OAuth2 | Plan 2 | Separate session |
| FlashForge or WordLab | 1 (JSON) | None | P1S2 | Decision deferred |

### Apps Researched but Not Selected (Yet)

**FlashForge — Adaptive Flashcard Engine (Tier 1 JSON)**
- Spaced-repetition flashcard tool, grades 3-12
- Tools: `list_decks`, `draw_card`, `submit_answer`, `get_progress`, `create_card`
- Chatbot quizzes students, adapts difficulty, explains wrong answers
- Build time: 8-10h. Could be P1S2.

**WordLab — Vocabulary Builder (Tier 1 JSON)**
- Vocabulary with context evaluation, grades 2-8
- Tools: `get_word`, `evaluate_sentence`, `get_student_vocab`, `start_challenge`
- Plays to LLM's core language strength
- Build time: 6-8h. Could be P1S2.

**MathSketch — Interactive Math Workspace (Tier 2 Iframe)**
- Equation editor + step tracker, grades 5-10
- Chatbot sees each step, intervenes with hints
- Build time: 12-16h. Too complex for current sprint.

**CodeSandbox Jr. — Beginner Coding Playground (Tier 2 Iframe)**
- Code editor with Pyodide (WASM Python), grades 6-12
- Chatbot explains errors, assigns challenges, does code review
- Build time: 14-16h. Too complex for current sprint.

### API Research Results

**Google Books API (selected for Plan 2):**
- Only API that naturally requires OAuth2 for a meaningful feature (personal bookshelves)
- Free tier: ~1,000 requests/day, no credit card
- Google's OAuth2 is the most well-documented OAuth implementation
- Pre-built shelves (To Read, Reading Now, Have Read) eliminate custom backend storage

**NASA APIs (selected for Plan 1):**
- Near-zero setup friction (API key registration takes 30 seconds)
- Clean JSON responses, well-documented
- High visual appeal (space photos)
- 1,000 requests/hour free tier
- No OAuth (API key only)

**APIs Eliminated:**
- Khan Academy API: no longer public, blocked by CORS
- Wikipedia/Wiktionary: no auth, doesn't demonstrate auth pattern
- Open Library: same — no auth
- Google Translate: requires billing account setup
- Wolfram Alpha: complex XML response format, API key only

**Merriam-Webster Dictionary API (potential future addition):**
- API key only, 1,000 queries/day free
- Good for vocabulary building if WordLab is built
- Response format is complex JSON

---

## Architecture Decisions Made

### Two-Plan Strategy
- **Plan 1:** Easy wins + Playwright (this session runs brownfield-planning)
- **Plan 2:** Google Books OAuth (separate CC session, user-driven)
- Plans share a frozen plugin contract as integration point
- Plan 2 spec is a skeleton until P1S1 completes, then updated with fresh context

### Why Spotify Is Being Replaced
- Entirely mock data, no real API integration
- Not educational — music playlists have no K-12 value
- OAuth flow was never implemented despite registry claiming `oauth2_pkce`
- Google Books serves the same architectural purpose (demonstrates OAuth) while being educational

### Why Rubik's Cube Is Low Priority
- Same tier as chess (internal, iframe, no auth) — doesn't add integration pattern diversity
- No external API to differentiate it
- Disabled in registry, stub implementation
- Only worth building if all other milestones are complete

### NASA Over Other Options
- Fastest to build (2-3h) with highest visual impact
- Real API with near-zero setup (free key, instant registration)
- Strong educational value (science curriculum alignment)
- Two-tab design serves both young and older students
- Same host-proxy pattern as weather — minimal new infrastructure

### Playwright Alongside MCP Chrome
- Playwright = automated regression (CI-runnable, repeatable)
- MCP Chrome = manual exploratory verification (catches visual/UX issues)
- Both run per sprint — not redundant, complementary
- Playwright tests have comprehensive logging for user review

### Contract Verification Before Freeze
- Build a minimal "contract test app" to verify the plugin interface works generically
- Fix any awkwardness before NASA is built against it
- The test app becomes a developer reference ("simplest possible ChatBridge app")
- Freeze happens after verification, not before

---

## Known Technical Issues

### Environment
- Node 25.9.0 installed but project requires <23. Added `engine-strict=false` to `.npmrc`.
- `pnpm` was not installed globally — installed via `npm install -g pnpm@latest`.
- Dependencies installed with `pnpm install` (engine-strict=false in .npmrc).

### Entrypoint Resolution
- Apps.json uses paths like `/apps/chess/index.html`
- These may not resolve in the Vite production build — app HTML files are in `src/renderer/chatbridge/apps/` but may not be copied to the build output's public directory
- **Must verify** during M1 (chess verification): does the iframe `src` attribute resolve correctly?
- Fix if needed: add apps directory to Vite's `public` config or use a different entrypoint strategy

### Bridge Protocol Inconsistencies (Fixed)
All apps had different payload expectations:
- Chess: `{type: 'tool_invoke', method, params}` at top level
- Spotify: `{type: 'tool_call', payload: {tool, params}}`
- Weather: `{type: 'tool_call', payload: {name, parameters}}`
- Host sends: `{type: 'tool_call', id, payload: {toolName, args}, timestamp}`

Fixes applied with fallback mappings so all apps accept both old and new formats. The contract going forward uses the host format: `{toolName, args}`.

### Response Type Naming
Apps respond with different type names (`tool_result` vs `tool_call_result`). The bridge resolves by matching the UUID `id`, not the `type` field. Both work. The contract should document this: response type is informational, correlation is by `id`.

### Supabase Test User
- Email: test@chatbridge.dev
- Password: TestPass123!
- Email already confirmed (no setup needed)

### Web Build vs Electron
- `pnpm dev:web` runs Electron, NOT the web platform
- For true web testing: `pnpm build:web && pnpm serve:web`
- Playwright tests should target the web build, not Electron

---

## Mockup Reference
- NASA Space Explorer mockup: `docs/mockups/nasa-app-mockup.html`
- Open in browser to see the two-tab layout (Explore + Dashboard)
- Shows simulated chat conversation alongside the side panel
