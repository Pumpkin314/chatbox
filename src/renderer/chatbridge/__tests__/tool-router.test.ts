import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStore } from 'jotai'
import { routeToolCall, setBridgeRef, setStoreRef, type AppBridge } from '../tool-router'
import { activeAppAtom } from '../app-lifecycle'

describe('routeToolCall', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    setStoreRef(store)
    // Reset bridge ref by setting a null-ish bridge (we'll override per test)
    setBridgeRef(null as unknown as AppBridge)
  })

  it('open_app routes to handleOpenApp and returns success', async () => {
    const result = await routeToolCall('open_app', { app_id: 'chess' })
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
    expect(parsed.appId).toBe('chess')
    expect(store.get(activeAppAtom)).toBe('chess')
  })

  it('open_app with invalid app returns error', async () => {
    const result = await routeToolCall('open_app', { app_id: 'nonexistent' })
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('not found')
  })

  it('close_app routes to handleCloseApp', async () => {
    // First open an app
    await routeToolCall('open_app', { app_id: 'chess' })
    expect(store.get(activeAppAtom)).toBe('chess')

    const result = await routeToolCall('close_app', {})
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
    expect(store.get(activeAppAtom)).toBeNull()
  })

  it('app-specific tool routes to bridge', async () => {
    const mockBridge: AppBridge = {
      sendToolCall: vi.fn().mockResolvedValue({ board: '...', turn: 'white' }),
    }
    setBridgeRef(mockBridge)

    const result = await routeToolCall('get_board', {})
    const parsed = JSON.parse(result)
    expect(parsed.board).toBe('...')
    expect(mockBridge.sendToolCall).toHaveBeenCalledWith('get_board', {})
  })

  it('app-specific tool without bridge returns error', async () => {
    // Bridge is null (set in beforeEach)
    const result = await routeToolCall('make_move', { from: 'e2', to: 'e4' })
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('Bridge not available')
  })

  it('bridge error is caught and returned as error result', async () => {
    const mockBridge: AppBridge = {
      sendToolCall: vi.fn().mockRejectedValue(new Error('iframe disconnected')),
    }
    setBridgeRef(mockBridge)

    const result = await routeToolCall('start_game', { color: 'white' })
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('iframe disconnected')
  })
})
