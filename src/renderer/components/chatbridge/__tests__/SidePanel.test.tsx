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

import { activeAppAtom, appStateAtom } from '@/chatbridge/app-lifecycle'
import type { ChatBridgeApp } from '@/chatbridge/registry'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import SidePanel from '../SidePanel'

const mockApp: ChatBridgeApp = {
  id: 'test-app',
  name: 'Test App',
  description: 'A test ChatBridge app',
  entrypoint: 'about:blank',
}

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
    store.set(activeAppAtom, mockApp)
    renderWithStore(store)
    expect(screen.getByTestId('chatbridge-side-panel')).toBeTruthy()
    expect(screen.getByText('Test App')).toBeTruthy()
  })

  it('renders iframe with correct src and sandbox attributes', () => {
    const store = createStore()
    store.set(activeAppAtom, mockApp)
    renderWithStore(store)
    const iframe = screen.getByTestId('chatbridge-iframe') as HTMLIFrameElement
    expect(iframe.src).toContain('about:blank')
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms')
  })

  it('close button sets activeApp to null', () => {
    const store = createStore()
    store.set(activeAppAtom, mockApp)
    renderWithStore(store)
    const closeBtn = screen.getByTestId('chatbridge-close-button')
    fireEvent.click(closeBtn)
    expect(store.get(activeAppAtom)).toBeNull()
    expect(store.get(appStateAtom)).toBe('idle')
  })

  it('shows loading status when appState is loading', () => {
    const store = createStore()
    store.set(activeAppAtom, mockApp)
    store.set(appStateAtom, 'loading')
    renderWithStore(store)
    expect(screen.getByText('Loading...')).toBeTruthy()
  })

  it('shows connected status when appState is connected', () => {
    const store = createStore()
    store.set(activeAppAtom, mockApp)
    store.set(appStateAtom, 'connected')
    renderWithStore(store)
    expect(screen.getByText('Connected')).toBeTruthy()
  })

  it('does not render for non-panel display modes', () => {
    const store = createStore()
    store.set(activeAppAtom, mockApp)
    renderWithStore(store, { displayMode: 'inline' })
    expect(screen.queryByTestId('chatbridge-side-panel')).toBeNull()
  })
})
