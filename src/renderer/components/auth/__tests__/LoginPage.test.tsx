/**
 * @vitest-environment jsdom
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import '@testing-library/jest-dom'

// MantineProvider requires window.matchMedia
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

const { mockSignIn, mockSignUp } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignUp: vi.fn(),
}))

vi.mock('@/chatbridge/auth', () => ({
  signIn: mockSignIn,
  signUp: mockSignUp,
  signOut: vi.fn(),
  userAtom: { init: null, read: () => null, write: () => {} },
  sessionAtom: { init: null, read: () => null, write: () => {} },
  authLoadingAtom: { init: false, read: () => false, write: () => {} },
  initAuth: vi.fn(),
}))

import LoginPage from '@/components/auth/LoginPage'

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({ error: null })
    mockSignUp.mockResolvedValue({ error: null })
  })

  it('renders email and password fields', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders sign in button by default', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('submit calls signIn with correct credentials', async () => {
    renderWithProviders(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('can toggle to signup mode', async () => {
    renderWithProviders(<LoginPage />)

    // Find and click the toggle link
    const toggleLink = screen.getByText(/sign up/i)
    fireEvent.click(toggleLink)

    // Should now show sign up button
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
  })

  it('calls signUp when in signup mode', async () => {
    renderWithProviders(<LoginPage />)

    // Toggle to signup
    fireEvent.click(screen.getByText(/sign up/i))

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'newpass123')
    })
  })

  it('displays error message on auth failure', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } })
    renderWithProviders(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })
})
