# shared/types/

## Purpose
Shared TypeScript types and Zod schemas used across main, renderer, and preload.

## Key Files
- `session.ts`: Message and Session schemas (Zod) — MessageSchema at lines 189-218
- `types.ts`: Core type definitions (ModelSettings, ProviderSettings, etc.)
- `types.test.ts`: Type validation tests

## Patterns
- Zod schemas for runtime validation + TypeScript types via z.infer
- MessageContentPart is a discriminated union: text | image | tool-call | info | reasoning
- MessageToolCallPart already exists (lines 111-118): type, toolCallId, toolName, args, result

## Integration Points
- Depended on by: all of renderer, main, and shared

## ChatBridge Changes Needed
- Extend MessageSchema with optional app_state (jsonb) field
- Potentially add new MessageContentPart variant for app_context
- Add AppRegistration, BridgeMessage, ToolSchema interfaces

## Last Updated
2026-04-02 by brownfield-planning exploration
