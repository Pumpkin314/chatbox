# Handover Prompt for Session 3

Paste this into the new session:

---

Read `docs/superpowers/plans/2026-04-02-chatbridge-continuation-2.md` — this is a handover from the previous session. All of Sprint 0-3 code is merged to main. Build passes. 730 tests pass.

**CRITICAL BUGS to fix first (items 3-4 in Known Issues):**
1. `setBridgeRef()` and `setStoreRef()` in `src/renderer/chatbridge/tool-router.ts` are never called — wire them into app initialization so tool routing actually works. The Jotai default store should be passed via `setStoreRef(getDefaultStore())` at module load, and the bridge ref should be set from `SidePanel.tsx` when the bridge is created.
2. The SidePanel iframe `src` uses the registry `entrypoint` field (`./apps/chess/index.html`) — verify this resolves correctly in the built app. If not, the entrypoint needs to be resolved relative to the renderer output directory.

**After fixing those, in parallel:**
- Background a subagent to run Sprint 3 gate in Chrome browser: `pnpm build:web && pnpm serve:web`, then navigate to localhost:3000, log in (test@chatbridge.dev / TestPass123!), configure an OpenAI API key in Settings, and test the 3 gate scenarios from the plan.
- On the main thread: work on Sprint 4 (PR 4.1 error handling if time, PR 4.4 deploy + push to remote). Deadline is tight.

If context allows after S4, write `docs/cost-analysis.md` with token cost projections.

---
