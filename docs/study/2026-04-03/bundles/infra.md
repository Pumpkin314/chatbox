# Infrastructure Bundle

## Build Pipeline

```
pnpm install -> pnpm build:web -> release/app/dist/renderer/ (static SPA)
```

- `CHATBOX_BUILD_PLATFORM=web` env var triggers web-only build
- `electron-vite build` produces the output
- `delete-source-maps-runner.js` strips source maps post-build
- No CI/CD -- all manual

## Deployment: Railway

- Static SPA served from `release/app/dist/renderer/`
- Env vars set in Railway dashboard: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Alternative: Vercel free tier, Netlify free tier (all work for static SPA)
- `railway up` deploys from local build output

## Supabase

- Project ref: `tmiwxelndsfcwmybsckj`
- 5 tables with Row Level Security (RLS)
- Free tier: 50K MAU, 500MB storage, unlimited API requests
- CLI: `npx supabase link`, `npx supabase db push`
- Migrations in `supabase/migrations/`
- Test user: `test@chatbridge.dev` / `TestPass123!` (email confirmed)

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VITE_WEATHER_API_KEY` | OpenWeatherMap API key | No (mock fallback) |
| `VITE_SPOTIFY_CLIENT_ID` | Spotify OAuth client ID | No (mock fallback) |

OpenAI API key is set in the Settings UI, not via env var.

## Testing

- **Framework:** Vitest 4.0.16
- **Results:** ~730 passed, ~84 skipped, 7 pre-existing failures
- **ChatBridge tests:** bridge (9), tool-builder (5), tool-router (6), context-manager (8), system-prompt (6), SidePanel (7), weather (20), spotify (11), registry (13) = 85+ tests
- **Commands:** `pnpm test`, `pnpm test:coverage`
- **No E2E automation.** Sprint gates run manually via Chrome MCP

## Monitoring

- `token_usage_log` table captures every LLM call with model, tokens, estimated cost
- Aggregation query in design spec for cost reporting
- No Langfuse/Langchain tracing in MVP (post-MVP plan)

## Cost at Scale (GPT-4o-mini)

| Scale | Monthly Cost |
|-------|-------------|
| 1 classroom (30 students) | ~$2 |
| 5 classrooms (150 students) | ~$9 |
| School-wide (600 students) | ~$36 + $25 Supabase Pro |
| District (6,000 students) | ~$360 + $25 Supabase Pro |
