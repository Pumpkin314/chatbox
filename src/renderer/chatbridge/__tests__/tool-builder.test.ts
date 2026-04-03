import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import { buildToolSet } from '../tool-builder'
import { setStoreRef } from '../tool-router'

describe('buildToolSet', () => {
  beforeEach(() => {
    const store = createStore()
    setStoreRef(store)
  })

  it('includes open_app and all app tools when no app is active', () => {
    const tools = buildToolSet(null)
    const names = Object.keys(tools)
    expect(names).toContain('open_app')
    expect(names).toContain('start_game') // chess
    expect(names).toContain('get_weather') // weather
    expect(names).not.toContain('close_app') // no active app
  })

  it('includes close_app when an app is active', () => {
    const tools = buildToolSet('chess')
    const names = Object.keys(tools)
    expect(names).toContain('open_app')
    expect(names).toContain('close_app')
    expect(names).toContain('start_game')
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

  it('all enabled app tools present regardless of active app', () => {
    const toolsNull = Object.keys(buildToolSet(null)).filter((n) => n !== 'close_app')
    const toolsChess = Object.keys(buildToolSet('chess')).filter((n) => n !== 'close_app')
    expect(toolsNull.sort()).toEqual(toolsChess.sort())
  })
})
