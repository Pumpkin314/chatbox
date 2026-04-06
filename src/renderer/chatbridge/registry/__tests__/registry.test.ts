import { describe, it, expect } from 'vitest'
import {
  loadRegistry,
  getEnabledApps,
  getAppById,
  generateOpenAppTool,
} from '../index'

describe('Registry', () => {
  describe('loadRegistry', () => {
    it('returns 8 apps', () => {
      const apps = loadRegistry()
      expect(apps).toHaveLength(8)
    })
  })

  describe('getEnabledApps', () => {
    it('returns 6 enabled apps (excludes disabled rubiks and spotify)', () => {
      const apps = getEnabledApps()
      expect(apps).toHaveLength(6)
      const ids = apps.map((a) => a.id)
      expect(ids).toContain('chess')
      expect(ids).toContain('weather')
      expect(ids).toContain('contract-test')
      expect(ids).toContain('nasa')
      expect(ids).toContain('google-books')
      expect(ids).not.toContain('spotify')
      expect(ids).not.toContain('rubiks')
    })
  })

  describe('getAppById', () => {
    it('returns chess app for id "chess"', () => {
      const app = getAppById('chess')
      expect(app).not.toBeNull()
      expect(app!.id).toBe('chess')
      expect(app!.name).toBe('Chess')
    })

    it('returns rubiks app even though disabled', () => {
      const app = getAppById('rubiks')
      expect(app).not.toBeNull()
      expect(app!.id).toBe('rubiks')
      expect(app!.enabled).toBe(false)
    })

    it('returns null for nonexistent app', () => {
      const app = getAppById('nonexistent')
      expect(app).toBeNull()
    })
  })

  describe('generateOpenAppTool', () => {
    it('has correct enum of enabled app IDs', () => {
      const tool = generateOpenAppTool()
      expect(tool.name).toBe('open_app')
      const appIdParam = tool.parameters.properties.app_id
      expect(appIdParam.enum).toContain('chess')
      expect(appIdParam.enum).toContain('weather')
      expect(appIdParam.enum).toContain('contract-test')
      expect(appIdParam.enum).toContain('nasa')
      expect(appIdParam.enum).toContain('google-books')
      expect(appIdParam.enum).not.toContain('spotify')
      expect(appIdParam.enum).not.toContain('rubiks')
    })

    it('description mentions all enabled apps', () => {
      const tool = generateOpenAppTool()
      expect(tool.description).toContain('Chess')
      expect(tool.description).toContain('Weather Dashboard')
      expect(tool.description).toContain('Contract Test')
      expect(tool.description).toContain('Space Explorer')
      expect(tool.description).toContain('Google Books')
      expect(tool.description).not.toContain('Spotify Playlist Creator')
    })
  })

  describe('contract-test app', () => {
    it('exists in registry and is enabled', () => {
      const app = getAppById('contract-test')
      expect(app).not.toBeNull()
      expect(app!.enabled).toBe(true)
      expect(app!.type).toBe('internal')
    })

    it('has echo tool with correct schema', () => {
      const app = getAppById('contract-test')!
      expect(app.tools).toHaveLength(1)
      const echoTool = app.tools[0]
      expect(echoTool.name).toBe('echo')
      expect(echoTool.parameters.properties).toHaveProperty('message')
      expect(echoTool.parameters.required).toContain('message')
    })

    it('has correct entrypoint', () => {
      const app = getAppById('contract-test')!
      expect(app.entrypoint).toBe('/apps/contract-test/index.html')
    })
  })

  describe('nasa app', () => {
    it('exists in registry and is enabled', () => {
      const app = getAppById('nasa')
      expect(app).not.toBeNull()
      expect(app!.enabled).toBe(true)
      expect(app!.type).toBe('external_public')
    })

    it('has 3 tools', () => {
      const app = getAppById('nasa')!
      expect(app.tools).toHaveLength(3)
      const names = app.tools.map((t) => t.name)
      expect(names).toContain('get_apod')
      expect(names).toContain('get_mars_photos')
      expect(names).toContain('get_asteroids')
    })

    it('has api_key auth config', () => {
      const app = getAppById('nasa')!
      expect(app.authConfig).toEqual({ type: 'api_key', envVar: 'VITE_NASA_API_KEY' })
    })
  })
})
