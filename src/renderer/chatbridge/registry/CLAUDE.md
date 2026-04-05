# ChatBridge Registry

Static app registry defining available ChatBridge apps and their tool schemas.

## Files

- `apps.json` — App definitions: id, name, description, type, tools (with JSON Schema parameters), entrypoint, auth config
- `index.ts` — TypeScript types (`AppRegistration`, `ToolSchema`, `AuthConfig`) and loader

## Key Rules

- Every app in `../apps/` must have a corresponding entry in `apps.json`
- Tool schemas define the LLM function-calling interface — changes affect prompt injection and tool routing
- `entrypoint` paths are relative URLs (e.g., `/apps/chess/index.html`)
