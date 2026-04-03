import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Conversation, MessageRecord } from '../storage.js'

// Mock supabase module
const mockFrom = vi.fn()
const mockSupabaseClient = { from: mockFrom }

vi.mock('../supabase.js', () => ({
  getSupabaseClient: vi.fn(() => mockSupabaseClient),
}))

// Import after mock
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  saveMessage,
  getMessages,
} from '../storage.js'
import { getSupabaseClient } from '../supabase.js'

describe('Supabase storage layer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createConversation', () => {
    it('inserts into Supabase conversations table and returns the conversation', async () => {
      const fakeConversation: Conversation = {
        id: 'conv-1',
        user_id: 'user-1',
        title: 'Test Chat',
        created_at: '2026-04-02T00:00:00Z',
        updated_at: '2026-04-02T00:00:00Z',
      }

      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: fakeConversation, error: null }),
          }),
        }),
      })

      const result = await createConversation('user-1', 'Test Chat')
      expect(mockFrom).toHaveBeenCalledWith('conversations')
      expect(result).toEqual(fakeConversation)
    })
  })

  describe('listConversations', () => {
    it('returns array of conversations from Supabase ordered by updated_at desc', async () => {
      const fakeConversations: Conversation[] = [
        { id: 'c1', user_id: 'u1', title: 'Chat 1', created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-02T00:00:00Z' },
        { id: 'c2', user_id: 'u1', title: 'Chat 2', created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z' },
      ]

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: fakeConversations, error: null }),
          }),
        }),
      })

      const result = await listConversations('u1')
      expect(mockFrom).toHaveBeenCalledWith('conversations')
      expect(result).toEqual(fakeConversations)
      expect(result).toHaveLength(2)
    })
  })

  describe('getConversation', () => {
    it('returns a single conversation by id', async () => {
      const fakeConversation: Conversation = {
        id: 'conv-1',
        user_id: 'user-1',
        title: 'Test',
        created_at: '2026-04-02T00:00:00Z',
        updated_at: '2026-04-02T00:00:00Z',
      }

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: fakeConversation, error: null }),
          }),
        }),
      })

      const result = await getConversation('conv-1')
      expect(result).toEqual(fakeConversation)
    })
  })

  describe('deleteConversation', () => {
    it('deletes a conversation by id', async () => {
      mockFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      await expect(deleteConversation('conv-1')).resolves.toBeUndefined()
      expect(mockFrom).toHaveBeenCalledWith('conversations')
    })
  })

  describe('saveMessage', () => {
    it('inserts a message record into Supabase messages table', async () => {
      const msg: MessageRecord = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Hello',
        tool_call: null,
        app_state: null,
        token_usage: null,
        created_at: '2026-04-02T00:00:00Z',
      }

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })

      await expect(saveMessage('conv-1', msg)).resolves.toBeUndefined()
      expect(mockFrom).toHaveBeenCalledWith('messages')
    })
  })

  describe('getMessages', () => {
    it('returns messages ordered by created_at ascending', async () => {
      const msgs: MessageRecord[] = [
        { id: 'm1', conversation_id: 'c1', role: 'user', content: 'Hi', tool_call: null, app_state: null, token_usage: null, created_at: '2026-04-02T00:00:00Z' },
        { id: 'm2', conversation_id: 'c1', role: 'assistant', content: 'Hello!', tool_call: null, app_state: null, token_usage: null, created_at: '2026-04-02T00:00:01Z' },
      ]

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: msgs, error: null }),
          }),
        }),
      })

      const result = await getMessages('c1')
      expect(mockFrom).toHaveBeenCalledWith('messages')
      expect(result).toEqual(msgs)
      expect(result).toHaveLength(2)
    })
  })

  describe('null Supabase client graceful fallback', () => {
    beforeEach(() => {
      vi.mocked(getSupabaseClient).mockReturnValue(null)
    })

    it('createConversation returns null when Supabase is unavailable', async () => {
      const result = await createConversation('user-1', 'Test')
      expect(result).toBeNull()
    })

    it('listConversations returns empty array when Supabase is unavailable', async () => {
      const result = await listConversations('user-1')
      expect(result).toEqual([])
    })

    it('getConversation returns null when Supabase is unavailable', async () => {
      const result = await getConversation('conv-1')
      expect(result).toBeNull()
    })

    it('deleteConversation completes without error when Supabase is unavailable', async () => {
      await expect(deleteConversation('conv-1')).resolves.toBeUndefined()
    })

    it('saveMessage completes without error when Supabase is unavailable', async () => {
      const msg: MessageRecord = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Hello',
        tool_call: null,
        app_state: null,
        token_usage: null,
        created_at: '2026-04-02T00:00:00Z',
      }
      await expect(saveMessage('conv-1', msg)).resolves.toBeUndefined()
    })

    it('getMessages returns empty array when Supabase is unavailable', async () => {
      const result = await getMessages('conv-1')
      expect(result).toEqual([])
    })
  })
})
