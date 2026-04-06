import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStore } from 'jotai'
import { routeToolCall, setBridgeRef, setStoreRef, type AppBridge } from '../../../tool-router'
import { activeAppAtom } from '../../../app-lifecycle'

describe('Google Books proxy handlers', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    setStoreRef(store)
    // Set google-books as active app so tool gating allows Google Books tools
    store.set(activeAppAtom, 'google-books')
    setBridgeRef({
      sendToolCall: vi.fn().mockResolvedValue({}),
    } as unknown as AppBridge)
  })

  describe('search_books', () => {
    it('returns mock books data when no API key', async () => {
      const result = await routeToolCall('search_books', { query: 'dinosaurs' })
      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('books')
      expect(Array.isArray(parsed.books)).toBe(true)
      expect(parsed.books.length).toBe(3)
    })

    it('mock books have correct shape', async () => {
      const result = await routeToolCall('search_books', { query: 'dinosaurs' })
      const parsed = JSON.parse(result)
      const book = parsed.books[0]
      expect(book).toHaveProperty('id')
      expect(book).toHaveProperty('title')
      expect(book).toHaveProperty('authors')
      expect(book).toHaveProperty('thumbnail')
      expect(book).toHaveProperty('pageCount')
      expect(book).toHaveProperty('description')
      expect(Array.isArray(book.authors)).toBe(true)
    })

    it('forwards __proxyResult to bridge', async () => {
      const mockBridge: AppBridge = {
        sendToolCall: vi.fn().mockResolvedValue({}),
      }
      setBridgeRef(mockBridge)

      await routeToolCall('search_books', { query: 'dinosaurs' })
      expect(mockBridge.sendToolCall).toHaveBeenCalledWith(
        'search_books',
        expect.objectContaining({ __proxyResult: expect.any(Object) }),
      )
    })
  })

  describe('get_book_details', () => {
    it('returns mock book details when no API key', async () => {
      const result = await routeToolCall('get_book_details', { volume_id: 'abc123' })
      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('title')
      expect(parsed).toHaveProperty('authors')
      expect(parsed).toHaveProperty('description')
      expect(parsed).toHaveProperty('pageCount')
      expect(parsed).toHaveProperty('categories')
      expect(parsed).toHaveProperty('previewLink')
      expect(parsed).toHaveProperty('thumbnail')
    })
  })

  describe('OAuth tools return auth_required', () => {
    it('get_reading_list returns auth_required error', async () => {
      const result = await routeToolCall('get_reading_list', {})
      const parsed = JSON.parse(result)
      expect(parsed.error).toBe('auth_required')
      expect(parsed.message).toBeDefined()
    })

    it('add_to_shelf returns auth_required error', async () => {
      const result = await routeToolCall('add_to_shelf', { volume_id: 'abc123' })
      const parsed = JSON.parse(result)
      expect(parsed.error).toBe('auth_required')
      expect(parsed.message).toBeDefined()
    })

    it('remove_from_shelf returns auth_required error', async () => {
      const result = await routeToolCall('remove_from_shelf', { volume_id: 'abc123' })
      const parsed = JSON.parse(result)
      expect(parsed.error).toBe('auth_required')
      expect(parsed.message).toBeDefined()
    })
  })
})
