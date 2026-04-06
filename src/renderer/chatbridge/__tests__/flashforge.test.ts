import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import { routeToolCall, setStoreRef, _resetDeckStore } from '../tool-router'
import { getChatBridgeTools } from '../tools'
import { buildToolSet } from '../tool-builder'
import { getAppById } from '../registry'
import { handleOpenApp } from '../app-lifecycle'

describe('FlashForge', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    setStoreRef(store)
    _resetDeckStore()
    // Activate flashforge so tool routing works (tool gating)
    handleOpenApp(store, 'flashforge')
  })

  describe('registry', () => {
    it('is registered in apps.json with correct fields', () => {
      const app = getAppById('flashforge')
      expect(app).not.toBeNull()
      expect(app!.name).toBe('FlashForge')
      expect(app!.type).toBe('internal')
      expect(app!.entrypoint).toBe('')
      expect(app!.authConfig).toBeNull()
      expect(app!.enabled).toBe(true)
    })

    it('has exactly 4 tools', () => {
      const app = getAppById('flashforge')
      expect(app!.tools).toHaveLength(4)
      const names = app!.tools.map((t) => t.name)
      expect(names).toContain('create_deck')
      expect(names).toContain('study_card')
      expect(names).toContain('check_answer')
      expect(names).toContain('get_deck_stats')
    })

    it('tools appear in getChatBridgeTools', () => {
      const tools = getChatBridgeTools('flashforge')
      const names = tools.map((t) => t.name)
      expect(names).toContain('create_deck')
      expect(names).toContain('study_card')
      expect(names).toContain('check_answer')
      expect(names).toContain('get_deck_stats')
    })

    it('tools appear in buildToolSet when flashforge is active', () => {
      const tools = buildToolSet('flashforge')
      const names = Object.keys(tools)
      expect(names).toContain('create_deck')
      expect(names).toContain('study_card')
      expect(names).toContain('check_answer')
      expect(names).toContain('get_deck_stats')
    })
  })

  describe('create_deck', () => {
    it('returns valid deck structure', async () => {
      const result = await routeToolCall('create_deck', { topic: 'math', card_count: 5 })
      const parsed = JSON.parse(result)
      expect(parsed.deck_id).toBeDefined()
      expect(parsed.topic).toBe('math')
      expect(parsed.cards).toHaveLength(5)
      for (const card of parsed.cards) {
        expect(card.front).toBeDefined()
        expect(card.back).toBeDefined()
      }
    })

    it('clamps card_count to 3-20 range', async () => {
      const result1 = await routeToolCall('create_deck', { topic: 'math', card_count: 1 })
      expect(JSON.parse(result1).cards).toHaveLength(3)

      const result2 = await routeToolCall('create_deck', { topic: 'math', card_count: 50 })
      expect(JSON.parse(result2).cards).toHaveLength(20)
    })

    it('generates cards for unknown topics', async () => {
      const result = await routeToolCall('create_deck', { topic: 'quantum entanglement', card_count: 3 })
      const parsed = JSON.parse(result)
      expect(parsed.cards).toHaveLength(3)
      expect(parsed.topic).toBe('quantum entanglement')
    })
  })

  describe('study_card', () => {
    it('returns the next unstudied card', async () => {
      const createResult = await routeToolCall('create_deck', { topic: 'math', card_count: 3 })
      const { deck_id } = JSON.parse(createResult)

      const result = await routeToolCall('study_card', { deck_id })
      const parsed = JSON.parse(result)
      expect(parsed.front).toBeDefined()
      expect(parsed.back).toBeDefined()
      expect(parsed.card_number).toBe(1)
      expect(parsed.total_cards).toBe(3)
    })

    it('iterates through cards sequentially', async () => {
      const createResult = await routeToolCall('create_deck', { topic: 'math', card_count: 3 })
      const { deck_id } = JSON.parse(createResult)

      const card1 = JSON.parse(await routeToolCall('study_card', { deck_id }))
      expect(card1.card_number).toBe(1)

      // Answer card 1 to advance
      await routeToolCall('check_answer', { deck_id, card_number: 1, answer: 'anything' })

      const card2 = JSON.parse(await routeToolCall('study_card', { deck_id }))
      expect(card2.card_number).toBe(2)
    })

    it('returns done message when all cards studied', async () => {
      const createResult = await routeToolCall('create_deck', { topic: 'math', card_count: 3 })
      const { deck_id } = JSON.parse(createResult)

      // Study all 3 cards
      for (let i = 1; i <= 3; i++) {
        await routeToolCall('study_card', { deck_id })
        await routeToolCall('check_answer', { deck_id, card_number: i, answer: 'x' })
      }

      const result = JSON.parse(await routeToolCall('study_card', { deck_id }))
      expect(result.done).toBe(true)
    })

    it('returns error for invalid deck_id', async () => {
      const result = JSON.parse(await routeToolCall('study_card', { deck_id: 'nonexistent' }))
      expect(result.error).toBeDefined()
    })
  })

  describe('check_answer', () => {
    it('returns correct for matching answer (case-insensitive)', async () => {
      const createResult = await routeToolCall('create_deck', { topic: 'math', card_count: 3 })
      const { deck_id, cards } = JSON.parse(createResult)

      await routeToolCall('study_card', { deck_id })
      const result = JSON.parse(
        await routeToolCall('check_answer', {
          deck_id,
          card_number: 1,
          answer: cards[0].back,
        }),
      )
      expect(result.correct).toBe(true)
      expect(result.correct_answer).toBe(cards[0].back)
    })

    it('returns correct for case-insensitive trimmed answer', async () => {
      const createResult = await routeToolCall('create_deck', { topic: 'math', card_count: 3 })
      const { deck_id, cards } = JSON.parse(createResult)

      await routeToolCall('study_card', { deck_id })
      const result = JSON.parse(
        await routeToolCall('check_answer', {
          deck_id,
          card_number: 1,
          answer: `  ${cards[0].back.toUpperCase()}  `,
        }),
      )
      expect(result.correct).toBe(true)
    })

    it('returns incorrect with explanation for wrong answer', async () => {
      const createResult = await routeToolCall('create_deck', { topic: 'math', card_count: 3 })
      const { deck_id } = JSON.parse(createResult)

      await routeToolCall('study_card', { deck_id })
      const result = JSON.parse(
        await routeToolCall('check_answer', {
          deck_id,
          card_number: 1,
          answer: 'definitely_wrong_answer_xyz',
        }),
      )
      expect(result.correct).toBe(false)
      expect(result.explanation).toBeDefined()
      expect(result.correct_answer).toBeDefined()
    })

    it('returns error for invalid deck_id', async () => {
      const result = JSON.parse(
        await routeToolCall('check_answer', {
          deck_id: 'nonexistent',
          card_number: 1,
          answer: 'x',
        }),
      )
      expect(result.error).toBeDefined()
    })
  })

  describe('get_deck_stats', () => {
    it('returns correct stats after studying', async () => {
      const createResult = await routeToolCall('create_deck', { topic: 'math', card_count: 3 })
      const { deck_id, cards } = JSON.parse(createResult)

      // Study card 1 correctly
      await routeToolCall('study_card', { deck_id })
      await routeToolCall('check_answer', { deck_id, card_number: 1, answer: cards[0].back })

      // Study card 2 incorrectly
      await routeToolCall('study_card', { deck_id })
      await routeToolCall('check_answer', { deck_id, card_number: 2, answer: 'wrong' })

      const stats = JSON.parse(await routeToolCall('get_deck_stats', { deck_id }))
      expect(stats.total).toBe(3)
      expect(stats.studied).toBe(2)
      expect(stats.correct).toBe(1)
      expect(stats.incorrect).toBe(1)
      expect(stats.score_percent).toBe(50)
    })

    it('returns 0% for no cards studied', async () => {
      const createResult = await routeToolCall('create_deck', { topic: 'math', card_count: 3 })
      const { deck_id } = JSON.parse(createResult)

      const stats = JSON.parse(await routeToolCall('get_deck_stats', { deck_id }))
      expect(stats.total).toBe(3)
      expect(stats.studied).toBe(0)
      expect(stats.correct).toBe(0)
      expect(stats.incorrect).toBe(0)
      expect(stats.score_percent).toBe(0)
    })

    it('returns error for invalid deck_id', async () => {
      const result = JSON.parse(await routeToolCall('get_deck_stats', { deck_id: 'nonexistent' }))
      expect(result.error).toBeDefined()
    })
  })
})
