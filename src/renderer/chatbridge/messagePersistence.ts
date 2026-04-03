/**
 * Message persistence to Supabase.
 * Converts Chatbox Message format to MessageRecord and persists after completion.
 * Fire-and-forget: errors are caught and logged, never thrown.
 */
import { saveMessage, type MessageRecord } from './storage.js'

interface ContentPart {
  type: string
  text?: string
  toolCallId?: string
  toolName?: string
  args?: unknown
  state?: string
  [key: string]: unknown
}

interface ChatMessage {
  id: string
  role: string
  contentParts: ContentPart[]
  timestamp?: number
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    reasoningTokens?: number
    cachedInputTokens?: number
  }
  [key: string]: unknown
}

/**
 * Extract text content from contentParts.
 */
function extractTextContent(parts: ContentPart[]): string | null {
  const textParts = parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text!)
  return textParts.length > 0 ? textParts.join('') : null
}

/**
 * Extract tool call data from contentParts.
 */
function extractToolCalls(parts: ContentPart[]): any[] | null {
  const toolCalls = parts
    .filter((p) => p.type === 'tool-call')
    .map((p) => ({
      toolCallId: p.toolCallId,
      toolName: p.toolName,
      args: p.args,
      state: p.state,
    }))
  return toolCalls.length > 0 ? toolCalls : null
}

/**
 * Convert a ChatMessage to a MessageRecord for Supabase storage.
 */
function toMessageRecord(conversationId: string, msg: ChatMessage): MessageRecord {
  return {
    id: msg.id,
    conversation_id: conversationId,
    role: msg.role,
    content: extractTextContent(msg.contentParts),
    tool_call: extractToolCalls(msg.contentParts),
    app_state: null,
    token_usage: msg.usage ?? null,
    created_at: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
  }
}

/**
 * Persist a user + assistant message pair to Supabase.
 * This is fire-and-forget: errors are caught and logged, never thrown.
 * Should be called after the assistant message completes (not during streaming).
 */
export async function persistMessagePair(
  conversationId: string,
  userMessage: ChatMessage,
  assistantMessage: ChatMessage
): Promise<void> {
  try {
    const userRecord = toMessageRecord(conversationId, userMessage)
    const assistantRecord = toMessageRecord(conversationId, assistantMessage)

    await saveMessage(conversationId, userRecord)
    await saveMessage(conversationId, assistantRecord)
  } catch (error) {
    console.warn('[ChatBridge] Failed to persist messages:', error)
  }
}

/**
 * Persist a single message to Supabase.
 * Fire-and-forget: errors are caught and logged.
 */
export async function persistMessage(
  conversationId: string,
  message: ChatMessage
): Promise<void> {
  try {
    const record = toMessageRecord(conversationId, message)
    await saveMessage(conversationId, record)
  } catch (error) {
    console.warn('[ChatBridge] Failed to persist message:', error)
  }
}
