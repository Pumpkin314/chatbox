import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { activeAppAtom, appStateAtom } from '../app-lifecycle'
import { appContextHistoryAtom } from '../context-manager'
import type { AppContextEntry } from '../context-manager'
import { getChatBridgeSystemPrompt } from '../system-prompt'

function makeHistoryEntry(overrides: Partial<AppContextEntry> = {}): AppContextEntry {
  return {
    appId: 'chess',
    appName: 'Chess',
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

      // Use 'chess' which is in the static registry with tools
      store.set(activeAppAtom, 'chess')
      store.set(appStateAtom, { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR' })

      const result = getChatBridgeSystemPrompt(store)

      expect(result).toContain('## Active App: Chess')
      expect(result).toContain('Play chess')
      expect(result).toContain('Current state:')
      expect(result).toContain('fen')
      expect(result).toContain('Available tools: start_game')
      expect(result).toContain('# ChatBridge Context')
    })

    it('omits state line when app state is empty', () => {
      const store = createStore()

      store.set(activeAppAtom, 'chess')
      store.set(appStateAtom, {})

      const result = getChatBridgeSystemPrompt(store)

      expect(result).toContain('## Active App: Chess')
      expect(result).not.toContain('Current state:')
    })

    it('includes recent history entries', () => {
      const store = createStore()
      store.set(appContextHistoryAtom, [
        makeHistoryEntry({ appName: 'Chess', state: { moves: 10 } }),
        makeHistoryEntry({ appName: 'Weather', appId: 'weather', state: { city: 'NYC' } }),
      ])

      const result = getChatBridgeSystemPrompt(store)

      expect(result).toContain('## Recent App Interactions')
      expect(result).toContain('Chess (app_complete)')
      expect(result).toContain('Weather (app_complete)')
      expect(result).toContain('"moves":10')
      expect(result).toContain('"city":"NYC"')
    })

    it('only shows last 5 history entries', () => {
      const store = createStore()
      const entries = Array.from({ length: 8 }, (_, i) =>
        makeHistoryEntry({ appName: `App ${i}`, state: { index: i } })
      )
      store.set(appContextHistoryAtom, entries)

      const result = getChatBridgeSystemPrompt(store)

      expect(result).not.toContain('App 0')
      expect(result).not.toContain('App 1')
      expect(result).not.toContain('App 2')
      expect(result).toContain('App 3')
      expect(result).toContain('App 7')
    })

    it('truncates large state to 500 characters', () => {
      const store = createStore()
      const largeState: Record<string, unknown> = {}
      for (let i = 0; i < 50; i++) {
        largeState[`key_${i}`] = `value_that_is_somewhat_long_${i}`
      }

      store.set(appContextHistoryAtom, [
        makeHistoryEntry({ appName: 'Big App', state: largeState }),
      ])

      const result = getChatBridgeSystemPrompt(store)

      expect(result).toContain('Big App (app_complete):')
      expect(result).toContain('...')
      const stateStr = JSON.stringify(largeState)
      expect(stateStr.length).toBeGreaterThan(500)
      expect(result).not.toContain(stateStr)
    })
  })
})
