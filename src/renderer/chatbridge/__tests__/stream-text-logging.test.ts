import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase - return null client to trigger console.log fallback
vi.mock('../supabase', () => ({
  getSupabaseClient: vi.fn().mockReturnValue(null),
}))

import { logTokenUsageFromResult } from '../token-logger'

describe('logTokenUsageFromResult (streamText integration)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('after a streamText call completes, logTokenUsage is called with correct values', async () => {
    const mockResult = {
      contentParts: [],
      usage: {
        promptTokens: 150,
        completionTokens: 75,
        totalTokens: 225,
      },
      finishReason: 'stop' as const,
    }

    logTokenUsageFromResult(mockResult, 'gpt-4o', 'session-123')

    // Allow the fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 10))

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TokenLogger]'),
      expect.objectContaining({
        model: 'gpt-4o',
        prompt_tokens: 150,
        completion_tokens: 75,
        conversation_id: 'session-123',
      })
    )
  })

  it('does not log when result has no usage data', async () => {
    const mockResult = {
      contentParts: [],
      finishReason: 'stop' as const,
    }

    logTokenUsageFromResult(mockResult, 'gpt-4o', 'session-123')

    await new Promise((r) => setTimeout(r, 10))

    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('does not log when usage has zero tokens', async () => {
    const mockResult = {
      contentParts: [],
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    }

    logTokenUsageFromResult(mockResult, 'gpt-4o')

    await new Promise((r) => setTimeout(r, 10))

    expect(consoleSpy).not.toHaveBeenCalled()
  })
})
