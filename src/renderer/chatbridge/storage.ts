import { v4 as uuidv4 } from 'uuid'
import { getSupabaseClient } from './supabase.js'

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface MessageRecord {
  id: string
  conversation_id: string
  role: string
  content: string | null
  tool_call: any | null
  app_state: any | null
  token_usage: any | null
  created_at: string
}

export async function createConversation(userId: string, title?: string): Promise<Conversation | null> {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[ChatBridge] Supabase unavailable, skipping createConversation')
    return null
  }

  const now = new Date().toISOString()
  const conversation = {
    id: uuidv4(),
    user_id: userId,
    title: title || 'New Conversation',
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await client
    .from('conversations')
    .insert(conversation)
    .select()
    .single()

  if (error) {
    console.warn('[ChatBridge] Failed to create conversation:', error.message)
    return null
  }

  return data as Conversation
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[ChatBridge] Supabase unavailable, skipping listConversations')
    return []
  }

  const { data, error } = await client
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.warn('[ChatBridge] Failed to list conversations:', error.message)
    return []
  }

  return (data as Conversation[]) ?? []
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[ChatBridge] Supabase unavailable, skipping getConversation')
    return null
  }

  const { data, error } = await client
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (error) {
    console.warn('[ChatBridge] Failed to get conversation:', error.message)
    return null
  }

  return data as Conversation
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[ChatBridge] Supabase unavailable, skipping deleteConversation')
    return
  }

  const { error } = await client
    .from('conversations')
    .delete()
    .eq('id', conversationId)

  if (error) {
    console.warn('[ChatBridge] Failed to delete conversation:', error.message)
  }
}

export async function saveMessage(conversationId: string, message: MessageRecord): Promise<void> {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[ChatBridge] Supabase unavailable, skipping saveMessage')
    return
  }

  const { error } = await client
    .from('messages')
    .upsert({ ...message, conversation_id: conversationId })

  if (error) {
    console.warn('[ChatBridge] Failed to save message:', error.message)
  }
}

export async function getMessages(conversationId: string): Promise<MessageRecord[]> {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('[ChatBridge] Supabase unavailable, skipping getMessages')
    return []
  }

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[ChatBridge] Failed to get messages:', error.message)
    return []
  }

  return (data as MessageRecord[]) ?? []
}
