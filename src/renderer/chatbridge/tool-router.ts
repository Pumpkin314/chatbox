import { createStore } from 'jotai'
import { handleOpenApp, handleCloseApp, activeAppAtom } from './app-lifecycle'
import { getAppById } from './registry'

/**
 * Bridge interface — PR 2.2 will provide the real implementation.
 * Use setBridgeRef() to wire it up once available.
 */
export interface AppBridge {
  sendToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown>
}

let bridgeRef: AppBridge | null = null
let storeRef: ReturnType<typeof createStore> | null = null

/**
 * Set the bridge reference so tool calls can be routed to the iframe.
 * Called by PR 2.2 when the postMessage bridge is initialized.
 */
export function setBridgeRef(bridge: AppBridge): void {
  bridgeRef = bridge
}

/**
 * Set the Jotai store reference for lifecycle operations.
 */
export function setStoreRef(store: ReturnType<typeof createStore>): void {
  storeRef = store
}

/**
 * Route a tool call to the appropriate handler.
 *
 * - open_app  -> handleOpenApp (Jotai store)
 * - close_app -> handleCloseApp (Jotai store)
 * - otherwise -> forward to active app iframe via bridge
 *
 * Returns JSON-stringified result.
 */
export async function routeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
  if (toolName === 'open_app') {
    if (!storeRef) {
      return JSON.stringify({ success: false, error: 'Store not initialized' })
    }
    const appId = args.app_id as string
    const result = handleOpenApp(storeRef, appId)
    return JSON.stringify(result)
  }

  if (toolName === 'close_app') {
    if (!storeRef) {
      return JSON.stringify({ success: false, error: 'Store not initialized' })
    }
    handleCloseApp(storeRef)
    return JSON.stringify({ success: true })
  }

  // Check if this tool should be proxied on the host (API-calling tools)
  const activeAppId = storeRef ? storeRef.get(activeAppAtom) : null
  const activeApp = activeAppId ? getAppById(activeAppId) : null
  if (activeApp?.authConfig?.type === 'api_key') {
    const apiKey = (typeof import.meta !== 'undefined' && (import.meta as Record<string, Record<string, string>>).env?.[activeApp.authConfig.envVar ?? '']) || ''
    const result = await executeHostProxiedTool(toolName, args, apiKey)
    // Also send result to iframe for UI display
    if (bridgeRef) {
      bridgeRef.sendToolCall(toolName, { ...args, __proxyResult: result }).catch(() => {})
    }
    return JSON.stringify(result)
  }

  // App-specific tool — route through bridge
  if (!bridgeRef) {
    return JSON.stringify({
      success: false,
      error: `Bridge not available. Cannot route tool call "${toolName}" to app iframe.`,
    })
  }

  try {
    const result = await bridgeRef.sendToolCall(toolName, args)
    return JSON.stringify(result)
  } catch (err) {
    return JSON.stringify({
      success: false,
      error: `Bridge error for "${toolName}": ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}

/**
 * Execute an API tool call on the host side (bypasses iframe sandbox network restrictions).
 * Currently supports OpenWeatherMap tools. Returns structured data for both LLM and iframe.
 */
async function executeHostProxiedTool(
  toolName: string,
  args: Record<string, unknown>,
  apiKey: string,
): Promise<Record<string, unknown>> {
  try {
    if (toolName === 'get_weather') {
      const city = args.city as string
      if (!apiKey) return getMockWeather(city)
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=imperial`,
      )
      if (!res.ok) return getMockWeather(city)
      const data = await res.json()
      return {
        city: data.name,
        temp: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        wind_speed: Math.round(data.wind.speed),
        condition: data.weather[0]?.main ?? 'Unknown',
        description: data.weather[0]?.description ?? '',
        pressure: data.main.pressure,
      }
    }

    if (toolName === 'get_forecast') {
      const city = args.city as string
      const days = (args.days as number) || 3
      if (!apiKey) return getMockForecast(city, days)
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=imperial&cnt=${days * 8}`,
      )
      if (!res.ok) return getMockForecast(city, days)
      const data = await res.json()
      // Group by day (every 8th entry = 1 day at 3-hour intervals)
      const dailyForecasts = []
      for (let i = 0; i < data.list.length; i += 8) {
        const item = data.list[i]
        dailyForecasts.push({
          date: item.dt_txt.split(' ')[0],
          temp: Math.round(item.main.temp),
          condition: item.weather[0]?.main ?? 'Unknown',
        })
      }
      return { city: data.city.name, forecasts: dailyForecasts }
    }

    return { success: false, error: `Unknown proxied tool: ${toolName}` }
  } catch (err) {
    // Fallback to mock data on any error
    if (toolName === 'get_weather') return getMockWeather(args.city as string)
    if (toolName === 'get_forecast') return getMockForecast(args.city as string, (args.days as number) || 3)
    return { success: false, error: String(err) }
  }
}

function getMockWeather(city: string): Record<string, unknown> {
  const mocks: Record<string, Record<string, unknown>> = {
    'new york': { city: 'New York', temp: 72, feels_like: 70, humidity: 55, wind_speed: 12, condition: 'Partly Cloudy', pressure: 1015 },
    london: { city: 'London', temp: 58, feels_like: 55, humidity: 78, wind_speed: 15, condition: 'Overcast', pressure: 1008 },
    tokyo: { city: 'Tokyo', temp: 68, feels_like: 66, humidity: 62, wind_speed: 8, condition: 'Clear', pressure: 1020 },
    paris: { city: 'Paris', temp: 63, feels_like: 60, humidity: 65, wind_speed: 10, condition: 'Partly Cloudy', pressure: 1012 },
    sydney: { city: 'Sydney', temp: 75, feels_like: 73, humidity: 50, wind_speed: 14, condition: 'Sunny', pressure: 1018 },
  }
  const key = city.toLowerCase()
  return mocks[key] ?? { city, temp: 65, feels_like: 63, humidity: 60, wind_speed: 10, condition: 'Clear', pressure: 1013, mock: true }
}

function getMockForecast(city: string, days: number): Record<string, unknown> {
  const forecasts = Array.from({ length: days }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i + 1)
    return {
      date: date.toISOString().split('T')[0],
      temp: 60 + Math.round(Math.sin(i) * 10),
      condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Rain', 'Clear'][i % 5],
    }
  })
  return { city, forecasts, mock: true }
}
