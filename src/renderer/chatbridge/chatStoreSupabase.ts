/**
 * Supabase-backed conversation operations for chatStore integration.
 * These functions wrap the storage layer and provide a bridge between
 * the existing chatStore patterns and Supabase persistence.
 *
 * When Supabase is unavailable, all functions gracefully degrade.
 */
import { getSupabaseClient } from './supabase.js'
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  getMessages,
  saveMessage,
  type Conversation,
  type MessageRecord,
} from './storage.js'

export { type Conversation, type MessageRecord } from './storage.js'

/**
 * Check if Supabase client is available (configured).
 */
export function isSupabaseAvailable(): boolean {
  return getSupabaseClient() !== null
}

/**
 * Create a new conversation in Supabase.
 */
export async function createSupabaseSession(userId: string, title?: string): Promise<Conversation | null> {
  return createConversation(userId, title)
}

/**
 * List all conversations for a user from Supabase.
 */
export async function listSupabaseSessions(userId: string): Promise<Conversation[]> {
  return listConversations(userId)
}

/**
 * Load messages for a conversation from Supabase.
 */
export async function loadSupabaseMessages(conversationId: string): Promise<MessageRecord[]> {
  return getMessages(conversationId)
}

/**
 * Delete a conversation from Supabase.
 */
export async function deleteSupabaseSession(conversationId: string): Promise<void> {
  return deleteConversation(conversationId)
}

/**
 * Get a single conversation from Supabase.
 */
export async function getSupabaseSession(conversationId: string): Promise<Conversation | null> {
  return getConversation(conversationId)
}

/**
 * Save a message to Supabase (fire-and-forget safe).
 */
export async function saveSupabaseMessage(conversationId: string, message: MessageRecord): Promise<void> {
  return saveMessage(conversationId, message)
}
