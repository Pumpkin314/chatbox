import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'

const {
  mockSignInWithPassword,
  mockSignUp,
  mockSignOut,
  mockGetSession,
  mockOnAuthStateChange,
} = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}))

vi.mock('@/chatbridge/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

import { createStore } from 'jotai'
import {
  userAtom,
  sessionAtom,
  authLoadingAtom,
  signIn,
  signUp as authSignUp,
  signOut as authSignOut,
  initAuth,
} from '@/chatbridge/auth'

describe('auth store + atoms', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    vi.clearAllMocks()
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  describe('initial state', () => {
    it('userAtom initializes to null', () => {
      expect(store.get(userAtom)).toBeNull()
    })

    it('sessionAtom initializes to null', () => {
      expect(store.get(sessionAtom)).toBeNull()
    })

    it('authLoadingAtom initializes to true', () => {
      expect(store.get(authLoadingAtom)).toBe(true)
    })
  })

  describe('signIn', () => {
    it('calls supabase.auth.signInWithPassword with email and password', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      })
      await signIn('test@example.com', 'password123')
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })

    it('returns error when sign in fails', async () => {
      const mockError = { message: 'Invalid credentials' }
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      })
      const result = await signIn('test@example.com', 'wrong')
      expect(result.error).toEqual(mockError)
    })
  })

  describe('signUp', () => {
    it('calls supabase.auth.signUp with email and password', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      })
      await authSignUp('new@example.com', 'password123')
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
      })
    })
  })

  describe('signOut', () => {
    it('calls supabase.auth.signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null })
      await authSignOut()
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  describe('onAuthStateChange', () => {
    it('initAuth registers an onAuthStateChange listener', () => {
      initAuth(store)
      expect(mockOnAuthStateChange).toHaveBeenCalled()
    })

    it('updates atoms when auth state changes', () => {
      let authCallback: (event: string, session: Session | null) => void = () => {}
      mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      initAuth(store)

      const mockUser: Partial<User> = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        created_at: '2024-01-01',
        app_metadata: {},
        user_metadata: {},
      }
      const mockSession: Partial<Session> = {
        access_token: 'token-abc',
        refresh_token: 'refresh-abc',
        user: mockUser as User,
        token_type: 'bearer',
        expires_in: 3600,
      }

      authCallback('SIGNED_IN', mockSession as Session)

      expect(store.get(userAtom)).toEqual(mockUser)
      expect(store.get(sessionAtom)).toEqual(mockSession)
      expect(store.get(authLoadingAtom)).toBe(false)
    })

    it('clears atoms on SIGNED_OUT', () => {
      let authCallback: (event: string, session: Session | null) => void = () => {}
      mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      initAuth(store)

      authCallback('SIGNED_OUT', null)

      expect(store.get(userAtom)).toBeNull()
      expect(store.get(sessionAtom)).toBeNull()
      expect(store.get(authLoadingAtom)).toBe(false)
    })
  })
})

describe('auth with null supabase client', () => {
  it('signIn returns not-configured error when supabase is null', async () => {
    // Verify the null-guard logic directly: when supabase is null, the function
    // returns an error with 'not configured'. We test this by temporarily
    // overriding the module-level supabase reference via vi.doMock + dynamic import.
    vi.resetModules()
    vi.doMock('@/chatbridge/supabase', () => ({ supabase: null }))
    const authModule = await import('@/chatbridge/auth')
    const result = await authModule.signIn('test@example.com', 'password')
    expect(result.error).toBeDefined()
    expect(result.error?.message).toContain('not configured')
  })
})
