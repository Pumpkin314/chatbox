import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStore } from 'jotai'
import { buildToolSet } from '../tool-builder'
import { setStoreRef } from '../tool-router'

describe('buildToolSet', () => {
  beforeEach(() => {
    const store = createStore()
    setStoreRef(store)
  })

  it('returns only open_app when no app is active', () => {
    const tools = buildToolSet(null)
    const names = Object.keys(tools)
    expect(names).toEqual(['open_app'])
  })

  it('returns open_app + close_app + chess tools when chess is active', () => {
    const tools = buildToolSet('chess')
    const names = Object.keys(tools)
    expect(names).toContain('open_app')
    expect(names).toContain('close_app')
    expect(names).toContain('start_game')
    expect(names).toContain('make_move')
    expect(names).toContain('get_board')
    expect(names).toContain('get_hint')
    expect(names).toContain('resign')
  })

  it('each tool has an execute function', () => {
    const tools = buildToolSet('chess')
    for (const [name, t] of Object.entries(tools)) {
      // Vercel AI SDK tool objects expose execute
      expect(typeof (t as any).execute).toBe('function')
    }
  })

  it('does not include close_app when no app is active', () => {
    const tools = buildToolSet(null)
    expect(Object.keys(tools)).not.toContain('close_app')
  })

  it('includes weather tools when weather is active', () => {
    const tools = buildToolSet('weather')
    const names = Object.keys(tools)
    expect(names).toContain('open_app')
    expect(names).toContain('close_app')
    expect(names).toContain('get_weather')
    expect(names).toContain('get_forecast')
  })
})
