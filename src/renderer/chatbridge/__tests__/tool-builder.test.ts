import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import { buildToolSet } from '../tool-builder'
import { setStoreRef } from '../tool-router'

describe('buildToolSet', () => {
  beforeEach(() => {
    const store = createStore()
    setStoreRef(store)
  })

  it('includes only open_app when no app is active', () => {
    const tools = buildToolSet(null)
    const names = Object.keys(tools)
    expect(names).toEqual(['open_app'])
    expect(names).not.toContain('close_app')
    expect(names).not.toContain('start_game')
    expect(names).not.toContain('get_weather')
    expect(names).not.toContain('echo')
  })

  it('includes open_app + app tools + close_app when an app is active', () => {
    const tools = buildToolSet('chess')
    const names = Object.keys(tools)
    expect(names).toContain('open_app')
    expect(names).toContain('close_app')
    expect(names).toContain('start_game')
    expect(names).toContain('make_move')
    expect(names).toContain('get_board')
    // Should NOT contain tools from other apps
    expect(names).not.toContain('get_weather')
    expect(names).not.toContain('search_tracks')
    expect(names).not.toContain('echo')
  })

  it('each tool has an execute function', () => {
    const tools = buildToolSet('chess')
    for (const [, t] of Object.entries(tools)) {
      expect(typeof (t as any).execute).toBe('function')
    }
  })

  it('does not include close_app when no app is active', () => {
    const tools = buildToolSet(null)
    expect(Object.keys(tools)).not.toContain('close_app')
  })
})
