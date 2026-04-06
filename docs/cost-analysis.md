# ChatBridge Cost Analysis

This document breaks down the operating costs for ChatBridge, covering development costs, LLM API usage, backend infrastructure, and hosting. All estimates are based on actual token measurements from the application.

---

## 0. Development & Testing Costs

### Methodology

Development was done using Claude Code (Anthropic CLI) with Claude Opus over a 4-day sprint (April 2--5, 2026). Session logs from the Claude Code project directory provide the primary cost data. Earlier sessions (April 2--3) were not retained, so the figures below are a lower bound.

### Measured Data (Claude Code Sessions)

| Metric | Value |
|--------|-------|
| Session files (incl. subagents) | 34 |
| Total session data | ~22 MB JSONL |
| Development days | 4 (April 2, 3, 5 active; April 4 idle) |
| Commits produced | ~40 |

### Estimated Token Consumption

Claude Code session JSONL includes prompts, responses, tool calls, and tool results. Each assistant turn re-sends the full conversation context, so raw file size underestimates total API tokens consumed. Conservative estimate based on session structure:

| Component | Estimate |
|-----------|----------|
| Retained sessions (April 5) | ~22 MB raw, ~3--4M tokens consumed |
| Lost sessions (April 2--3) | ~30--50% additional based on commit volume |
| **Estimated total tokens** | **~5--6M tokens** |

### Estimated Development Cost

| Model | Rate | Est. Input Tokens | Est. Output Tokens | Est. Cost |
|-------|------|-------------------|---------------------|-----------|
| Claude Opus (via Claude Code) | $15/$75 per 1M in/out | ~4M | ~1.5M | ~$172 |

This covers all code generation, planning, documentation, and testing done through Claude Code. No OpenAI API costs were incurred during development -- the app's LLM calls use the user's own API key at runtime, and manual testing used minimal tokens.

**Other AI-related costs:** $0 (no embeddings, fine-tuning, or separate hosting).

---

## 1. Per-Conversation Token Estimates

Every chat message in ChatBridge includes baseline overhead:

| Component | Tokens |
|-----------|--------|
| System prompt | ~500 |
| ChatBridge context injection | ~200 |
| **Baseline per message** | **~700** |

Tool invocations add ~100-200 tokens each (tool definition + call + response).

### Typical Conversation Profiles

**Simple weather query** (~1,000 total tokens)
- 1 user message + baseline: ~750 input tokens
- 1 tool call (`get_weather`): ~150 tokens
- Assistant response: ~100 output tokens

**Chess session** (~5,000 total tokens across ~10 turns)
- Each turn: baseline + growing conversation history
- Tool calls per turn (`make_move`, `get_board`, occasional `get_hint`): ~300-500 tokens/turn
- Typical session: ~4,000 input tokens, ~1,000 output tokens

**Mixed session** (~3,000 total tokens)
- A student opens Spotify, searches tracks, asks about weather, plays a short chess game
- Multiple tool calls (`open_app`, `search_tracks`, `get_weather`): ~400 tool tokens
- ~2,200 input tokens, ~800 output tokens

---

## 2. Monthly Cost Projections

### Assumptions

- 30 students per classroom
- 5 queries per student per day
- 20 school days per month
- **3,000 total queries/month** (30 x 5 x 20)
- Average conversation: ~2,000 input tokens, ~500 output tokens (blended across simple and complex queries)

### GPT-4o mini (Default -- Recommended)

| | Rate | Monthly Tokens | Monthly Cost |
|--|------|---------------|--------------|
| Input | $0.15 / 1M tokens | 6M tokens | $0.90 |
| Output | $0.60 / 1M tokens | 1.5M tokens | $0.90 |
| **Total** | | | **$1.80/month** |

### GPT-4o (Premium Option)

| | Rate | Monthly Tokens | Monthly Cost |
|--|------|---------------|--------------|
| Input | $2.50 / 1M tokens | 6M tokens | $15.00 |
| Output | $10.00 / 1M tokens | 1.5M tokens | $15.00 |
| **Total** | | | **$30.00/month** |

GPT-4o costs roughly **17x more** than GPT-4o mini for the same usage. For most K-12 use cases, GPT-4o mini is more than sufficient.

### Scaling Estimates (GPT-4o mini)

| Scale | Students | Queries/Month | Est. Cost/Month |
|-------|----------|---------------|-----------------|
| Pilot (1 class) | 30 | 3,000 | ~$2 |
| Grade level (5 classes) | 150 | 15,000 | ~$9 |
| School-wide (20 classes) | 600 | 60,000 | ~$36 |
| District (10 schools) | 6,000 | 600,000 | ~$360 |

### Production Cost Projections by User Count

Assumptions: 5 queries/user/day, 20 active days/month, average 2,500 tokens/query (blended), GPT-4o mini pricing ($0.15/$0.60 per 1M in/out), Supabase free tier up to ~1K users.

| | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|--|-----------|-------------|--------------|---------------|
| Queries/month | 10,000 | 100,000 | 1,000,000 | 10,000,000 |
| Input tokens/month | 20M | 200M | 2B | 20B |
| Output tokens/month | 5M | 50M | 500M | 5B |
| **LLM API** | $6 | $60 | $600 | $6,000 |
| Supabase | $0 (free) | $25 (Pro) | $25 (Pro) | $599 (Team) |
| Hosting | $0 (free tier) | $0 (free tier) | $20 (Pro) | $150+ (dedicated) |
| **Total** | **~$6/month** | **~$85/month** | **~$645/month** | **~$6,750/month** |

