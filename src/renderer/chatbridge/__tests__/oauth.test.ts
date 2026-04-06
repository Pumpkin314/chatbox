/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Will be implemented in oauth.ts
import {
  generateCodeVerifier,
  generateCodeChallenge,
  exchangeCodeForTokens,
  refreshAccessToken,
  storeState,
  getState,
  storeToken,
  deleteToken,
} from '../oauth'

// Mock supabase module
const mockFrom = vi.fn()
vi.mock('../supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

describe('PKCE helpers', () => {
  it('generateCodeVerifier returns string between 43-128 chars with valid base64url chars', () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    // base64url charset: A-Z, a-z, 0-9, -, _
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('generateCodeChallenge returns correct base64url SHA-256 for known test vector', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = await generateCodeChallenge(verifier)
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })
})

describe('exchangeCodeForTokens', () => {
  const authConfig = {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnvVar: 'VITE_GOOGLE_BOOKS_CLIENT_ID',
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to tokenUrl with correct body and returns tokens with computed expires_at', async () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires_in: 3600,
        }),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response)

    const result = await exchangeCodeForTokens('auth-code', 'my-verifier', authConfig, 'http://localhost/callback')

    expect(fetch).toHaveBeenCalledOnce()
    const [url, opts] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(opts?.method).toBe('POST')
    expect(opts?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })

    const body = new URLSearchParams(opts?.body as string)
    expect(body.get('code')).toBe('auth-code')
    expect(body.get('redirect_uri')).toBe('http://localhost/callback')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code_verifier')).toBe('my-verifier')

    expect(result).toEqual({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_at: now + 3600 * 1000,
    })
  })

  it('throws on fetch failure (400)', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

    await expect(
      exchangeCodeForTokens('bad-code', 'verifier', authConfig, 'http://localhost/callback'),
    ).rejects.toThrow('Token exchange failed: 400')
  })
})

describe('refreshAccessToken', () => {
  const authConfig = {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnvVar: 'VITE_GOOGLE_BOOKS_CLIENT_ID',
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs with grant_type=refresh_token and returns new access_token + expires_at', async () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-access-789',
          expires_in: 3600,
        }),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response)

    const result = await refreshAccessToken('refresh-456', authConfig)

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    const body = new URLSearchParams(opts?.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('refresh-456')

    expect(result).toEqual({
      access_token: 'new-access-789',
      expires_at: now + 3600 * 1000,
    })
  })

  it('throws on 401 response', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

    await expect(refreshAccessToken('bad-refresh', authConfig)).rejects.toThrow('Token refresh failed: 401')
  })
})

describe('refresh mutex', () => {
  const authConfig = {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnvVar: 'VITE_GOOGLE_BOOKS_CLIENT_ID',
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('concurrent refresh calls share same promise — fetch called only once', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'shared-token',
          expires_in: 3600,
        }),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response)

    const [r1, r2] = await Promise.all([
      refreshAccessToken('refresh-456', authConfig),
      refreshAccessToken('refresh-456', authConfig),
    ])

    expect(fetch).toHaveBeenCalledOnce()
    expect(r1.access_token).toBe('shared-token')
    expect(r2.access_token).toBe('shared-token')
  })
})

describe('PKCE state map', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores and retrieves verifier + appId by state', () => {
    storeState('state-abc', 'verifier-xyz', 'google-books')
    const result = getState('state-abc')
    expect(result).toEqual({ verifier: 'verifier-xyz', appId: 'google-books' })
  })

  it('returns null for unknown state', () => {
    expect(getState('unknown')).toBeNull()
  })

  it('entries are one-time use', () => {
    storeState('state-once', 'verifier-once', 'app')
    expect(getState('state-once')).not.toBeNull()
    expect(getState('state-once')).toBeNull()
  })

  it('entries expire after 5 minutes', () => {
    storeState('state-ttl', 'verifier-ttl', 'app')
    // Advance time past 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(getState('state-ttl')).toBeNull()
  })
})

describe('deleteToken', () => {
  it('calls supabase delete with correct params', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockEq1 = vi.fn(() => ({ eq: mockEq2 }))
    const mockDelete = vi.fn(() => ({ eq: mockEq1 }))
    mockFrom.mockReturnValue({ delete: mockDelete })

    await deleteToken('user-1', 'google-books')

    expect(mockFrom).toHaveBeenCalledWith('user_app_tokens')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq1).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockEq2).toHaveBeenCalledWith('app_id', 'google-books')
  })
})

describe('storeToken', () => {
  it('calls supabase upsert with correct params', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue({ upsert: mockUpsert })

    await storeToken('user-1', 'google-books', {
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_at: 1700000000000,
    })

    expect(mockFrom).toHaveBeenCalledWith('user_app_tokens')
    expect(mockUpsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      app_id: 'google-books',
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_at: new Date(1700000000000).toISOString(),
    })
  })
})
