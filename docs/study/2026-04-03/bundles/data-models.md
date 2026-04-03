# Data Models Bundle

## Supabase Schema (5 Tables)

### conversations
```sql
id UUID PRIMARY KEY, user_id UUID (FK auth.users), title TEXT,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
-- RLS: users see own conversations only
```

### messages
```sql
id UUID PRIMARY KEY, conversation_id UUID (FK conversations ON DELETE CASCADE),
role TEXT CHECK ('user','assistant','system','app_context'),
content TEXT, tool_call JSONB, app_state JSONB, token_usage JSONB,
created_at TIMESTAMPTZ
-- Index on (conversation_id, created_at)
-- RLS: users see own messages via conversation ownership
```

### app_registry
```sql
id TEXT PRIMARY KEY, name TEXT, description TEXT,
type TEXT CHECK ('internal','external_public','external_authenticated'),
tools JSONB DEFAULT '[]', entrypoint TEXT, auth_config JSONB, enabled BOOLEAN
-- Seeded but NOT used in MVP (static JSON registry instead)
```

### token_usage_log
```sql
id UUID PRIMARY KEY, user_id UUID, conversation_id UUID,
model TEXT, prompt_tokens INTEGER, completion_tokens INTEGER,
estimated_cost NUMERIC(10,6), created_at TIMESTAMPTZ
-- Index on (user_id, created_at)
```

### user_app_tokens
```sql
user_id UUID + app_id TEXT (composite PK),
access_token TEXT, refresh_token TEXT, expires_at TIMESTAMPTZ
```

## App Registration (apps.json)

```typescript
interface AppRegistration {
  id: string              // "chess" | "weather" | "spotify"
  name: string            // Display name
  description: string     // For LLM tool descriptions
  type: "internal" | "external_public" | "external_authenticated"
  tools: ToolSchema[]     // JSON Schema tool definitions
  entrypoint: string      // Path to bundled HTML
  authConfig: AuthConfig | null
  enabled: boolean
}
```

## Bridge Message Envelope

```typescript
{ type: string, id: string (UUID), payload: object, timestamp: number }
```

Types: `app_init`, `app_init_ack`, `tool_call`, `tool_call_result`, `state_update`, `app_complete`, `error`, `ping`, `ready`

## App State in Conversation

- Active state stored in `appStateAtom` (Jotai)
- On panel close: serialized as `app_context` message in conversation
- On LLM call: injected into system prompt via `system-prompt.ts`
- On app reopen: passed as `existingState` in `app_init` payload
