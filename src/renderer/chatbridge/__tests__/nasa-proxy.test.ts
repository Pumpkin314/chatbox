import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStore } from 'jotai'
import { routeToolCall, setBridgeRef, setStoreRef, type AppBridge } from '../tool-router'
import { getChatBridgeTools } from '../tools'

describe('NASA proxy handlers', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    setStoreRef(store)
    setBridgeRef(null as unknown as AppBridge)
  })

  describe('get_apod', () => {
    it('returns mock APOD data when no API key', async () => {
      const result = await routeToolCall('get_apod', {})
      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('title')
      expect(parsed).toHaveProperty('explanation')
      expect(parsed).toHaveProperty('url')
      expect(parsed).toHaveProperty('date')
      expect(parsed).toHaveProperty('media_type')
    })

    it('returns mock APOD data with a specific date', async () => {
      const result = await routeToolCall('get_apod', { date: '2024-01-15' })
      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('title')
      expect(parsed.date).toBe('2024-01-15')
    })
  })

  describe('get_mars_photos', () => {
    it('returns mock Mars photos when no API key', async () => {
      const result = await routeToolCall('get_mars_photos', { rover: 'curiosity', earth_date: '2024-01-15' })
      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('photos')
      expect(Array.isArray(parsed.photos)).toBe(true)
      expect(parsed.photos.length).toBeGreaterThan(0)
      expect(parsed.photos[0]).toHaveProperty('img_src')
      expect(parsed.photos[0]).toHaveProperty('camera')
    })
  })

  describe('get_asteroids', () => {
    it('returns mock asteroid data when no API key', async () => {
      const result = await routeToolCall('get_asteroids', { start_date: '2024-01-15' })
      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('element_count')
      expect(parsed).toHaveProperty('near_earth_objects')
      expect(Array.isArray(parsed.near_earth_objects)).toBe(true)
      expect(parsed.near_earth_objects.length).toBeGreaterThan(0)
      expect(parsed.near_earth_objects[0]).toHaveProperty('name')
      expect(parsed.near_earth_objects[0]).toHaveProperty('estimated_diameter_km')
    })
  })
})

describe('getChatBridgeTools includes NASA tools', () => {
  it('includes NASA tools in the tool list', () => {
    const tools = getChatBridgeTools(null)
    const names = tools.map((t) => t.name)
    expect(names).toContain('get_apod')
    expect(names).toContain('get_mars_photos')
    expect(names).toContain('get_asteroids')
  })

  it('includes NASA tools when nasa app is active', () => {
    const tools = getChatBridgeTools('nasa')
    const names = tools.map((t) => t.name)
    expect(names).toContain('get_apod')
    expect(names).toContain('get_mars_photos')
    expect(names).toContain('get_asteroids')
  })
})
