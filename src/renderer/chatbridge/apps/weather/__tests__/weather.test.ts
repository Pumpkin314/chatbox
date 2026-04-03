import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const HTML_PATH = resolve(__dirname, '..', 'index.html')

describe('Weather Dashboard app', () => {
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
    // Should NOT have external stylesheet links
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["']/)
  })

  it('contains inline JS (no external scripts)', () => {
    expect(html).toContain('<script>')
    expect(html).toContain('</script>')
    // Should NOT have external script sources
    expect(html).not.toMatch(/<script[^>]+src=/)
  })

  it('contains the empty state UI', () => {
    expect(html).toContain('emptyState')
    expect(html).toContain('Ask me about the weather in any city')
  })

  it('contains the dashboard UI elements', () => {
    expect(html).toContain('id="dashboard"')
    expect(html).toContain('id="cityName"')
    expect(html).toContain('id="temperature"')
    expect(html).toContain('id="weatherIcon"')
    expect(html).toContain('id="conditionText"')
    expect(html).toContain('id="humidity"')
    expect(html).toContain('id="windSpeed"')
    expect(html).toContain('id="feelsLike"')
    expect(html).toContain('id="pressure"')
  })

  it('contains the forecast section', () => {
    expect(html).toContain('id="forecastSection"')
    expect(html).toContain('id="forecastScroll"')
    expect(html).toContain('forecast-card')
  })

  it('has mock data for required cities', () => {
    const requiredCities = ['new york', 'london', 'tokyo', 'paris', 'sydney']
    for (const city of requiredCities) {
      expect(html).toContain(`'${city}'`)
    }
  })

  it('handles get_weather tool calls', () => {
    expect(html).toContain("toolName === 'get_weather'")
    expect(html).toContain('getMockWeather')
  })

  it('handles get_forecast tool calls', () => {
    expect(html).toContain("toolName === 'get_forecast'")
    expect(html).toContain('getMockForecast')
  })

  it('implements the bridge protocol message types', () => {
    expect(html).toContain("'app_init'")
    expect(html).toContain("'tool_call'")
    expect(html).toContain("'tool_call_result'")
    expect(html).toContain("'state_update'")
    expect(html).toContain("'ready'")
    expect(html).toContain("'ping'")
  })

  it('posts messages to parent with wildcard origin', () => {
    expect(html).toContain("window.parent.postMessage(")
    expect(html).toContain("'*'")
  })

  it('uses Fahrenheit as default with Celsius in parentheses', () => {
    // Check the formatting function exists
    expect(html).toContain('fToC')
    // Check the template includes both units (stored as JS unicode escapes in the HTML)
    expect(html).toContain('\\u00B0F')
    expect(html).toContain('\\u00B0C')
  })

  it('supports dark theme by default', () => {
    expect(html).toContain('background: #1a1a2e')
  })

  it('supports light theme toggle', () => {
    expect(html).toContain('body.light')
    expect(html).toContain("theme === 'light'")
  })

  it('mock data includes all expected fields', () => {
    // Verify mock data has required fields by checking object structure in source
    const mockFields = ['temp', 'feels_like', 'humidity', 'wind_speed', 'pressure', 'condition', 'icon']
    for (const field of mockFields) {
      expect(html).toContain(`${field}:`)
    }
  })
})

describe('Weather app registry (apps.json)', () => {
  let registry: Array<{
    id: string
    name: string
    description: string
    entrypoint: string
    tools?: Array<{
      name: string
      parameters: { properties: Record<string, unknown> }
    }>
  }>

  beforeAll(() => {
    const jsonPath = resolve(__dirname, '..', '..', '..', 'registry', 'apps.json')
    const raw = readFileSync(jsonPath, 'utf-8')
    registry = JSON.parse(raw)
  })

  it('contains a weather app entry', () => {
    const weather = registry.find((app) => app.id === 'weather')
    expect(weather).toBeDefined()
  })

  it('weather app has correct entrypoint', () => {
    const weather = registry.find((app) => app.id === 'weather')
    expect(weather?.entrypoint).toBe('/apps/weather/index.html')
  })

  it('weather app has get_weather tool', () => {
    const weather = registry.find((app) => app.id === 'weather')
    const tool = weather?.tools?.find((t) => t.name === 'get_weather')
    expect(tool).toBeDefined()
    expect(tool?.parameters.properties).toHaveProperty('city')
  })

  it('weather app has get_forecast tool', () => {
    const weather = registry.find((app) => app.id === 'weather')
    const tool = weather?.tools?.find((t) => t.name === 'get_forecast')
    expect(tool).toBeDefined()
    expect(tool?.parameters.properties).toHaveProperty('city')
    expect(tool?.parameters.properties).toHaveProperty('days')
  })
})
