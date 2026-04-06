import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const HTML_PATH = resolve(__dirname, '..', 'index.html')

describe('NASA Space Explorer app', () => {
  let html: string

  beforeAll(() => {
    html = readFileSync(HTML_PATH, 'utf-8')
  })

  it('HTML file exists and is non-empty', () => {
    expect(html.length).toBeGreaterThan(0)
  })

  it('is a valid HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
    expect(html).toContain('<head>')
    expect(html).toContain('</head>')
    expect(html).toContain('<body>')
    expect(html).toContain('</body>')
  })

  it('contains inline CSS (no external stylesheets)', () => {
    expect(html).toContain('<style>')
    expect(html).toContain('</style>')
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["']/)
  })

  it('contains inline JS with bridge-sdk content (no external scripts)', () => {
    expect(html).toContain('<script>')
    expect(html).toContain('</script>')
    expect(html).not.toMatch(/<script[^>]+src=/)
  })

  it('inlines bridge-sdk.js content (ChatBridge SDK)', () => {
    // Key markers from bridge-sdk.js that prove it was inlined
    expect(html).toContain('window.ChatBridge')
    expect(html).toContain('toolCallHandlers')
    expect(html).toContain('sendToHost')
    expect(html).toContain('tool_call_result')
    expect(html).toContain("window.parent.postMessage(")
  })

  it('has two tabs: Explore and Dashboard', () => {
    expect(html).toContain('Explore')
    expect(html).toContain('Dashboard')
  })

  it('has APOD section in Explore tab', () => {
    expect(html).toContain('apod')
  })

  it('has Mars photos section in Dashboard tab', () => {
    expect(html).toContain('mars')
  })

  it('has asteroids section in Dashboard tab', () => {
    expect(html).toContain('asteroid')
  })

  it('has dark space theme', () => {
    expect(html).toContain('#0a0a1a')
  })

  it('handles get_apod tool calls', () => {
    expect(html).toContain('get_apod')
  })

  it('handles get_mars_photos tool calls', () => {
    expect(html).toContain('get_mars_photos')
  })

  it('handles get_asteroids tool calls', () => {
    expect(html).toContain('get_asteroids')
  })

  it('sends state updates on tab switch', () => {
    expect(html).toContain('state_update')
    expect(html).toContain('sendStateUpdate')
  })

  it('handles __proxyResult for real API data', () => {
    expect(html).toContain('__proxyResult')
  })

  it('has prev/next navigation for APOD dates', () => {
    // Check for navigation buttons or date changing logic
    expect(html).toMatch(/prev|previous/i)
    expect(html).toMatch(/next/i)
  })

  it('implements the bridge protocol message types', () => {
    expect(html).toContain("'app_init'")
    expect(html).toContain("'tool_call'")
    expect(html).toContain("'tool_call_result'")
    expect(html).toContain("'state_update'")
  })

  it('is between 700 and 900 lines', () => {
    const lineCount = html.split('\n').length
    expect(lineCount).toBeGreaterThanOrEqual(700)
    expect(lineCount).toBeLessThanOrEqual(900)
  })
})

describe('NASA app registry (apps.json)', () => {
  let registry: Array<{
    id: string
    name: string
    description: string
    type: string
    entrypoint: string
    authConfig: { type: string; envVar: string } | null
    tools?: Array<{
      name: string
      description: string
      parameters: { properties: Record<string, unknown>; required?: string[] }
    }>
    enabled: boolean
  }>

  beforeAll(() => {
    const jsonPath = resolve(__dirname, '..', '..', '..', 'registry', 'apps.json')
    const raw = readFileSync(jsonPath, 'utf-8')
    registry = JSON.parse(raw)
  })

  it('contains a nasa app entry', () => {
    const nasa = registry.find((app) => app.id === 'nasa')
    expect(nasa).toBeDefined()
  })

  it('nasa app has correct metadata', () => {
    const nasa = registry.find((app) => app.id === 'nasa')
    expect(nasa?.name).toBe('Space Explorer')
    expect(nasa?.type).toBe('external_public')
    expect(nasa?.enabled).toBe(true)
  })

  it('nasa app has correct entrypoint', () => {
    const nasa = registry.find((app) => app.id === 'nasa')
    expect(nasa?.entrypoint).toBe('/apps/nasa/index.html')
  })

  it('nasa app has api_key auth config', () => {
    const nasa = registry.find((app) => app.id === 'nasa')
    expect(nasa?.authConfig?.type).toBe('api_key')
    expect(nasa?.authConfig?.envVar).toBe('VITE_NASA_API_KEY')
  })

  it('nasa app has get_apod tool', () => {
    const nasa = registry.find((app) => app.id === 'nasa')
    const tool = nasa?.tools?.find((t) => t.name === 'get_apod')
    expect(tool).toBeDefined()
    expect(tool?.parameters.properties).toHaveProperty('date')
  })

  it('nasa app has get_mars_photos tool', () => {
    const nasa = registry.find((app) => app.id === 'nasa')
    const tool = nasa?.tools?.find((t) => t.name === 'get_mars_photos')
    expect(tool).toBeDefined()
    expect(tool?.parameters.properties).toHaveProperty('rover')
    expect(tool?.parameters.properties).toHaveProperty('earth_date')
  })

  it('nasa app has get_asteroids tool', () => {
    const nasa = registry.find((app) => app.id === 'nasa')
    const tool = nasa?.tools?.find((t) => t.name === 'get_asteroids')
    expect(tool).toBeDefined()
    expect(tool?.parameters.properties).toHaveProperty('start_date')
    expect(tool?.parameters.properties).toHaveProperty('end_date')
    expect(tool?.parameters.required).toContain('start_date')
  })

  it('nasa app has exactly 3 tools', () => {
    const nasa = registry.find((app) => app.id === 'nasa')
    expect(nasa?.tools).toHaveLength(3)
  })
})
