import { createStore } from 'jotai'
import { handleOpenApp, handleCloseApp, activeAppAtom } from './app-lifecycle'
import { getAppById, getEnabledApps } from './registry'

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
    // Include available tools in result so the LLM knows what it can do next
    const app = getAppById(appId)
    const availableTools = app?.tools.map((t) => t.name) ?? []
    return JSON.stringify({
      ...result,
      availableTools,
      hint: availableTools.length > 0
        ? `App "${app?.name}" is now open. Use the available tools (${availableTools.join(', ')}) to fulfill the user's request. Do NOT call open_app again.`
        : `App "${app?.name}" is now open.`,
    })
  }

  if (toolName === 'close_app') {
    if (!storeRef) {
      return JSON.stringify({ success: false, error: 'Store not initialized' })
    }
    handleCloseApp(storeRef)
    return JSON.stringify({ success: true })
  }

  // Find the active app and verify the tool belongs to it
  const activeAppId = storeRef ? storeRef.get(activeAppAtom) : null
  const activeApp = activeAppId ? getAppById(activeAppId) : null

  // If no app is active or tool doesn't belong to the active app, return an error
  if (!activeApp || !activeApp.tools.some((t) => t.name === toolName)) {
    const ownerApp = getEnabledApps().find((app) => app.tools.some((t) => t.name === toolName))
    if (ownerApp) {
      return JSON.stringify({
        error: `Tool "${toolName}" requires the ${ownerApp.name} app to be open. Use open_app first.`,
      })
    }
    return JSON.stringify({
      error: `Unknown tool "${toolName}". No app provides this tool.`,
    })
  }

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

    if (toolName === 'get_apod') {
      const date = (args.date as string) || new Date().toISOString().split('T')[0]
      if (!apiKey) return getMockAPOD(date)
      const res = await fetch(
        `https://api.nasa.gov/planetary/apod?api_key=${apiKey}&date=${encodeURIComponent(date)}`,
      )
      if (!res.ok) return getMockAPOD(date)
      const data = await res.json()
      return {
        title: data.title,
        explanation: data.explanation,
        url: data.url,
        hdurl: data.hdurl ?? data.url,
        date: data.date,
        media_type: data.media_type,
        copyright: data.copyright ?? null,
      }
    }

    if (toolName === 'get_mars_photos') {
      const rover = (args.rover as string) || 'curiosity'
      const earthDate = (args.earth_date as string) || '2024-01-15'
      if (!apiKey) return getMockMarsPhotos(rover, earthDate)
      const res = await fetch(
        `https://api.nasa.gov/mars-photos/api/v1/rovers/${encodeURIComponent(rover)}/photos?earth_date=${encodeURIComponent(earthDate)}&api_key=${apiKey}`,
      )
      if (!res.ok) return getMockMarsPhotos(rover, earthDate)
      const data = await res.json()
      const photos = (data.photos || []).slice(0, 6).map((p: Record<string, unknown>) => ({
        id: p.id,
        img_src: p.img_src,
        camera: (p.camera as Record<string, unknown>)?.full_name ?? 'Unknown',
        earth_date: p.earth_date,
        rover: (p.rover as Record<string, unknown>)?.name ?? rover,
      }))
      return { photos, rover, earth_date: earthDate }
    }

    if (toolName === 'get_asteroids') {
      const startDate = (args.start_date as string) || new Date().toISOString().split('T')[0]
      const endDateDefault = new Date(new Date(startDate).getTime() + 7 * 86400000).toISOString().split('T')[0]
      const endDate = (args.end_date as string) || endDateDefault
      if (!apiKey) return getMockAsteroids(startDate, endDate)
      const res = await fetch(
        `https://api.nasa.gov/neo/rest/v1/feed?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&api_key=${apiKey}`,
      )
      if (!res.ok) return getMockAsteroids(startDate, endDate)
      const data = await res.json()
      const allObjects: Record<string, unknown>[] = []
      for (const dateKey of Object.keys(data.near_earth_objects || {})) {
        for (const obj of (data.near_earth_objects[dateKey] as Record<string, unknown>[])) {
          const diameter = obj.estimated_diameter as Record<string, Record<string, number>>
          const closeApproach = ((obj.close_approach_data as Record<string, unknown>[]) || [])[0] || {}
          allObjects.push({
            name: obj.name,
            estimated_diameter_km: diameter?.kilometers?.estimated_diameter_max ?? 0,
            is_potentially_hazardous: obj.is_potentially_hazardous_asteroid,
            close_approach_date: (closeApproach as Record<string, unknown>).close_approach_date ?? dateKey,
            miss_distance_km: ((closeApproach as Record<string, unknown>).miss_distance as Record<string, unknown>)?.kilometers ?? 'N/A',
            relative_velocity_kmh: ((closeApproach as Record<string, unknown>).relative_velocity as Record<string, unknown>)?.kilometers_per_hour ?? 'N/A',
          })
        }
      }
      return { element_count: data.element_count ?? allObjects.length, near_earth_objects: allObjects, start_date: startDate, end_date: endDate }
    }

    return { success: false, error: `Unknown proxied tool: ${toolName}` }
  } catch (err) {
    // Fallback to mock data on any error
    if (toolName === 'get_weather') return getMockWeather(args.city as string)
    if (toolName === 'get_forecast') return getMockForecast(args.city as string, (args.days as number) || 3)
    if (toolName === 'get_apod') return getMockAPOD((args.date as string) || new Date().toISOString().split('T')[0])
    if (toolName === 'get_mars_photos') return getMockMarsPhotos((args.rover as string) || 'curiosity', (args.earth_date as string) || '2024-01-15')
    if (toolName === 'get_asteroids') return getMockAsteroids((args.start_date as string) || new Date().toISOString().split('T')[0], (args.end_date as string) || '')
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

function getMockAPOD(date: string): Record<string, unknown> {
  return {
    title: 'The Horsehead Nebula',
    explanation: 'One of the most identifiable nebulae in the sky, the Horsehead Nebula in Orion, is part of a large, dark, molecular cloud. Also known as Barnard 33, the unusual shape was first discovered on a photographic plate in the late 1800s.',
    url: 'https://apod.nasa.gov/apod/image/2401/Horsehead_hubble_960.jpg',
    hdurl: 'https://apod.nasa.gov/apod/image/2401/Horsehead_hubble_2400.jpg',
    date,
    media_type: 'image',
    copyright: 'NASA/ESA/Hubble',
    mock: true,
  }
}

function getMockMarsPhotos(rover: string, earthDate: string): Record<string, unknown> {
  const cameras = ['Front Hazard Avoidance Camera', 'Rear Hazard Avoidance Camera', 'Mast Camera', 'Chemistry and Camera Complex', 'Navigation Camera', 'Mars Hand Lens Imager']
  const photos = cameras.map((camera, i) => ({
    id: 100000 + i,
    img_src: `https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/03000/opgs/edr/fcam/FRA_${String(i).padStart(4, '0')}.JPG`,
    camera,
    earth_date: earthDate,
    rover: rover.charAt(0).toUpperCase() + rover.slice(1),
  }))
  return { photos, rover, earth_date: earthDate, mock: true }
}

function getMockAsteroids(startDate: string, endDate: string): Record<string, unknown> {
  const asteroids = [
    { name: '(2024 AA1)', estimated_diameter_km: 0.254, is_potentially_hazardous: false, close_approach_date: startDate, miss_distance_km: '4500000', relative_velocity_kmh: '45000' },
    { name: '(2024 AB2)', estimated_diameter_km: 0.087, is_potentially_hazardous: false, close_approach_date: startDate, miss_distance_km: '7200000', relative_velocity_kmh: '32000' },
    { name: '(2024 AC3)', estimated_diameter_km: 1.2, is_potentially_hazardous: true, close_approach_date: startDate, miss_distance_km: '2100000', relative_velocity_kmh: '67000' },
    { name: '(2024 AD4)', estimated_diameter_km: 0.045, is_potentially_hazardous: false, close_approach_date: startDate, miss_distance_km: '15000000', relative_velocity_kmh: '28000' },
    { name: '(2024 AE5)', estimated_diameter_km: 0.512, is_potentially_hazardous: false, close_approach_date: startDate, miss_distance_km: '6800000', relative_velocity_kmh: '52000' },
  ]
  return { element_count: asteroids.length, near_earth_objects: asteroids, start_date: startDate, end_date: endDate || startDate, mock: true }
}