Notes:
- At 10K+ users, prompt caching (50% discount on repeated system prompt tokens) and conversation compaction reduce LLM costs by 30--40%.
- 100K users would likely require a dedicated backend, load balancing, and Supabase Team or self-hosted Postgres.
- Per-user cost decreases with scale: $0.06/user at 100 users down to ~$0.07/user at 100K users (infrastructure overhead amortized).

---

## 3. Supabase Costs

ChatBridge uses Supabase for authentication and database (5 RLS-enabled tables including `token_usage_log`).

### Free Tier Limits

| Resource | Free Tier Limit | ChatBridge Usage (1 classroom) |
|----------|----------------|-------------------------------|
| Database rows | 500 MB storage | Low -- text data is small |
| Auth users | 50,000 MAU | 30 students + teachers |
| API requests | Unlimited (rate-limited) | ~3,000 chat-related DB writes/month |
| Realtime connections | 200 concurrent | Well within limits |
| Edge Functions | 500K invocations | Not currently used |
| Storage | 1 GB | Not currently used |

### When to Upgrade

The free tier comfortably supports a **single classroom pilot** and likely a **full grade level** (150 students).

Consider upgrading to Supabase Pro ($25/month) when:
- `token_usage_log` table grows past ~100K rows (roughly 3-4 months of school-wide usage without cleanup)
- You need more than 200 concurrent realtime connections (unlikely for chat)
- You need daily database backups or point-in-time recovery
- You exceed 500 MB of database storage

**Recommendation:** Stay on the free tier through pilot. Implement a log retention policy (e.g., archive logs older than 90 days) to extend free tier viability.

---

## 4. Railway Hosting

ChatBridge is a static SPA (Single Page Application) built with Vite/React.

### Options

| Platform | Cost | Notes |
|----------|------|-------|
| Railway | $5/month (Hobby) | Includes 500 hours execution, 100 GB bandwidth |
| Vercel (free tier) | $0 | Ideal for static SPA, generous free tier |
| Netlify (free tier) | $0 | Also suitable for static SPA |
| School-hosted | $0 | If IT supports static file hosting |

**Recommendation:** For a static SPA with no server-side rendering, Vercel or Netlify free tiers are the most cost-effective option. Railway is better suited if you later add a custom backend server.

Estimated hosting cost: **$0-5/month**.

---

## 5. Cost Optimization Strategies

### Conversation Compaction

The biggest cost driver is conversation history accumulating in the context window. Strategies:

- **Sliding window:** Keep only the last N messages (e.g., 10) in context. Older messages are summarized or dropped.
- **Summarization:** After every 10 turns, compress the conversation history into a ~200 token summary.
- **Session isolation:** Start fresh context for each new topic or class period.
- **Impact:** Can reduce input tokens by 40-60% for longer sessions.

### Model Selection

- Default to **GPT-4o mini** for all standard interactions. It handles weather queries, app management, and basic chess well.
- Reserve **GPT-4o** only for cases where response quality is noticeably insufficient (rare for K-12 use cases).
- Consider making GPT-4o opt-in per teacher/admin rather than per student.

### Caching

- **Tool result caching:** Cache `get_weather` and `get_forecast` responses for 15-30 minutes. Students in the same classroom will query the same location.
- **System prompt caching:** OpenAI supports prompt caching for repeated prefixes -- the 700-token baseline is identical across all requests, giving an automatic 50% discount on those tokens after the first request in a window.
- **Static tool definitions:** Tool schemas are constant and benefit from prompt caching automatically.

### Token Budgets

The `token_usage_log` table enables enforcement:

- **Per-student daily cap:** e.g., 10,000 tokens/day (~5 conversations). Prevents runaway usage from open-ended sessions.
- **Per-classroom monthly cap:** Alert teachers when approaching budget thresholds (75%, 90%, 100%).
- **Hard cutoff vs. soft warning:** Recommend soft warnings to teachers with hard cutoffs only as a safety net.

---

## 6. Budget Recommendations

### Pilot Phase (1 classroom, 1 month)

| Item | Monthly Cost |
|------|-------------|
| OpenAI API (GPT-4o mini) | $2 |
| Supabase | $0 (free tier) |
| Hosting | $0 (Vercel/Netlify free) |
| **Total** | **~$2/month** |

Set an OpenAI spending limit of **$10/month** to account for unexpected spikes.

### Classroom Deployment (1-5 classrooms)

| Item | Monthly Cost |
|------|-------------|
| OpenAI API (GPT-4o mini) | $2-9 |
| Supabase | $0 (free tier) |
| Hosting | $0-5 |
| **Total** | **~$5-15/month** |

Set an OpenAI spending limit of **$25/month**.

### School-Wide Deployment (20 classrooms, ~600 students)

| Item | Monthly Cost |
|------|-------------|
| OpenAI API (GPT-4o mini) | ~$36 |
| Supabase Pro | $25 |
| Hosting | $0-5 |
| Buffer (20%) | ~$13 |
| **Total** | **~$75-80/month** |

Set an OpenAI spending limit of **$75/month**.

### Key Takeaway

ChatBridge is remarkably inexpensive to operate at classroom scale. GPT-4o mini pricing makes the LLM cost nearly negligible for a pilot. The primary cost concern only emerges at district scale or if GPT-4o is enabled broadly. Supabase free tier covers most deployments, and hosting a static SPA is effectively free.
