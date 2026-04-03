# packages/

## Purpose
Core business logic modules — model calls, MCP, token estimation, context management. Decoupled from UI.

## Key Files
- `model-calls/stream-text.ts`: Wraps Vercel AI SDK `streamText()` — the LLM call entry point
- `model-calls/tools.ts`: Tool orchestration — defines ToolSet for web-search, knowledge-base, file tools
- `mcp/controller.ts`: MCP server lifecycle — starts/stops MCP clients, fetches tools via `client.tools()`
- `token-estimation/`: Token counting utilities
- `context-management/`: Context window management, compaction logic

## Patterns
- Tools injected into streamText() via ToolSet parameter — extend this for ChatBridge tools
- MCP tools fetched dynamically, merged into ToolSet at call time
- ModelDependencies dependency injection — storage, request, config passed to factories

## Integration Points
- Depends on: `@shared/models/`, `@shared/types/`, `@ai-sdk/*`
- Depended on by: `../stores/session/generation.ts`, `../components/`

## ChatBridge Changes Needed
- Add ChatBridge tool definitions (open_app, app-specific tools) to tools.ts or new module
- Extend stream-text.ts to handle ChatBridge tool call routing
- App tool results fed back to streamText continuation

## Last Updated
2026-04-02 by brownfield-planning exploration
