-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'app_context')),
  content TEXT,
  tool_call JSONB,
  app_state JSONB,
  token_usage JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- App Registry (seeded, not user-managed in MVP)
CREATE TABLE app_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('internal', 'external_public', 'external_authenticated')),
  tools JSONB NOT NULL DEFAULT '[]',
  entrypoint TEXT NOT NULL,
  auth_config JSONB,
  enabled BOOLEAN DEFAULT true
);

-- Token Usage Log
CREATE TABLE token_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  conversation_id UUID REFERENCES conversations,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  estimated_cost NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_token_usage_user ON token_usage_log(user_id, created_at);

-- OAuth Tokens
CREATE TABLE user_app_tokens (
  user_id UUID REFERENCES auth.users NOT NULL,
  app_id TEXT REFERENCES app_registry NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);

-- Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own messages" ON messages
  FOR ALL USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users see own token usage" ON token_usage_log
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own tokens" ON user_app_tokens
  FOR ALL USING (auth.uid() = user_id);
