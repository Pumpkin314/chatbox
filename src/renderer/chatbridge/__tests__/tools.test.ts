import { describe, it, expect } from 'vitest'
import { getChatBridgeTools } from '../tools'

describe('getChatBridgeTools', () => {
  it('returns only open_app when no active app', () => {
    const tools = getChatBridgeTools(null)
    const names = tools.map((t) => t.name)
    expect(names).toEqual(['open_app'])
  })

  it('returns open_app + chess tools when chess is active', () => {
    const tools = getChatBridgeTools('chess')
    const names = tools.map((t) => t.name)
    expect(names).toEqual(['open_app', 'start_game', 'make_move', 'get_board', 'get_hint', 'resign'])
  })

  it('returns open_app + weather tools when weather is active', () => {
    const tools = getChatBridgeTools('weather')
    const names = tools.map((t) => t.name)
    expect(names).toEqual(['open_app', 'get_weather', 'get_forecast'])
  })
})
