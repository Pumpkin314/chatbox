import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the supabase module before importing token-logger
vi.mock('../supabase', () => ({
  getSupabaseClient: vi.fn(),
}))

import { getSupabaseClient } from '../supabase'
import { logTokenUsage } from '../token-logger'

const mockGetSupabaseClient = vi.mocked(getSupabaseClient)

describe('logTokenUsage', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetSupabaseClient.mockReset()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('inserts correct record to Supabase', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    mockGetSupabaseClient.mockReturnValue({ from: mockFrom } as any)

    await logTokenUsage({
      userId: 'user-123',
      conversationId: 'conv-456',
      model: 'gpt-4o',
      promptTokens: 1000,
      completionTokens: 500,
    })

    expect(mockFrom).toHaveBeenCalledWith('token_usage_log')
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'user-123',
        conversation_id: 'conv-456',
        model: 'gpt-4o',
        prompt_tokens: 1000,
        completion_tokens: 500,
        estimated_cost: expect.any(Number),
      }),
    ])
  })

  it('handles null Supabase client gracefully (console.log)', async () => {
    mockGetSupabaseClient.mockReturnValue(null)

    await logTokenUsage({
      model: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TokenLogger]'),
      expect.objectContaining({
        model: 'gpt-4o',
        prompt_tokens: 100,
        completion_tokens: 50,
      })
    )
  })

  it('skips insert when no userId is provided', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    mockGetSupabaseClient.mockReturnValue({ from: mockFrom } as any)

    await logTokenUsage({
      model: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No authenticated user'),
      expect.anything()
    )
  })

  it('calculates cost correctly for gpt-4o', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    mockGetSupabaseClient.mockReturnValue({ from: mockFrom } as any)

    await logTokenUsage({
      userId: 'user-123',
      model: 'gpt-4o',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    })

    // gpt-4o: $2.50/1M input + $10.00/1M output = $12.50
    const insertedRecord = mockInsert.mock.calls[0][0][0]
    expect(insertedRecord.estimated_cost).toBeCloseTo(12.5, 5)
  })

  it('calculates cost correctly for gpt-4o-mini', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    mockGetSupabaseClient.mockReturnValue({ from: mockFrom } as any)

    await logTokenUsage({
      userId: 'user-123',
      model: 'gpt-4o-mini',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    })

    // gpt-4o-mini: $0.15/1M input + $0.60/1M output = $0.75
    const insertedRecord = mockInsert.mock.calls[0][0][0]
    expect(insertedRecord.estimated_cost).toBeCloseTo(0.75, 5)
  })

  it('uses default pricing for unknown models', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    mockGetSupabaseClient.mockReturnValue({ from: mockFrom } as any)

    await logTokenUsage({
      userId: 'user-123',
      model: 'some-unknown-model',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    })

    // Default: $1.00/1M input + $3.00/1M output = $4.00
    const insertedRecord = mockInsert.mock.calls[0][0][0]
    expect(insertedRecord.estimated_cost).toBeCloseTo(4.0, 5)
  })

  it('does not throw on Supabase error', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: new Error('DB connection failed') })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    mockGetSupabaseClient.mockReturnValue({ from: mockFrom } as any)

    // Should not throw
    await expect(
      logTokenUsage({
        userId: 'user-123',
        model: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      })
    ).resolves.toBeUndefined()

    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('does not throw when insert throws an exception', async () => {
    const mockInsert = vi.fn().mockRejectedValue(new Error('Network error'))
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    mockGetSupabaseClient.mockReturnValue({ from: mockFrom } as any)

    await expect(
      logTokenUsage({
        userId: 'user-123',
        model: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      })
    ).resolves.toBeUndefined()

    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
