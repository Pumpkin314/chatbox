import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCreateConversation,
  mockListConversations,
  mockGetConversation,
  mockDeleteConversation,
  mockGetMessages,
  mockSaveMessage,
} = vi.hoisted(() => ({
  mockCreateConversation: vi.fn(),
  mockListConversations: vi.fn(),
  mockGetConversation: vi.fn(),
  mockDeleteConversation: vi.fn(),
  mockGetMessages: vi.fn(),
  mockSaveMessage: vi.fn(),
}))

vi.mock('../storage.js', () => ({
  createConversation: mockCreateConversation,
  listConversations: mockListConversations,
  getConversation: mockGetConversation,
  deleteConversation: mockDeleteConversation,
  getMessages: mockGetMessages,
  saveMessage: mockSaveMessage,
}))

vi.mock('../supabase.js', () => ({
  getSupabaseClient: vi.fn(() => ({})),
}))

import {
  createSupabaseSession,
  listSupabaseSessions,
  loadSupabaseMessages,
  deleteSupabaseSession,
  isSupabaseAvailable,
} from '../chatStoreSupabase.js'

describe('chatStore Supabase integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when authenticated', () => {
    it('createSupabaseSession creates a conversation in Supabase', async () => {
      const fakeConv = {
        id: 'conv-1',
        user_id: 'user-1',
        title: 'My Chat',
        created_at: '2026-04-02T00:00:00Z',
        updated_at: '2026-04-02T00:00:00Z',
      }
      mockCreateConversation.mockResolvedValue(fakeConv)

      const result = await createSupabaseSession('user-1', 'My Chat')
      expect(mockCreateConversation).toHaveBeenCalledWith('user-1', 'My Chat')
      expect(result).toEqual(fakeConv)
    })

    it('listSupabaseSessions fetches conversations from Supabase', async () => {
      const fakeConvs = [
        { id: 'c1', user_id: 'u1', title: 'Chat 1', created_at: '', updated_at: '' },
        { id: 'c2', user_id: 'u1', title: 'Chat 2', created_at: '', updated_at: '' },
      ]
      mockListConversations.mockResolvedValue(fakeConvs)

      const result = await listSupabaseSessions('u1')
      expect(mockListConversations).toHaveBeenCalledWith('u1')
      expect(result).toHaveLength(2)
    })

    it('loadSupabaseMessages loads messages for a conversation', async () => {
      const fakeMsgs = [
        { id: 'm1', conversation_id: 'c1', role: 'user', content: 'Hello', tool_call: null, app_state: null, token_usage: null, created_at: '' },
        { id: 'm2', conversation_id: 'c1', role: 'assistant', content: 'Hi!', tool_call: null, app_state: null, token_usage: null, created_at: '' },
      ]
      mockGetMessages.mockResolvedValue(fakeMsgs)

      const result = await loadSupabaseMessages('c1')
      expect(mockGetMessages).toHaveBeenCalledWith('c1')
      expect(result).toHaveLength(2)
    })

    it('deleteSupabaseSession deletes a conversation from Supabase', async () => {
      mockDeleteConversation.mockResolvedValue(undefined)

      await deleteSupabaseSession('conv-1')
      expect(mockDeleteConversation).toHaveBeenCalledWith('conv-1')
    })
  })

  describe('isSupabaseAvailable', () => {
    it('returns true when client exists', () => {
      expect(isSupabaseAvailable()).toBe(true)
    })
  })
})
