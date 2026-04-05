import { describe, it, expect } from 'vitest'
import {
  loadRegistry,
  getEnabledApps,
  getAppById,
  generateOpenAppTool,
} from '../index'

describe('Registry', () => {
  describe('loadRegistry', () => {
    it('returns 4 apps', () => {
      const apps = loadRegistry()
      expect(apps).toHaveLength(4)
    })
  })

  describe('getEnabledApps', () => {
    it('returns 2 enabled apps (excludes disabled rubiks and spotify)', () => {
      const apps = getEnabledApps()
      expect(apps).toHaveLength(2)
      const ids = apps.map((a) => a.id)
      expect(ids).toContain('chess')
      expect(ids).toContain('weather')
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
    it('has correct enum of enabled app IDs (no rubiks or spotify)', () => {
      const tool = generateOpenAppTool()
      expect(tool.name).toBe('open_app')
      const appIdParam = tool.parameters.properties.app_id
      expect(appIdParam.enum).toContain('chess')
      expect(appIdParam.enum).toContain('weather')
      expect(appIdParam.enum).not.toContain('spotify')
      expect(appIdParam.enum).not.toContain('rubiks')
    })

    it('description mentions all 2 enabled apps', () => {
      const tool = generateOpenAppTool()
      expect(tool.description).toContain('Chess')
      expect(tool.description).toContain('Weather Dashboard')
      expect(tool.description).not.toContain('Spotify Playlist Creator')
    })
  })
})
