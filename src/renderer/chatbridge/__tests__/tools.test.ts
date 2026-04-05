import { describe, it, expect } from 'vitest'
import { getChatBridgeTools } from '../tools'

describe('getChatBridgeTools', () => {
  it('returns only open_app when no app is active', () => {
    const tools = getChatBridgeTools(null)
    const names = tools.map((t) => t.name)
    expect(names).toEqual(['open_app'])
  })

  it('returns open_app + chess tools when chess is active', () => {
    const tools = getChatBridgeTools('chess')
    const names = tools.map((t) => t.name)
    expect(names).toContain('open_app')
    expect(names).toContain('start_game')
    expect(names).toContain('make_move')
    expect(names).toContain('get_board')
    expect(names).toContain('get_hint')
    expect(names).toContain('resign')
    // Should NOT contain tools from other apps
    expect(names).not.toContain('get_weather')
    expect(names).not.toContain('search_tracks')
    expect(names).not.toContain('echo')
  })

  it('returns open_app + contract-test tools when contract-test is active', () => {
    const tools = getChatBridgeTools('contract-test')
    const names = tools.map((t) => t.name)
    expect(names).toContain('open_app')
    expect(names).toContain('echo')
    expect(names).not.toContain('start_game')
    expect(names).not.toContain('get_weather')
  })

  it('returns open_app + weather tools when weather is active', () => {
    const tools = getChatBridgeTools('weather')
    const names = tools.map((t) => t.name)
    expect(names).toContain('open_app')
    expect(names).toContain('get_weather')
    expect(names).toContain('get_forecast')
    // Should NOT contain tools from other apps
    expect(names).not.toContain('start_game')
    expect(names).not.toContain('search_tracks')
  })

  it('open_app description includes all enabled apps', () => {
    const tools = getChatBridgeTools(null)
    const openApp = tools.find((t) => t.name === 'open_app')
    expect(openApp?.description).toContain('Chess')
    expect(openApp?.description).toContain('Weather')
    expect(openApp?.description).toContain('Spotify')
    expect(openApp?.description).toContain('Contract Test')
  })
})
