# ChatBridge — Post-MVP Continuation Plan

This document captures ideas, improvements, and deferred features to be fleshed out in post-MVP sprint planning. Each item includes context on why it was deferred and what the MVP stub looks like.

---

## App Rendering: Inline + Expand (Option C)

**MVP:** Side panel only (Option B).
**Post-MVP:** Add inline thumbnail widget in message stream with "expand to panel" button. Same iframe, reparented between inline and panel DOM positions.
**Stub:** Side panel component is already isolated — just needs a second mount target in the message stream.

---

## Tool Registry Sophistication

### Embedding-Based Relevance Scoring
**Context:** MVP uses `open_app` meta-tool + dynamic scoping (active app tools only). This works well for explicit invocations but doesn't handle subtle contextual relevance (e.g., user mentions "weather" mid-conversation without saying "open weather app").
**Post-MVP:** Embed user messages and tool descriptions, compute similarity scores, threshold for inclusion. Lightweight — can use OpenAI embeddings API.
**Stub:** Tool descriptions in the registry already serve as the embedding source.

### Usage-Weighted Tool Priority
**Context:** As the registry grows, even the `open_app` description listing all apps becomes unwieldy.
**Post-MVP:** Track tool invocation frequency per user. LRU eviction — recently used apps listed first in `open_app` description. Personalized tool ordering.
**Stub:** `token_usage_log` table already captures per-conversation tool usage.

### Routing Classifier
**Context:** For 10+ apps, even smart injection may not be enough.
**Post-MVP (future):** Fine-tuned lightweight model (or Haiku-class) that classifies user intent → app before the main LLM call. Two-model architecture: fast router + full orchestrator.
**Stub:** The `open_app` meta-tool is already a manual version of this pattern.

---

## 3D Rubik's Cube App

**MVP:** Stubbed in registry as disabled. No implementation.
**Post-MVP:** Three.js + cubejs (Kociemba solver). Self-contained HTML bundle. 54-char face string for LLM state representation. Internal auth type (same as Chess).
**Stub:** Registry entry exists with `enabled: false`. Entrypoint placeholder at `apps/rubiks/index.html`.
**Key risks:** WebGL context limits in iframes (R9 in risks doc). IntersectionObserver to pause animation when not visible.

---

## URL-Loaded External Apps

**MVP:** All apps bundled as static HTML in the repo.
**Post-MVP:** Support `entrypoint` as a URL (`https://my-app.com/chatbridge-widget`). Requires CORS config, CSP adjustments, and origin validation in the postMessage bridge.
**Stub:** Registry schema already has `entrypoint` field that accepts paths or URLs. Bridge protocol already validates origins.

---

## Server-Side Orchestration (Architecture Evolution)

**MVP:** Architecture 1 — host-orchestrated, all client-side.
**Post-MVP:** Move LLM calls to Supabase Edge Functions (Architecture 3 hybrid). Benefits: API keys never in client, server-side token tracking, audit trail.
**Stub:** LLM Service is a standalone module in the orchestration layer — can be swapped from client-side fetch to edge function call without changing the tool router or app lifecycle manager.

---

## Langfuse / Langchain Tracing

**MVP:** Basic token counting from OpenAI response `usage` field, logged to `token_usage_log` table.
**Post-MVP:** Integrate Langfuse for full observability — traces per conversation, spans per tool call, cost dashboards. Or Langchain callbacks if we adopt that abstraction.
**Stub:** Token logging already captures the raw data. Langfuse just needs the same data points in its format.

---

## Token Refresh Automation

**MVP:** Spotify OAuth with manual re-auth if token expires.
**Post-MVP:** Background token refresh using `refresh_token`. Check `expires_at` before each tool call, refresh proactively. Supabase Edge Function for secure server-side refresh.
**Stub:** `user_app_tokens` table already stores `refresh_token` and `expires_at`.

---

## App Permissions & Sandboxing Hardening

**MVP:** Strict iframe `sandbox` attributes, origin validation.
**Post-MVP:** Per-app permission scopes (can app read chat history? can it make network requests?). CSP headers per app. App signing/verification for URL-loaded apps.
**Stub:** Registry `auth_config` field can be extended with a `permissions` array.

---

## Rich App Status in Messages

**MVP:** Text-only chat messages referencing app state.
**Post-MVP:** Inline status cards in message stream — "Chess game in progress (move 12, your turn)" with a small board thumbnail. Rendered as a React component, not an iframe.
**Stub:** `app_state` field in messages table already stores the data needed for these cards.

---

## Developer Documentation & SDK

**MVP:** Minimal README explaining tool schema format and bridge protocol.
**Post-MVP:** Full developer portal. Published `@chatbridge/bridge-sdk` on npm. App template generator CLI. Local dev server for testing apps against the bridge protocol.
**Stub:** Bridge JS file is already a standalone module that could be extracted.

---

## E2E Test Suite

**MVP:** Chrome MCP E2E tests per sprint gate. Manual testing against brief's 7 scenarios.
**Post-MVP:** Playwright test suite. Mock app fixtures. CI integration. Load testing with concurrent sessions.
**Stub:** Chrome MCP tests establish the patterns that Playwright tests can mirror.

---

## Multi-App Simultaneous Sessions

**MVP:** One app at a time in the side panel. Switching apps serializes/stores previous app state.
**Post-MVP:** Tabbed panel with multiple apps open. Split panel view. Background apps maintain live state.
**Stub:** App lifecycle manager already handles serialize-on-close. Just needs a tab container.

---

## Deployment & CI/CD

**MVP:** Manual `vercel deploy` or `railway up`.
**Post-MVP:** GitHub Actions CI pipeline. Auto-deploy on push to main. Preview deployments on PRs. GitLab mirror sync.
**Stub:** Deployment host chosen and validated during MVP.
