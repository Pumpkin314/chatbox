import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import { activeAppAtom, appStateAtom, handleOpenApp, handleCloseApp } from '../app-lifecycle'

describe('app-lifecycle', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  it('handleOpenApp("chess") sets activeAppAtom to "chess"', () => {
    const result = handleOpenApp(store, 'chess')
    expect(store.get(activeAppAtom)).toBe('chess')
    expect(result.success).toBe(true)
  })

  it('handleOpenApp with invalid app_id returns error', () => {
    const result = handleOpenApp(store, 'nonexistent')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(store.get(activeAppAtom)).toBeNull()
  })

  it('handleCloseApp resets atoms to null', () => {
    handleOpenApp(store, 'chess')
    expect(store.get(activeAppAtom)).toBe('chess')

    handleCloseApp(store)
    expect(store.get(activeAppAtom)).toBeNull()
    expect(store.get(appStateAtom)).toBeNull()
  })
})
