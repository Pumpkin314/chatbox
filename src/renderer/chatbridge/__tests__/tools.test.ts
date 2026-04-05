import { describe, it, expect } from 'vitest'
import { getChatBridgeTools } from '../tools'

describe('getChatBridgeTools', () => {
  it('always includes open_app and all enabled app tools', () => {
    const tools = getChatBridgeTools(null)
    const names = tools.map((t) => t.name)
    expect(names).toContain('open_app')
    // All enabled app tools should be present regardless of active app
    expect(names).toContain('start_game') // chess
    expect(names).toContain('get_weather') // weather
    expect(names).not.toContain('search_tracks') // spotify is disabled
  })

  it('includes same tools regardless of active app', () => {
    const toolsNoApp = getChatBridgeTools(null)
    const toolsChess = getChatBridgeTools('chess')
    const toolsWeather = getChatBridgeTools('weather')
    expect(toolsNoApp.map((t) => t.name)).toEqual(toolsChess.map((t) => t.name))
    expect(toolsNoApp.map((t) => t.name)).toEqual(toolsWeather.map((t) => t.name))
  })

  it('open_app description includes all enabled apps', () => {
    const tools = getChatBridgeTools(null)
    const openApp = tools.find((t) => t.name === 'open_app')
    expect(openApp?.description).toContain('Chess')
    expect(openApp?.description).toContain('Weather')
    expect(openApp?.description).not.toContain('Spotify')
  })
})
