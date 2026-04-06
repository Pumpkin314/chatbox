/**
 * @vitest-environment jsdom
 */

// Mantine requires window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

import { activeAppAtom } from '@/chatbridge/app-lifecycle'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SidePanel from '../SidePanel'

// --- Mocks ---

const mockSendMessage = vi.fn().mockResolvedValue(undefined)
const mockInstallMessageListener = vi.fn().mockReturnValue(() => {})

vi.mock('@/chatbridge/bridge', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  installMessageListener: () => mockInstallMessageListener(),
  clearPending: vi.fn(),
  clearHandlers: vi.fn(),
}))

vi.mock('@/chatbridge/tool-router', () => ({
  setBridgeRef: vi.fn(),
}))

const mockExchangeCodeForTokens = vi.fn()
const mockStoreToken = vi.fn()
const mockGenerateCodeVerifier = vi.fn().mockReturnValue('test-verifier')
const mockGenerateCodeChallenge = vi.fn().mockResolvedValue('test-challenge')
const mockStoreState = vi.fn()
const mockGetState = vi.fn()
const mockBuildAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?test=1')

vi.mock('@/chatbridge/oauth', () => ({
  generateCodeVerifier: () => mockGenerateCodeVerifier(),
  generateCodeChallenge: (...args: unknown[]) => mockGenerateCodeChallenge(...args),
  storeState: (...args: unknown[]) => mockStoreState(...args),
  getState: (...args: unknown[]) => mockGetState(...args),
  buildAuthUrl: (...args: unknown[]) => mockBuildAuthUrl(...args),
  exchangeCodeForTokens: (...args: unknown[]) => mockExchangeCodeForTokens(...args),
  storeToken: (...args: unknown[]) => mockStoreToken(...args),
}))

vi.mock('@/chatbridge/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
  }),
}))

// Mock the registry to return a known app with authConfig for 'google-books'
vi.mock('@/chatbridge/registry', () => ({
  getAppById: (id: string) => {
    if (id === 'test-app') {
      return {
        id: 'test-app',
        name: 'Test App',
        description: 'A test ChatBridge app',
        entrypoint: 'about:blank',
        type: 'internal',
        tools: [],
        authConfig: null,
        enabled: true,
      }
    }
    if (id === 'google-books') {
      return {
        id: 'google-books',
        name: 'Reading Assistant',
        description: 'Search books and manage your reading list with Google Books',
        entrypoint: 'about:blank',
        type: 'external_authenticated',
        tools: [],
        authConfig: {
          type: 'oauth2_pkce',
          provider: 'google',
          authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          clientIdEnvVar: 'VITE_GOOGLE_BOOKS_CLIENT_ID',
          scopes: ['https://www.googleapis.com/auth/books'],
        },
        enabled: true,
      }
    }
    return null
  },
}))

// Track window.open calls
let mockWindowOpen: ReturnType<typeof vi.fn>

function Wrapper({ children, store }: { children: ReactNode; store: ReturnType<typeof createStore> }) {
  return (
    <MantineProvider>
      <Provider store={store}>{children}</Provider>
    </MantineProvider>
  )
}

function renderWithStore(store: ReturnType<typeof createStore>) {
  return render(
    <Wrapper store={store}>
      <SidePanel />
    </Wrapper>,
  )
}

/**
 * Dispatch a MessageEvent to window and flush microtasks.
 */
async function dispatchWindowMessage(data: unknown) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { data }))
    // Allow async handlers to complete
    await new Promise((r) => setTimeout(r, 50))
  })
}

