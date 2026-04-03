# Continuation: ChatBridge Implementation
**Written at:** Sprint 1 complete, Sprint 1 gate BLOCKED by build failure
**Plan:** `docs/superpowers/plans/2026-04-02-chatbridge-implementation.md`
**Spec:** `docs/superpowers/specs/2026-04-02-chatbridge-design.md`
**Risks:** `docs/chatbridge_risks.md`
**Post-MVP:** `docs/chatbridge_post_mvp.md`

## Completed

### Sprint 0: PASSED
- PR 0.1: Supabase client, DB migration (5 tables + RLS), .env.example — merged
- PR 0.2: Live app exploration — validated system analysis, found 3 corrections (applied to CLAUDE.md files)
- Sprint 0 gate: Chrome browser E2E passed (app loads, no errors, Supabase connected)

### Sprint 1: MERGED (gate NOT yet run — build failure blocking)
- PR 1.1 (Auth): Supabase Auth with Jotai atoms, LoginPage, AuthGuard, logout button — 17 tests — merged
- PR 1.2 (Persistence): Storage layer, chatStore bridge, message persistence — 20 tests — merged
- PR 1.3 (Token logging): logTokenUsage + cost estimation, wired into streamText — 10 tests — merged

**All 3 PRs had merge conflicts in `src/renderer/chatbridge/supabase.ts` because each agent created its own stub.** Conflicts were resolved by keeping the canonical version (direct export + getSupabaseClient function wrapper):
```ts
export const supabase: SupabaseClient | null = ...
export function getSupabaseClient(): SupabaseClient | null { return supabase }
```

## BLOCKER: Build Failure

`pnpm build:web` fails after merging Sprint 1 PRs. The error was not fully diagnosed before context handover. **This is the #1 priority for the next session.**

Likely causes:
1. Import path issues — PR 1.1 uses `@/chatbridge/supabase` alias, other PRs may use relative paths
2. PR 1.1 modified `__root.tsx` (added AuthGuard) — may have introduced imports that Vite can't resolve
3. PR 1.3 modified `stream-text.ts` — may reference modules that don't exist on main after merge
4. Package.json conflicts in pnpm-lock.yaml may have left inconsistent dependencies

**Debug steps:**
```bash
pnpm build:web 2>&1 | head -50   # see the full error
pnpm install                       # in case lock file is stale
pnpm build:web 2>&1               # retry after install
```

## Pre-Cooked (NOT merged — awaiting Sprint 1 gate)

### PR 2.1: App Registry — DONE
- Branch: `worktree-agent-add13df4`
- Worktree: `.claude/worktrees/agent-add13df4`
- 13 tests, all passing
- Files: registry/apps.json, registry/index.ts, tools.ts, app-lifecycle.ts
- **DO NOT merge until Sprint 1 gate passes**

### PR 2.4: Chess App — DONE
- Branch: `worktree-agent-aa7f10c0`
- Worktree: `.claude/worktrees/agent-aa7f10c0`
- Self-contained HTML with inline chess.js, board renderer, bridge protocol
- All verification criteria passed including checkmate detection, castling, FEN restore
- **DO NOT merge until Sprint 2 dependencies met (needs PR 2.2, 2.3)**

## Not Yet Started

### Sprint 2 (remaining):
- PR 2.2: Side panel + iframe bridge — needs to mirror sidebar's fixed-position + paddingRight pattern (see components/CLAUDE.md)
- PR 2.3: Dynamic tool scoping + tool routing — touches stream-text.ts (wait for PR 1.3 to be clean on main)
- PR 2.5: Context retention + app state management

### Sprint 3:
- PR 3.1: Weather dashboard (External Public)
- PR 3.2: Spotify OAuth + playlist (External Authenticated)
- PR 3.3: Rubik's Cube stub (disabled)

### Sprint 4:
- PR 4.1: Error handling + loading indicators + ambiguous routing
- PR 4.3: Developer documentation
- PR 4.4: Cost analysis + deployment + GitLab

## Decisions Made During Execution

1. **close_app tool needed** — PR 2.1 has `handleCloseApp` in app-lifecycle.ts but no `close_app` tool in the registry. Add it to registry and tool builder in PR 2.3.

2. **App switch confirmation** — When switching apps while one is active, show "Are you sure? Your progress will not be saved." dialog. Added to PR 2.2 verification criteria in the plan.

3. **Side panel approach** — Use fixed-position + paddingRight (mirroring sidebar pattern), NOT flex siblings. Avoids breaking existing Outlet layouts. See components/CLAUDE.md.

4. **Mantine for new components** — App uses MUI + Mantine dual framework. Newer code uses Mantine. New ChatBridge components should use Mantine.

5. **Dev testing** — `pnpm dev:web` runs Electron (DesktopPlatform). For true WebPlatform testing: `pnpm build:web && pnpm serve:web`.

## Supabase Setup (Complete)
- Project ref: `tmiwxelndsfcwmybsckj`
- `.env` file exists with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- All 5 tables created with RLS
- CLI linked: `npx supabase link --project-ref tmiwxelndsfcwmybsckj`

## Codebase Knowledge

### Key Files Modified
- `src/renderer/chatbridge/supabase.ts` — Supabase client singleton (canonical version on main)
- `src/renderer/chatbridge/auth.ts` — Auth atoms + signIn/signUp/signOut + initAuth
- `src/renderer/chatbridge/storage.ts` — Supabase CRUD for conversations/messages
- `src/renderer/chatbridge/chatStoreSupabase.ts` — Bridge between chatStore and Supabase
- `src/renderer/chatbridge/messagePersistence.ts` — Fire-and-forget message saving
- `src/renderer/chatbridge/token-logger.ts` — Token usage logging with cost estimation
- `src/renderer/components/auth/LoginPage.tsx` — Login/signup form
- `src/renderer/components/auth/AuthGuard.tsx` — Route guard
- `src/renderer/routes/__root.tsx` — Modified to add AuthGuard wrapper
- `src/renderer/Sidebar.tsx` — Modified to add logout button
- `src/renderer/packages/model-calls/stream-text.ts` — Modified to add token logging

### Pre-existing Test Failures (5)
These existed before our changes — do not try to fix:
- token-estimation tests
- model registry tests  
- settings persistence tests

## Next Actions (Priority Order)

1. **FIX BUILD** — `pnpm build:web` failure is the blocker. Debug, fix, verify.
2. **Run Sprint 1 gate** — build:web + serve:web, Chrome browser E2E: sign up, log in, send message, verify streaming, refresh, verify persistence, check token_usage_log in Supabase
3. **Merge pre-cooked PR 2.1** (registry) after gate passes
4. **Dispatch PR 2.2** (side panel) and **PR 2.3** (tool routing)
5. **Merge PR 2.4** (chess) after PR 2.2 + 2.3 are done
6. **Sprint 2 gate** — full chess lifecycle E2E
7. **Sprint 3** — weather + spotify + rubiks stub (all parallel)
8. **Sprint 4** — error handling, docs, cost analysis, deploy
