import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { activeAppAtom, appStateAtom } from '../app-lifecycle'
import {
  appContextHistoryAtom,
  getLastAppState,
  recordAppComplete,
  recordStateUpdate,
} from '../context-manager'
import { registerApp } from '../registry'
import type { AppRegistration } from '../registry'

function makeApp(overrides: Partial<AppRegistration> = {}): AppRegistration {
  return {
    id: 'test-app',
    name: 'Test App',
    description: 'A test application',
    type: 'iframe',
    tools: [],
    entrypoint: '/apps/test',
    authConfig: { type: 'none' },
    enabled: true,
    ...overrides,
  }
}

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
      const app = makeApp({ id: 'quiz-app', name: 'Quiz App' })
      registerApp(app)

      store.set(activeAppAtom, 'quiz-app')
      store.set(appStateAtom, { answers: [1, 2, 3] })

      const entry = recordAppComplete(store)

      expect(entry).not.toBeNull()
      expect(entry!.appId).toBe('quiz-app')
      expect(entry!.appName).toBe('Quiz App')
      expect(entry!.state).toEqual({ answers: [1, 2, 3] })
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
      store.set(activeAppAtom, 'some-app')
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
      const app = makeApp({ id: 'flashcards', name: 'Flashcards' })
      registerApp(app)

      // Simulate two completions
      store.set(activeAppAtom, 'flashcards')
      store.set(appStateAtom, { card: 1, correct: 0 })
      recordAppComplete(store)

      store.set(activeAppAtom, 'flashcards')
      store.set(appStateAtom, { card: 5, correct: 3 })
      recordAppComplete(store)

      const state = getLastAppState(store, 'flashcards')
      expect(state).toEqual({ card: 5, correct: 3 })
    })

    it('returns null for unknown app', () => {
      const store = createStore()
      const state = getLastAppState(store, 'nonexistent-app')
      expect(state).toBeNull()
    })

    it('tracks multiple apps independently', () => {
      const store = createStore()
      registerApp(makeApp({ id: 'app-a', name: 'App A' }))
      registerApp(makeApp({ id: 'app-b', name: 'App B' }))

      // Complete app-a
      store.set(activeAppAtom, 'app-a')
      store.set(appStateAtom, { value: 'alpha' })
      recordAppComplete(store)

      // Complete app-b
      store.set(activeAppAtom, 'app-b')
      store.set(appStateAtom, { value: 'beta' })
      recordAppComplete(store)

      // Complete app-a again with different state
      store.set(activeAppAtom, 'app-a')
      store.set(appStateAtom, { value: 'alpha-updated' })
      recordAppComplete(store)

      expect(getLastAppState(store, 'app-a')).toEqual({ value: 'alpha-updated' })
      expect(getLastAppState(store, 'app-b')).toEqual({ value: 'beta' })
    })
  })
})
