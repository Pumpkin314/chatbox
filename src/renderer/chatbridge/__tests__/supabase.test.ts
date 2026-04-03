import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to mock import.meta.env before importing the module
describe('getSupabaseClient', () => {
  beforeEach(() => {
    // Reset module cache between tests so singleton resets
    vi.resetModules()
  })

  it('returns null when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { getSupabaseClient } = await import('../supabase')
    const client = getSupabaseClient()
    expect(client).toBeNull()

    vi.unstubAllEnvs()
  })

  it('returns null when only URL is set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { getSupabaseClient } = await import('../supabase')
    const client = getSupabaseClient()
    expect(client).toBeNull()

    vi.unstubAllEnvs()
  })

  it('returns a Supabase client when env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key-1234')

    const { getSupabaseClient } = await import('../supabase')
    const client = getSupabaseClient()
    expect(client).not.toBeNull()
    expect(client).toBeDefined()

    vi.unstubAllEnvs()
  })

  it('returns the same singleton instance on multiple calls', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key-1234')

    const { getSupabaseClient } = await import('../supabase')
    const client1 = getSupabaseClient()
    const client2 = getSupabaseClient()
    expect(client1).toBe(client2)

    vi.unstubAllEnvs()
  })
})
