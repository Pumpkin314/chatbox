import { describe, it, expect } from 'vitest'
import {
  loadRegistry,
  getEnabledApps,
  getAppById,
  generateOpenAppTool,
} from '../index'

describe('Registry', () => {
  describe('loadRegistry', () => {
    it('returns 5 apps', () => {
      const apps = loadRegistry()
      expect(apps).toHaveLength(5)
    })
  })

  describe('getEnabledApps', () => {
    it('returns 4 enabled apps (excludes disabled rubiks)', () => {
      const apps = getEnabledApps()
      expect(apps).toHaveLength(4)
      const ids = apps.map((a) => a.id)
      expect(ids).toContain('chess')
      expect(ids).toContain('weather')
      expect(ids).toContain('spotify')
      expect(ids).toContain('contract-test')
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
    it('has correct enum of enabled app IDs (no rubiks)', () => {
      const tool = generateOpenAppTool()
      expect(tool.name).toBe('open_app')
      const appIdParam = tool.parameters.properties.app_id
      expect(appIdParam.enum).toContain('chess')
      expect(appIdParam.enum).toContain('weather')
      expect(appIdParam.enum).toContain('spotify')
      expect(appIdParam.enum).toContain('contract-test')
      expect(appIdParam.enum).not.toContain('rubiks')
    })

    it('description mentions all 4 enabled apps', () => {
      const tool = generateOpenAppTool()
      expect(tool.description).toContain('Chess')
      expect(tool.description).toContain('Weather Dashboard')
      expect(tool.description).toContain('Spotify Playlist Creator')
      expect(tool.description).toContain('Contract Test')
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
})
