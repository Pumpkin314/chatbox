# Plan 1 Handover Prompt

Copy everything below the line into a fresh Claude Code session.

---

## Task

Run `/brownfield-planning` against the spec at `docs/superpowers/specs/2026-04-05-plan-1-chatbridge-sprint.md` to produce a sprint-structured implementation plan with parallel PRs and deterministic verification.

## Context

ChatBridge is a fork of Chatbox (open-source Electron/React AI chat client) that adds third-party app integration via iframe sandboxing + postMessage. The platform is largely built — we're fixing broken apps, adding a new one, and writing E2E tests.

### Documents to Read (in this order)

1. **The spec you're executing:** `docs/superpowers/specs/2026-04-05-plan-1-chatbridge-sprint.md`
   - Full sprint plan with 7 milestones, acceptance criteria, file paths, and known issues
   - This is your primary source of truth

2. **Original project brief:** `docs/chatbridge_brief.md`
   - The PRD with requirements, testing scenarios, and grading criteria
   - The spec's requirements checklist maps to this

3. **Pre-search analysis:** `docs/presearch.md`
   - Architecture decisions, threat model, state-as-graph model, cost analysis
   - Useful for understanding *why* things are built the way they are

4. **Session context (auxiliary):** `docs/superpowers/specs/2026-04-05-session-context.md`
   - Edu app research results, architecture decisions rationale, known technical issues
   - The "known technical issues" section is especially important — covers Node version workaround, entrypoint resolution risk, protocol inconsistencies

5. **Existing study guide:** `docs/study/2026-04-03/study-guide.md`
   - Deep codebase walkthrough from a prior session — architecture, gotchas, integration points
   - Long but comprehensive if you need to understand any subsystem

6. **NASA mockup:** `docs/mockups/nasa-app-mockup.html`
   - Visual reference for the NASA Space Explorer app (M4)

### Key Codebase Entry Points

Don't explore blindly — these are the files that matter:

**Core platform (read these to understand the system):**
- `src/renderer/chatbridge/bridge.ts` — PostMessage host-side protocol
- `src/renderer/chatbridge/bridge-sdk.js` — Iframe-side SDK (weather/spotify use it, chess doesn't)
- `src/renderer/chatbridge/tool-router.ts` — Routes tool calls: open_app → lifecycle, api_key → host proxy, else → bridge
- `src/renderer/chatbridge/tool-builder.ts` — JSON Schema → Zod → Vercel AI SDK ToolSet
- `src/renderer/chatbridge/registry/apps.json` — App catalog (4 entries)
- `src/renderer/components/chatbridge/SidePanel.tsx` — Iframe panel, bridge wiring, app_init handshake

**Apps (you'll be modifying/creating these):**
- `src/renderer/chatbridge/apps/chess/index.html` — Protocol recently fixed, unverified in browser
- `src/renderer/chatbridge/apps/weather/index.html` — Needs `__proxyResult` handler for real API data
- `src/renderer/chatbridge/apps/nasa/` — Doesn't exist yet, will be created

**Tests:**
- `src/renderer/chatbridge/__tests__/` — 85 unit tests (all passing)
- `tests/e2e/` — Doesn't exist yet, Playwright suite will be created here

### What's Already Done (Don't Redo)
- Protocol fixes applied to chess/spotify/weather HTML + SidePanel.tsx (committed)
- Dependencies installed (`pnpm install` with engine-strict=false for Node 25)
- 116 unit tests passing
- NASA visual mockup created

### Critical Warnings
- `pnpm dev:web` runs Electron, NOT the web platform. For browser testing: `pnpm build:web && pnpm serve:web`
- Entrypoint paths in apps.json (`/apps/chess/index.html`) may not resolve in Vite build — M1 step 0 must verify this
- `HOST_MESSAGE_TYPES` constant in bridge.ts is wrong (`tool_call_result` should be `tool_call`) — M2 must fix this
- `executeHostProxiedTool()` in tool-router.ts is hardcoded to weather only — NASA needs it extended
- Supabase test user: test@chatbridge.dev / TestPass123!

### Plan 2 (Not Your Concern)
A separate Google Books OAuth spec exists at `docs/superpowers/specs/2026-04-05-plan-2-google-books-oauth-skeleton.md`. It will be executed in a different session after your Sprint 1 completes. You don't need to read it, but don't modify it either. Your Sprint 1 produces the frozen plugin contract (`docs/plugin-contract.md`) that Plan 2 builds against.
