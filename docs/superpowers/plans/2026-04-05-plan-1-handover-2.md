# Plan 1 Handover — Session 2

Copy everything below the line into a fresh Claude Code session.

---

## Task

Resume execution of Plan 1 ChatBridge Sprint using `/parallel-pr-execution`. Sprint 0-2 are complete. Start with the Sprint 2 gate, then execute Sprints 3-4.

## Context

ChatBridge is a fork of Chatbox (Electron/React AI chat client) with third-party app integration via iframe sandboxing + postMessage. We're in the middle of executing a sprint plan.

### Documents to Read (in this order)

1. **Continuation doc (CRITICAL — read first):** `docs/superpowers/plans/2026-04-05-plan-1-continuation-1.md`
   - What's done, what diverged, current state, pending work, architecture decisions
   - This is your primary context for resuming

2. **The plan you're executing:** `docs/superpowers/plans/2026-04-05-plan-1-chatbridge-sprint.md`
   - Full sprint plan with PRs, verification criteria, dependency graph
   - Sprints 0-2 are DONE. Resume from Sprint 2 gate → Sprint 3 → Sprint 4

3. **Plugin contract:** `docs/plugin-contract.md`
   - Frozen contract — don't modify unless bugs found during testing

4. **Original brief:** `docs/chatbridge_brief.md`
   - The PRD with 7 testing scenarios — Playwright tests must cover all 7

### Current State

- **Branch:** main at `4f28b28b`
- **174 chatbridge tests passing** (7 pre-existing failures in unrelated modules — ignore)
- **6 apps in registry:** chess, weather, contract-test, nasa (enabled) + spotify, rubiks (disabled)
- **Railway production:** All VITE_* env vars set at exciting-nature-production-d9df.up.railway.app
- **.env:** All API keys configured (Supabase, OpenAI, Weather, NASA)
- **No active worktrees**

### What's Left

1. **Sprint 2 gate (Chrome browser):** Rebuild (`pnpm build:web`), serve (`pnpm serve:web`), verify in Chrome:
   - Weather with real API data
   - Close weather → open NASA → APOD
   - Context retention, chess regression
   - Full gate criteria in the plan

2. **Sprint 3 (Playwright):**
   - User will install Playwright: `pnpm add -D @playwright/test && npx playwright install chromium`
   - PR 3.1: Config + helpers + 7 core scenarios
   - PR 3.2: App-specific tests (chess, weather, nasa, resilience)

3. **Sprint 4 (Polish + Docs):**
   - PR 4.1: Tier 1 JSON edu app (FlashForge or WordLab — no iframe)
   - PR 4.2: UX polish (loading states, error cards)
   - PR 4.3: Docs + architecture overview
   - M7: Manual exploratory testing

### Critical Architecture Notes

- **Tool gating is active:** Only `open_app` visible when no app open. LLM must call `open_app` first.
- **Single source of truth:** App HTML in `src/renderer/chatbridge/apps/` ONLY. Vite plugin copies to build. Do NOT create `public/apps/` copies.
- **bridge-sdk.js must be inlined:** Iframe sandbox blocks cross-origin script loading.
- **Host proxy pattern:** `api_key` apps → tool-router.ts calls API, sends `__proxyResult` to iframe.
- **Agent worktree gotcha:** Agents branch from old commits, causing merge conflicts in test files (app counts, tool gating assertions). Plan for manual conflict resolution on every merge.

### Chrome Interaction Note

When using MCP Chrome browser tools with the Chatbox chat interface: click the textbox first, type the message, then click the send arrow button to submit.
