import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { activeAppAtom, appStateAtom } from '../app-lifecycle'
import { appContextHistoryAtom } from '../context-manager'
import type { AppContextEntry } from '../context-manager'
import { registerApp } from '../registry'
import type { AppRegistration } from '../registry'
import { getChatBridgeSystemPrompt } from '../system-prompt'

function makeApp(overrides: Partial<AppRegistration> = {}): AppRegistration {
  return {
    id: 'test-app',
    name: 'Test App',
    description: 'A test application',
    type: 'iframe',
    tools: [{ name: 'submit_answer', description: 'Submit an answer', parameters: {} }],
    entrypoint: '/apps/test',
    authConfig: { type: 'none' },
    enabled: true,
    ...overrides,
  }
}

function makeHistoryEntry(overrides: Partial<AppContextEntry> = {}): AppContextEntry {
  return {
    appId: 'test-app',
    appName: 'Test App',
    state: { result: 'done' },
    timestamp: Date.now(),
    type: 'app_complete',
    ...overrides,
  }
}

describe('system-prompt', () => {
  describe('getChatBridgeSystemPrompt', () => {
    it('returns empty string when no active app and no history', () => {
      const store = createStore()
      const result = getChatBridgeSystemPrompt(store)
      expect(result).toBe('')
    })

    it('includes app name, description, and state for active app', () => {
      const store = createStore()
      const app = makeApp({
        id: 'math-quiz',
        name: 'Math Quiz',
        description: 'Practice math problems',
        tools: [
          { name: 'check_answer', description: 'Check answer', parameters: {} },
          { name: 'next_question', description: 'Next question', parameters: {} },
        ],
      })
      registerApp(app)

      store.set(activeAppAtom, 'math-quiz')
      store.set(appStateAtom, { question: 3, score: 2 })

      const result = getChatBridgeSystemPrompt(store)

      expect(result).toContain('## Active App: Math Quiz')
      expect(result).toContain('Practice math problems')
      expect(result).toContain('Current state:')
      expect(result).toContain('"question":3')
      expect(result).toContain('Available tools: check_answer, next_question')
      expect(result).toContain('# ChatBridge Context')
    })

    it('omits state line when app state is empty', () => {
      const store = createStore()
      registerApp(makeApp({ id: 'empty-state-app', name: 'Empty State App' }))

      store.set(activeAppAtom, 'empty-state-app')
      store.set(appStateAtom, {})

      const result = getChatBridgeSystemPrompt(store)

      expect(result).toContain('## Active App: Empty State App')
      expect(result).not.toContain('Current state:')
    })

    it('includes recent history entries', () => {
      const store = createStore()
      store.set(appContextHistoryAtom, [
        makeHistoryEntry({ appName: 'Flashcards', state: { cards_reviewed: 10 } }),
        makeHistoryEntry({ appName: 'Quiz', state: { score: 85 } }),
      ])

      const result = getChatBridgeSystemPrompt(store)

      expect(result).toContain('## Recent App Interactions')
      expect(result).toContain('Flashcards (app_complete)')
      expect(result).toContain('Quiz (app_complete)')
      expect(result).toContain('"cards_reviewed":10')
      expect(result).toContain('"score":85')
    })

    it('only shows last 5 history entries', () => {
      const store = createStore()
      const entries = Array.from({ length: 8 }, (_, i) =>
        makeHistoryEntry({ appName: `App ${i}`, state: { index: i } })
      )
      store.set(appContextHistoryAtom, entries)

      const result = getChatBridgeSystemPrompt(store)

      // Should not contain entries 0, 1, 2
      expect(result).not.toContain('App 0')
      expect(result).not.toContain('App 1')
      expect(result).not.toContain('App 2')
      // Should contain entries 3-7
      expect(result).toContain('App 3')
      expect(result).toContain('App 7')
    })

    it('truncates large state to 500 characters', () => {
      const store = createStore()
      const largeState: Record<string, unknown> = {}
      // Create a state that serializes to > 500 chars
      for (let i = 0; i < 50; i++) {
        largeState[`key_${i}`] = `value_that_is_somewhat_long_${i}`
      }

      store.set(appContextHistoryAtom, [
        makeHistoryEntry({ appName: 'Big App', state: largeState }),
      ])

      const result = getChatBridgeSystemPrompt(store)

      expect(result).toContain('Big App (app_complete):')
      expect(result).toContain('...')
      // The truncated state + "..." should appear, full serialization should not
      const stateStr = JSON.stringify(largeState)
      expect(stateStr.length).toBeGreaterThan(500)
      expect(result).not.toContain(stateStr)
    })
  })
})
