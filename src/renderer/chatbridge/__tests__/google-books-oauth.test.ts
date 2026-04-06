import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { createStore } from 'jotai'
import { routeToolCall, setBridgeRef, setStoreRef, type AppBridge } from '../tool-router'
import { activeAppAtom } from '../app-lifecycle'

// Mock getOrRefreshToken
vi.mock('../oauth', () => ({
  getOrRefreshToken: vi.fn(),
}))

// Import mock after vi.mock so we can control it per-test
import { getOrRefreshToken } from '../oauth'

const mockGetOrRefreshToken = getOrRefreshToken as Mock

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Google Books OAuth tool-router', () => {
  let store: ReturnType<typeof createStore>
  let mockBridge: AppBridge

  beforeEach(() => {
    vi.clearAllMocks()
    store = createStore()
    setStoreRef(store)
    mockBridge = {
      sendToolCall: vi.fn().mockResolvedValue(undefined),
    }
    setBridgeRef(mockBridge)

    // Open google-books app
    store.set(activeAppAtom, 'google-books')
  })

  // ── Shelf enum to ID mapping ──────────────────────────────────────────

  it('maps shelf enums to correct Google shelf IDs: to_read→2, reading_now→3, have_read→4', async () => {
    mockGetOrRefreshToken.mockResolvedValue('valid-token')
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    })

    // to_read → shelf 2
    await routeToolCall('get_reading_list', { shelf: 'to_read' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/books/v1/mylibrary/bookshelves/2/volumes',
      expect.objectContaining({ headers: { Authorization: 'Bearer valid-token' } }),
    )

    mockFetch.mockClear()

    // reading_now → shelf 3
    await routeToolCall('get_reading_list', { shelf: 'reading_now' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/books/v1/mylibrary/bookshelves/3/volumes',
      expect.objectContaining({ headers: { Authorization: 'Bearer valid-token' } }),
    )

    mockFetch.mockClear()

    // have_read → shelf 4
    await routeToolCall('get_reading_list', { shelf: 'have_read' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/books/v1/mylibrary/bookshelves/4/volumes',
      expect.objectContaining({ headers: { Authorization: 'Bearer valid-token' } }),
    )
  })

  // ── No token → auth_required ──────────────────────────────────────────

  it('returns auth_required when getOrRefreshToken returns null', async () => {
    mockGetOrRefreshToken.mockResolvedValue(null)

    const result = JSON.parse(await routeToolCall('get_reading_list', { shelf: 'to_read' }))
    expect(result.error).toBe('auth_required')
    expect(result.message).toContain('sign in')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Valid token → Bearer header ───────────────────────────────────────

  it('calls Google API with Bearer header when token is valid', async () => {
    mockGetOrRefreshToken.mockResolvedValue('my-access-token')
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    })

    await routeToolCall('get_reading_list', { shelf: 'to_read' })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('googleapis.com'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer my-access-token' },
      }),
    )
  })

  // ── get_reading_list with specific shelf ──────────────────────────────

  it('get_reading_list with shelf="to_read" returns correct structure', async () => {
    mockGetOrRefreshToken.mockResolvedValue('tok')
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'vol1',
            volumeInfo: {
              title: 'Test Book',
              authors: ['Author A'],
              imageLinks: { thumbnail: 'http://img.jpg' },
              pageCount: 200,
              description: 'A great book',
            },
          },
        ],
      }),
    })

    const result = JSON.parse(await routeToolCall('get_reading_list', { shelf: 'to_read' }))
    expect(result.shelves).toHaveLength(1)
    expect(result.shelves[0].name).toBe('To Read')
    expect(result.shelves[0].id).toBe(2)
    expect(result.shelves[0].books).toHaveLength(1)
    expect(result.shelves[0].books[0]).toMatchObject({
      id: 'vol1',
      title: 'Test Book',
      authors: ['Author A'],
    })
  })

  // ── get_reading_list with shelf="all" ─────────────────────────────────

  it('get_reading_list with shelf="all" makes 3 parallel requests and merges', async () => {
    mockGetOrRefreshToken.mockResolvedValue('tok')

    const makeResponse = (title: string) => ({
      ok: true,
      json: async () => ({
        items: [
          {
            id: `vol_${title}`,
            volumeInfo: {
              title,
              authors: ['Auth'],
              imageLinks: { thumbnail: 'http://img.jpg' },
              pageCount: 100,
              description: 'desc',
            },
          },
        ],
      }),
    })

    // Three calls: shelf 2, 3, 4
    mockFetch
      .mockResolvedValueOnce(makeResponse('Book A'))
      .mockResolvedValueOnce(makeResponse('Book B'))
      .mockResolvedValueOnce(makeResponse('Book C'))

    const result = JSON.parse(await routeToolCall('get_reading_list', { shelf: 'all' }))
    expect(result.shelves).toHaveLength(3)
    expect(mockFetch).toHaveBeenCalledTimes(3)

    // Verify all three shelf URLs were called
    const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0])
    expect(urls).toContain('https://www.googleapis.com/books/v1/mylibrary/bookshelves/2/volumes')
    expect(urls).toContain('https://www.googleapis.com/books/v1/mylibrary/bookshelves/3/volumes')
    expect(urls).toContain('https://www.googleapis.com/books/v1/mylibrary/bookshelves/4/volumes')

    // Verify merged shape
    const names = result.shelves.map((s: { name: string }) => s.name)
    expect(names).toContain('To Read')
    expect(names).toContain('Reading Now')
    expect(names).toContain('Have Read')
  })

  // ── add_to_shelf ──────────────────────────────────────────────────────

  it('add_to_shelf handles 204 response and synthesizes result', async () => {
    mockGetOrRefreshToken.mockResolvedValue('tok')
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const result = JSON.parse(
      await routeToolCall('add_to_shelf', { volume_id: 'abc123', shelf: 'reading_now' }),
    )
    expect(result).toEqual({
      success: true,
      shelfName: 'Reading Now',
      bookTitle: 'abc123',
    })

    // Verify POST to correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/books/v1/mylibrary/bookshelves/3/addVolume?volumeId=abc123',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer tok' },
      }),
    )
  })

  // ── remove_from_shelf ─────────────────────────────────────────────────

  it('remove_from_shelf handles 204 response and returns {success: true}', async () => {
    mockGetOrRefreshToken.mockResolvedValue('tok')
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const result = JSON.parse(
      await routeToolCall('remove_from_shelf', { volume_id: 'abc123', shelf: 'have_read' }),
    )
    expect(result).toEqual({ success: true })

    // Verify POST to correct URL with shelf 4
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/books/v1/mylibrary/bookshelves/4/removeVolume?volumeId=abc123',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer tok' },
      }),
    )
  })

  // ── __proxyResult forwarded to iframe ─────────────────────────────────

  it('forwards __proxyResult to iframe for all OAuth tools', async () => {
    mockGetOrRefreshToken.mockResolvedValue('tok')
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    })

    await routeToolCall('get_reading_list', { shelf: 'to_read' })
    expect(mockBridge.sendToolCall).toHaveBeenCalledWith(
      'get_reading_list',
      expect.objectContaining({ __proxyResult: expect.any(Object) }),
    )
  })

  // ── Regression: search_books and get_book_details still work ──────────

  it('search_books still works unchanged (api_key path)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'v1',
            volumeInfo: {
              title: 'Dinosaurs',
              authors: ['Dr. A'],
              imageLinks: { thumbnail: 'http://t.jpg' },
              pageCount: 320,
              description: 'About dinos',
            },
          },
        ],
      }),
    })

    const result = JSON.parse(await routeToolCall('search_books', { query: 'dinosaurs' }))
    // Should fall through to the API key code path, NOT require OAuth
    expect(result.books).toBeDefined()
    // getOrRefreshToken should NOT have been called for search_books
    expect(mockGetOrRefreshToken).not.toHaveBeenCalled()
  })

  it('get_book_details still works unchanged (api_key path)', async () => {
    // Without a real API key, this falls through to mock data — that's fine,
    // the point is it does NOT require OAuth / getOrRefreshToken
    const result = JSON.parse(await routeToolCall('get_book_details', { volume_id: 'xyz' }))
    // Should return the built-in mock shape (no API key in test env)
    expect(result.title).toBeDefined()
    expect(result.authors).toBeDefined()
    expect(mockGetOrRefreshToken).not.toHaveBeenCalled()
  })
})
