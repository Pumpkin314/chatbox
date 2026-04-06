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
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SidePanel from '../SidePanel'

// Mock the registry to return a known app for 'test-app'
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
    return null
  },
}))

function Wrapper({ children, store }: { children: ReactNode; store: ReturnType<typeof createStore> }) {
  return (
    <MantineProvider>
      <Provider store={store}>{children}</Provider>
    </MantineProvider>
  )
}

function renderWithStore(store: ReturnType<typeof createStore>, props: { displayMode?: 'panel' | 'inline' | 'expanded' } = {}) {
  return render(
    <Wrapper store={store}>
      <SidePanel {...props} />
    </Wrapper>,
  )
}

afterEach(() => {
  cleanup()
})

describe('SidePanel', () => {
  it('does not render when activeApp is null', () => {
    const store = createStore()
    store.set(activeAppAtom, null)
    renderWithStore(store)
    expect(screen.queryByTestId('chatbridge-side-panel')).toBeNull()
  })

  it('renders when activeApp is set', () => {
    const store = createStore()
    store.set(activeAppAtom, 'test-app')
    renderWithStore(store)
    expect(screen.getByTestId('chatbridge-side-panel')).toBeTruthy()
    expect(screen.getByText('Test App')).toBeTruthy()
  })

  it('renders iframe with correct src and sandbox attributes', () => {
    const store = createStore()
    store.set(activeAppAtom, 'test-app')
    renderWithStore(store)
    const iframe = screen.getByTestId('chatbridge-iframe') as HTMLIFrameElement
    expect(iframe.src).toContain('about:blank')
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms')
  })

  it('close button sets activeApp to null', () => {
    const store = createStore()
    store.set(activeAppAtom, 'test-app')
    renderWithStore(store)
    const closeBtn = screen.getByTestId('chatbridge-close-button')
    fireEvent.click(closeBtn)
    expect(store.get(activeAppAtom)).toBeNull()
  })

  it('shows loading status initially when app is set', () => {
    const store = createStore()
    store.set(activeAppAtom, 'test-app')
    renderWithStore(store)
    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.getByText('Loading Test App...')).toBeTruthy()
  })

  it('shows connected status after iframe loads', () => {
    const store = createStore()
    store.set(activeAppAtom, 'test-app')
    renderWithStore(store)
    const iframe = screen.getByTestId('chatbridge-iframe')
    fireEvent.load(iframe)
    expect(screen.getByText('Connected')).toBeTruthy()
  })

  it('does not render for non-panel display modes', () => {
    const store = createStore()
    store.set(activeAppAtom, 'test-app')
    renderWithStore(store, { displayMode: 'inline' })
    expect(screen.queryByTestId('chatbridge-side-panel')).toBeNull()
  })

  describe('loading and error states', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows spinner/loading indicator when panelState is loading (iframe is loading)', () => {
      const store = createStore()
      store.set(activeAppAtom, 'test-app')
      renderWithStore(store)
      // Should show loading overlay with loader and loading text
      expect(screen.getByText('Loading Test App...')).toBeTruthy()
      expect(screen.getByText('Loading...')).toBeTruthy()
    })

    it('shows error card with retry button when panelState is error (iframe timed out)', () => {
      const store = createStore()
      store.set(activeAppAtom, 'test-app')
      renderWithStore(store)
      // Advance past the 15-second timeout
      act(() => {
        vi.advanceTimersByTime(15_000)
      })
      // Should show error state
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.getByText('App took too long to load.')).toBeTruthy()
      expect(screen.getByText('Retry')).toBeTruthy()
    })

    it('shows error card with correct error message after timeout', () => {
      const store = createStore()
      store.set(activeAppAtom, 'test-app')
      renderWithStore(store)
      // Advance just under 15s — should still be loading
      act(() => {
        vi.advanceTimersByTime(14_999)
      })
      expect(screen.getByText('Loading...')).toBeTruthy()
      // Advance past 15s timeout
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByText('Error')).toBeTruthy()
      expect(screen.getByText('App took too long to load.')).toBeTruthy()
      expect(screen.getByText('Retry')).toBeTruthy()
    })

    it('clicking retry resets loading state and re-attempts iframe load', () => {
      const store = createStore()
      store.set(activeAppAtom, 'test-app')
      renderWithStore(store)
      // Trigger timeout to get to error state
      act(() => {
        vi.advanceTimersByTime(15_000)
      })
      expect(screen.getByText('Retry')).toBeTruthy()
      // Click retry
      fireEvent.click(screen.getByText('Retry'))
      // Should be back in loading state
      expect(screen.getByText('Loading...')).toBeTruthy()
      expect(screen.getByText('Loading Test App...')).toBeTruthy()
      // The iframe should have a refreshed src (with cache-bust query param)
      const iframe = screen.getByTestId('chatbridge-iframe') as HTMLIFrameElement
      expect(iframe.src).toContain('_retry=1')
    })
  })
})
