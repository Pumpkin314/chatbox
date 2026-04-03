import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { activeAppAtom, appStateAtom } from '../app-lifecycle'
import {
  appContextHistoryAtom,
  getLastAppState,
  recordAppComplete,
  recordStateUpdate,
} from '../context-manager'

describe('context-manager', () => {
  describe('recordStateUpdate', () => {
    it('stores state in appStateAtom', () => {
      const store = createStore()
      const state = { score: 100, level: 3 }

      recordStateUpdate(store, state)

      expect(store.get(appStateAtom)).toEqual({ score: 100, level: 3 })
    })
  })

  describe('recordAppComplete', () => {
    it('creates an entry in context history', () => {
      const store = createStore()

      // Use 'chess' which exists in the static registry
      store.set(activeAppAtom, 'chess')
      store.set(appStateAtom, { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR' })

      const entry = recordAppComplete(store)

      expect(entry).not.toBeNull()
      expect(entry!.appId).toBe('chess')
      expect(entry!.appName).toBe('Chess')
      expect(entry!.state).toEqual({ fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR' })
      expect(entry!.type).toBe('app_complete')
      expect(typeof entry!.timestamp).toBe('number')

      const history = store.get(appContextHistoryAtom)
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual(entry)
    })

    it('returns null when no active app', () => {
      const store = createStore()
      const entry = recordAppComplete(store)
      expect(entry).toBeNull()
    })

    it('returns null when no app state', () => {
      const store = createStore()
      store.set(activeAppAtom, 'chess')
      const entry = recordAppComplete(store)
      expect(entry).toBeNull()
    })

    it('uses appId as name when app not in registry', () => {
      const store = createStore()
      store.set(activeAppAtom, 'unregistered-app')
      store.set(appStateAtom, { data: true })

      const entry = recordAppComplete(store)

      expect(entry).not.toBeNull()
      expect(entry!.appName).toBe('unregistered-app')
    })
  })

  describe('getLastAppState', () => {
    it('returns the most recent state for an app', () => {
      const store = createStore()

      // Simulate two completions for chess
      store.set(activeAppAtom, 'chess')
      store.set(appStateAtom, { move: 1 })
      recordAppComplete(store)

      store.set(activeAppAtom, 'chess')
      store.set(appStateAtom, { move: 5, advantage: 'white' })
      recordAppComplete(store)

      const state = getLastAppState(store, 'chess')
      expect(state).toEqual({ move: 5, advantage: 'white' })
    })

    it('returns null for unknown app', () => {
      const store = createStore()
      const state = getLastAppState(store, 'nonexistent-app')
      expect(state).toBeNull()
    })

    it('tracks multiple apps independently', () => {
      const store = createStore()

      // Complete chess
      store.set(activeAppAtom, 'chess')
      store.set(appStateAtom, { value: 'alpha' })
      recordAppComplete(store)

      // Complete weather
      store.set(activeAppAtom, 'weather')
      store.set(appStateAtom, { value: 'beta' })
      recordAppComplete(store)

      // Complete chess again
      store.set(activeAppAtom, 'chess')
      store.set(appStateAtom, { value: 'alpha-updated' })
      recordAppComplete(store)

      expect(getLastAppState(store, 'chess')).toEqual({ value: 'alpha-updated' })
      expect(getLastAppState(store, 'weather')).toEqual({ value: 'beta' })
    })
  })
})
