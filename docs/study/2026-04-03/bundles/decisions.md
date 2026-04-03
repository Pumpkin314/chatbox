# Decisions Bundle

## Why Fork Chatbox?
Production chat UI, 15+ AI providers, streaming, Jotai state, Vite build -- all free. Focus the week on the hard problem (app integration), not rebuilding chat.

## Why Iframe Sandbox (Not React Components)?
K-12 security. `sandbox="allow-scripts allow-forms"` with no `allow-same-origin` creates a hard isolation boundary. Third-party code cannot access parent DOM, tokens, or chat history. Tradeoff: postMessage complexity.

## Why Supabase Over Firebase?
PostgreSQL + RLS > NoSQL security rules. CLI automation (`supabase init`, `db push`). Generous free tier (50K MAU). SQL migrations as version-controlled files.

## Why OpenAI Default?
Most mature function calling. Reliable `tool_choice`, structured JSON Schema tools, multi-step chains. Configurable post-MVP via Chatbox's existing multi-provider support.

## Why open_app Meta-Tool?
Prevents token bloat (Risk R1). Baseline cost ~100 tokens regardless of registered app count. Creates clear lifecycle event for iframe mounting. Two-phase: discover then invoke.

## Why Host-Side Weather Proxy?
Iframe sandbox blocks external `fetch`. API key must stay on host side. `tool-router.ts` intercepts weather calls, fetches from OpenWeatherMap, returns data via postMessage.

## Why Zod 4 jsonSchema() Wrapper?
Vercel AI SDK `tool()` expects `inputSchema` via Zod `~standard` protocol. Programmatic Zod schemas produced empty `jsonSchema`. Fix: `jsonSchema()` from `@ai-sdk/provider` wraps raw JSON Schema directly.

## Why maxSteps: 5?
Typical flow: open_app + 2-3 tool calls + text response = 4 steps. Five gives headroom without risking infinite loops. Higher values increase cost/latency.

## Why Client-Side Orchestration?
Matches Chatbox's existing pattern (direct browser -> OpenAI calls). No new backend to build. Tradeoff: API keys in client. Post-MVP: Edge Functions.

## Why Railway?
Simple `railway up`, persistent env vars, no cold starts. Vercel free tier also works. Static SPA, so both are equivalent.

## Why Mantine for New Components?
Codebase convention: older code uses MUI, newer code uses Mantine. Better TypeScript support, smaller bundle.

## Why Static JSON Registry (Not DB)?
MVP simplicity. `apps.json` loaded at startup. `app_registry` DB table exists in schema for post-MVP dynamic registration but is unused in MVP.
