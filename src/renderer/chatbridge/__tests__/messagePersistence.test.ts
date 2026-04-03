import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSaveMessage } = vi.hoisted(() => ({
  mockSaveMessage: vi.fn(),
}))

vi.mock('../storage.js', () => ({
  saveMessage: mockSaveMessage,
}))

vi.mock('../supabase.js', () => ({
  getSupabaseClient: vi.fn(() => ({})),
}))

import { persistMessagePair } from '../messagePersistence.js'
import type { MessageRecord } from '../storage.js'

describe('Message persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves user and assistant messages with correct fields after completion', async () => {
    mockSaveMessage.mockResolvedValue(undefined)

    const conversationId = 'conv-123'
    const userMessage = {
      id: 'msg-user-1',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Hello AI' }],
      timestamp: Date.now(),
    }
    const assistantMessage = {
      id: 'msg-asst-1',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Hello! How can I help?' }],
      timestamp: Date.now(),
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
    }

    await persistMessagePair(conversationId, userMessage, assistantMessage)

    // Should save user message
    expect(mockSaveMessage).toHaveBeenCalledTimes(2)

    const userCall = mockSaveMessage.mock.calls[0]
    expect(userCall[0]).toBe(conversationId)
    expect(userCall[1]).toMatchObject({
      id: 'msg-user-1',
      conversation_id: conversationId,
      role: 'user',
      content: 'Hello AI',
    })

    // Should save assistant message with token usage
    const assistantCall = mockSaveMessage.mock.calls[1]
    expect(assistantCall[0]).toBe(conversationId)
    expect(assistantCall[1]).toMatchObject({
      id: 'msg-asst-1',
      conversation_id: conversationId,
      role: 'assistant',
      content: 'Hello! How can I help?',
      token_usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
    })
  })

  it('handles tool call content parts', async () => {
    mockSaveMessage.mockResolvedValue(undefined)

    const assistantMessage = {
      id: 'msg-asst-2',
      role: 'assistant' as const,
      contentParts: [
        { type: 'tool-call' as const, state: 'call' as const, toolCallId: 'tc-1', toolName: 'search', args: { q: 'test' } },
        { type: 'text' as const, text: 'Here are the results' },
      ],
      timestamp: Date.now(),
    }

    await persistMessagePair('conv-1', { id: 'u1', role: 'user', contentParts: [{ type: 'text' as const, text: 'search' }], timestamp: Date.now() }, assistantMessage)

    const assistantCall = mockSaveMessage.mock.calls[1]
    expect(assistantCall[1].tool_call).toEqual([
      { toolCallId: 'tc-1', toolName: 'search', args: { q: 'test' }, state: 'call' },
    ])
    expect(assistantCall[1].content).toBe('Here are the results')
  })

  it('does not throw when Supabase save fails', async () => {
    mockSaveMessage.mockRejectedValue(new Error('Network error'))

    const userMessage = {
      id: 'u1',
      role: 'user' as const,
      contentParts: [{ type: 'text' as const, text: 'Hi' }],
      timestamp: Date.now(),
    }
    const assistantMessage = {
      id: 'a1',
      role: 'assistant' as const,
      contentParts: [{ type: 'text' as const, text: 'Hello' }],
      timestamp: Date.now(),
    }

    // Should not throw - fire and forget semantics
    await expect(persistMessagePair('conv-1', userMessage, assistantMessage)).resolves.toBeUndefined()
  })
})
