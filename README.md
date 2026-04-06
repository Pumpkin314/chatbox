# ChatBridge

An AI chat platform with third-party app integration, built for K-12 education. Fork of [Chatbox](https://github.com/chatboxai/chatbox).

**Deployed:** <!-- TODO: add deployed URL here -->

## What is ChatBridge?

ChatBridge extends a standard AI chat interface with a plugin system that lets third-party apps register tools, render custom UI in a side panel, and communicate bidirectionally with the chatbot. Students can say "let's play chess," see a board appear, ask for help mid-game, and continue the conversation naturally after the game ends.

Built for the TutorMeAI case study -- a K-12 ed-tech platform where teachers control which apps are available and the chatbot stays aware of app state throughout interactions.

### Integrated Apps

| App | Type | Description |
|-----|------|-------------|
| Chess | Internal (Tier 2) | Interactive chess board with legal move validation, LLM analysis |
| Weather | External Public (Tier 2) | Real-time weather data via OpenWeatherMap API |
| NASA Space Explorer | External Public (Tier 2) | NASA Astronomy Picture of the Day with iframe UI |
| FlashForge | Internal (Tier 1) | Educational flashcard app with spaced repetition |
| Google Books | External Authenticated (Tier 3) | OAuth2-authenticated book search (in progress) |

## Setup

### Prerequisites

- Node.js v20.x -- v22.x
- pnpm >= 10.17.0

### Environment Variables

Create a `.env` file in the project root (or configure in the app's settings UI):

```
# Required for chat functionality
OPENAI_API_KEY=sk-...

# Required for Weather app
VITE_OPENWEATHERMAP_API_KEY=...

# Required for NASA app
VITE_NASA_API_KEY=...

# Optional: Supabase (for auth + persistence)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Install & Run

```bash
git clone <your-gitlab-repo-url>
cd chatbox
pnpm install

# Development (Electron desktop app)
pnpm dev

# Development (web only)
pnpm dev:web

# Build for web deployment
pnpm build:web
pnpm serve:web
```

### Run Tests

```bash
# Unit tests
pnpm test

# E2E tests (requires Playwright)
npx playwright install
pnpm exec playwright test
```

## Architecture

See [Architecture Overview](docs/architecture-overview.md) for the full system diagram and component inventory.

**Key modules:**

- `src/renderer/chatbridge/` -- Core bridge system (tool pipeline, iframe lifecycle, context manager)
- `src/renderer/chatbridge/registry/apps.json` -- App registry
- `src/renderer/chatbridge/apps/` -- App HTML source of truth
- `src/renderer/chatbridge/bridge-sdk.js` -- SDK injected into app iframes

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Overview](docs/architecture-overview.md) | System diagram, data flow, security model |
| [Plugin Contract v1.0](docs/plugin-contract.md) | Stable API contract for building plugins |
| [Developer Guide](docs/developer-guide.md) | Step-by-step guide for third-party app developers |
| [Cost Analysis](docs/cost-analysis.md) | Token estimates, dev spend, production projections |
| [Pre-Search](docs/presearch.md) | Case study analysis and architectural decisions |

## License

[GPLv3](./LICENSE)