describe('SidePanel OAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.open
    mockWindowOpen = vi.fn().mockReturnValue({ closed: false })
    vi.stubGlobal('open', mockWindowOpen)

    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      ...crypto,
      randomUUID: () => 'test-state-uuid',
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('opens Google auth URL when iframe sends auth_request message', async () => {
    const store = createStore()
    store.set(activeAppAtom, 'google-books')
    renderWithStore(store)

    const iframe = screen.getByTestId('chatbridge-iframe')
    fireEvent.load(iframe)

    // Simulate auth_request message from iframe (BridgeMessage format)
    await dispatchWindowMessage({
      type: 'auth_request',
      id: 'msg-123',
      payload: { provider: 'google', appId: 'google-books' },
      timestamp: Date.now(),
    })

    expect(mockWindowOpen).toHaveBeenCalled()
    const openedUrl = mockWindowOpen.mock.calls[0][0]
    expect(openedUrl).toContain('accounts.google.com')
  })

  it('calls exchangeCodeForTokens when oauth_callback arrives with valid code+state', async () => {
    mockGetState.mockReturnValue({ verifier: 'test-verifier', appId: 'google-books' })
    mockExchangeCodeForTokens.mockResolvedValue({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
    })
    mockStoreToken.mockResolvedValue(undefined)

    const store = createStore()
    store.set(activeAppAtom, 'google-books')
    renderWithStore(store)

    const iframe = screen.getByTestId('chatbridge-iframe')
    fireEvent.load(iframe)

    // Simulate oauth_callback from popup (raw postMessage, not BridgeMessage)
    await dispatchWindowMessage({
      type: 'oauth_callback',
      code: 'auth-code-123',
      state: 'test-state-uuid',
    })

    expect(mockExchangeCodeForTokens).toHaveBeenCalledWith(
      'auth-code-123',
      'test-verifier',
      expect.objectContaining({ provider: 'google' }),
      expect.stringContaining('/auth/callback.html'),
    )
  })

  it('sends auth_result with popup_blocked error when window.open returns null', async () => {
    mockWindowOpen.mockReturnValue(null)

    const store = createStore()
    store.set(activeAppAtom, 'google-books')
    renderWithStore(store)

    const iframe = screen.getByTestId('chatbridge-iframe')
    fireEvent.load(iframe)

    await dispatchWindowMessage({
      type: 'auth_request',
      id: 'msg-456',
      payload: { provider: 'google', appId: 'google-books' },
      timestamp: Date.now(),
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      'auth_result',
      { success: false, error: 'popup_blocked' },
    )
  })

  it('sends auth_result with error when callback has error param', async () => {
    const store = createStore()
    store.set(activeAppAtom, 'google-books')
    renderWithStore(store)

    const iframe = screen.getByTestId('chatbridge-iframe')
    fireEvent.load(iframe)

    // Simulate oauth_callback with error (consent denied)
    await dispatchWindowMessage({
      type: 'oauth_callback',
      error: 'access_denied',
      state: 'test-state-uuid',
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      'auth_result',
      { success: false, error: 'access_denied' },
    )
  })

  it('sends auth_result with exchange_failed error when token exchange fails', async () => {
    mockGetState.mockReturnValue({ verifier: 'test-verifier', appId: 'google-books' })
    mockExchangeCodeForTokens.mockRejectedValue(new Error('Token exchange failed: 400'))

    const store = createStore()
    store.set(activeAppAtom, 'google-books')
    renderWithStore(store)

    const iframe = screen.getByTestId('chatbridge-iframe')
    fireEvent.load(iframe)

    await dispatchWindowMessage({
      type: 'oauth_callback',
      code: 'bad-code',
      state: 'test-state-uuid',
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      'auth_result',
      { success: false, error: 'exchange_failed' },
    )
  })

  it('sends auth_result with invalid_state error when state is not found', async () => {
    mockGetState.mockReturnValue(null)

    const store = createStore()
    store.set(activeAppAtom, 'google-books')
    renderWithStore(store)

    const iframe = screen.getByTestId('chatbridge-iframe')
    fireEvent.load(iframe)

    await dispatchWindowMessage({
      type: 'oauth_callback',
      code: 'auth-code-123',
      state: 'unknown-state',
    })

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.anything(),
      'auth_result',
      { success: false, error: 'invalid_state' },
    )
  })
})
