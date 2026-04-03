# stores/

## Purpose
Jotai atom-based state management for the entire renderer. Sessions, settings, UI state, and chat generation logic.

## Key Files
- `chatStore.ts`: Session CRUD — list, create, delete, load conversations via React-Query + storage
- `session/messages.ts`: Message insertion, submission (`submitNewUserMessage`), message mutation
- `session/generation.ts`: Main LLM orchestration — `generate()` drives streamText calls and tool handling
- `settingStore.ts`: User settings atoms (API keys, model selection, preferences)
- `uiStore.ts`: UI state atoms (sidebar mode, theme, layout)

## Patterns
- Jotai atoms with `atomWithStorage` for persistence
- React-Query for async data fetching/caching (session keyed by `['chat-session', id]`)
- Session data stored via platform-agnostic `storage` abstraction (StorageKey enum)
- Generation flow: messages.ts → generation.ts → model-calls/stream-text.ts

## Integration Points
- Depends on: `../packages/model-calls/`, `../storage/`, `../platform/`, `@shared/types/`
- Depended on by: `../components/chat/`, `../pages/`, `../routes/`

## ChatBridge Changes Needed
- Extend generation.ts to inject ChatBridge tools (open_app + active app tools)
- Add app state management atoms for active app, side panel visibility
- Modify message submission to include app context in system prompt

## Last Updated
2026-04-02 by brownfield-planning exploration
