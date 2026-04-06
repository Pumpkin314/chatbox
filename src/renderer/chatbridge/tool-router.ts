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

  // Find the parent app for this tool (may differ from active app if LLM skipped open_app)
  let activeAppId = storeRef ? storeRef.get(activeAppAtom) : null
  let activeApp = activeAppId ? getAppById(activeAppId) : null

  // If no app is active, find which app owns this tool and auto-open it
  if (!activeApp || !activeApp.tools.some((t) => t.name === toolName)) {
    const ownerApp = getEnabledApps().find((app) => app.tools.some((t) => t.name === toolName))
    if (ownerApp && storeRef) {
      handleOpenApp(storeRef, ownerApp.id)
      activeAppId = ownerApp.id
      activeApp = ownerApp
    }
  }

  // FlashForge tools — Tier 1 internal, handled in-process (no iframe/bridge)
  const flashForgeResult = handleFlashForgeTool(toolName, args)
  if (flashForgeResult !== null) {
    return JSON.stringify(flashForgeResult)
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

// ─── FlashForge (Tier 1 JSON-only) ─────────────────────────────────────────

interface FlashCard {
  front: string
  back: string
}

interface CardState {
  studied: boolean
  correct: boolean | null
}

interface Deck {
  deck_id: string
  topic: string
  cards: FlashCard[]
  cardStates: CardState[]
  currentIndex: number
}

const deckStore = new Map<string, Deck>()

// Reset deck store (for testing)
export function _resetDeckStore(): void {
  deckStore.clear()
}

const CARD_TEMPLATES: Record<string, FlashCard[]> = {
  math: [
    { front: 'What is 7 x 8?', back: '56' },
    { front: 'What is the square root of 144?', back: '12' },
    { front: 'What is 15% of 200?', back: '30' },
    { front: 'What is the area formula for a circle?', back: 'pi r squared' },
    { front: 'What is 2 to the power of 10?', back: '1024' },
    { front: 'What is the value of pi to 2 decimal places?', back: '3.14' },
    { front: 'What is the sum of angles in a triangle?', back: '180 degrees' },
    { front: 'What is 12 factorial divided by 11 factorial?', back: '12' },
    { front: 'What is the slope-intercept form of a line?', back: 'y = mx + b' },
    { front: 'What is the quadratic formula?', back: 'x = (-b +/- sqrt(b^2 - 4ac)) / 2a' },
    { front: 'What is 3/4 as a decimal?', back: '0.75' },
    { front: 'What is the derivative of x^2?', back: '2x' },
    { front: 'What is the integral of 1/x?', back: 'ln|x| + C' },
    { front: 'What is log base 10 of 1000?', back: '3' },
    { front: 'What is the Pythagorean theorem?', back: 'a^2 + b^2 = c^2' },
    { front: 'What is 5! (5 factorial)?', back: '120' },
    { front: 'What is the circumference formula?', back: '2 pi r' },
    { front: 'How many degrees in a right angle?', back: '90' },
    { front: 'What is the GCD of 12 and 18?', back: '6' },
    { front: 'What is 0.1 + 0.2 in exact arithmetic?', back: '0.3' },
  ],
  science: [
    { front: 'What is the chemical symbol for water?', back: 'H2O' },
    { front: 'What is the speed of light in m/s?', back: '299792458' },
    { front: 'What planet is closest to the Sun?', back: 'Mercury' },
    { front: 'What is the atomic number of Carbon?', back: '6' },
    { front: 'What is Newton\'s second law?', back: 'F = ma' },
    { front: 'What is the powerhouse of the cell?', back: 'Mitochondria' },
    { front: 'What gas do plants absorb?', back: 'Carbon dioxide' },
    { front: 'What is the boiling point of water in Celsius?', back: '100' },
    { front: 'What is DNA short for?', back: 'Deoxyribonucleic acid' },
    { front: 'What is the largest organ in the human body?', back: 'Skin' },
    { front: 'What is the chemical formula for table salt?', back: 'NaCl' },
    { front: 'How many chromosomes do humans have?', back: '46' },
    { front: 'What is absolute zero in Celsius?', back: '-273.15' },
    { front: 'What type of rock is formed from lava?', back: 'Ignite' },
    { front: 'What is the most abundant gas in Earth\'s atmosphere?', back: 'Nitrogen' },
    { front: 'What is E = mc^2 called?', back: 'Mass-energy equivalence' },
    { front: 'What is the pH of pure water?', back: '7' },
    { front: 'What is the hardest natural substance?', back: 'Diamond' },
    { front: 'What force keeps planets in orbit?', back: 'Gravity' },
    { front: 'What is the SI unit of electric current?', back: 'Ampere' },
  ],
  history: [
    { front: 'In what year did World War II end?', back: '1945' },
    { front: 'Who was the first President of the United States?', back: 'George Washington' },
    { front: 'What year did the Berlin Wall fall?', back: '1989' },
    { front: 'Who wrote the Declaration of Independence?', back: 'Thomas Jefferson' },
    { front: 'In what year did Columbus reach the Americas?', back: '1492' },
    { front: 'What empire built the Colosseum?', back: 'Roman Empire' },
    { front: 'Who was the first man on the Moon?', back: 'Neil Armstrong' },
    { front: 'What year did the Titanic sink?', back: '1912' },
    { front: 'Who painted the Mona Lisa?', back: 'Leonardo da Vinci' },
    { front: 'What was the longest war in US history?', back: 'War in Afghanistan' },
    { front: 'What ancient wonder was in Alexandria?', back: 'The Lighthouse' },
    { front: 'Who discovered penicillin?', back: 'Alexander Fleming' },
    { front: 'What year did the French Revolution begin?', back: '1789' },
    { front: 'Who was the first Emperor of China?', back: 'Qin Shi Huang' },
    { front: 'What treaty ended World War I?', back: 'Treaty of Versailles' },
    { front: 'Who led India to independence?', back: 'Mahatma Gandhi' },
    { front: 'In what year was the Magna Carta signed?', back: '1215' },
    { front: 'What civilization built Machu Picchu?', back: 'Inca' },
    { front: 'Who invented the printing press?', back: 'Johannes Gutenberg' },
    { front: 'What year did the US Civil War begin?', back: '1861' },
  ],
  vocabulary: [
    { front: 'What does "ephemeral" mean?', back: 'Lasting for a very short time' },
    { front: 'What does "ubiquitous" mean?', back: 'Present everywhere' },
    { front: 'What does "pragmatic" mean?', back: 'Dealing with things practically' },
    { front: 'What does "eloquent" mean?', back: 'Fluent and persuasive in speaking' },
    { front: 'What does "ambiguous" mean?', back: 'Open to more than one interpretation' },
    { front: 'What does "benevolent" mean?', back: 'Well-meaning and kindly' },
    { front: 'What does "candid" mean?', back: 'Truthful and straightforward' },
    { front: 'What does "diligent" mean?', back: 'Showing careful and persistent effort' },
    { front: 'What does "empathy" mean?', back: 'The ability to understand others\' feelings' },
    { front: 'What does "frugal" mean?', back: 'Sparing or economical with money' },
    { front: 'What does "gregarious" mean?', back: 'Fond of company; sociable' },
    { front: 'What does "hypothesis" mean?', back: 'A proposed explanation for something' },
    { front: 'What does "imminent" mean?', back: 'About to happen' },
    { front: 'What does "juxtapose" mean?', back: 'Place close together for contrast' },
    { front: 'What does "keen" mean?', back: 'Eager or enthusiastic' },
    { front: 'What does "lethargic" mean?', back: 'Lacking energy; sluggish' },
    { front: 'What does "meticulous" mean?', back: 'Showing great attention to detail' },
    { front: 'What does "novel" mean (adjective)?', back: 'New and unusual' },
    { front: 'What does "obsolete" mean?', back: 'No longer in use; outdated' },
    { front: 'What does "pensive" mean?', back: 'Engaged in deep thought' },
  ],
}

function generateCards(topic: string, count: number): FlashCard[] {
  const key = topic.toLowerCase()
  const template = CARD_TEMPLATES[key]
  if (template) {
    return template.slice(0, count)
  }
  // Generic placeholder cards for unknown topics
  return Array.from({ length: count }, (_, i) => ({
    front: `${topic} - Question ${i + 1}: What is a key concept in ${topic}?`,
    back: `Key concept ${i + 1} of ${topic}`,
  }))
}

function handleFlashForgeTool(toolName: string, args: Record<string, unknown>): Record<string, unknown> | null {
  if (toolName === 'create_deck') {
    const topic = args.topic as string
    const rawCount = args.card_count as number
    const card_count = Math.max(3, Math.min(20, rawCount))
    const deck_id = `deck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const cards = generateCards(topic, card_count)
    const deck: Deck = {
      deck_id,
      topic,
      cards,
      cardStates: cards.map(() => ({ studied: false, correct: null })),
      currentIndex: 0,
    }
    deckStore.set(deck_id, deck)
    return { deck_id, topic, cards }
  }

  if (toolName === 'study_card') {
    const deck_id = args.deck_id as string
    const deck = deckStore.get(deck_id)
    if (!deck) return { error: `Deck "${deck_id}" not found` }

    // Find next unstudied card
    const idx = deck.cardStates.findIndex((s) => !s.studied)
    if (idx === -1) {
      return { done: true, message: 'All cards have been studied!' }
    }
    deck.currentIndex = idx
    return {
      front: deck.cards[idx].front,
      back: deck.cards[idx].back,
      card_number: idx + 1,
      total_cards: deck.cards.length,
    }
  }

  if (toolName === 'check_answer') {
    const deck_id = args.deck_id as string
    const card_number = args.card_number as number
    const answer = (args.answer as string).trim().toLowerCase()
    const deck = deckStore.get(deck_id)
    if (!deck) return { error: `Deck "${deck_id}" not found` }

    const idx = card_number - 1
    if (idx < 0 || idx >= deck.cards.length) {
      return { error: `Invalid card number: ${card_number}` }
    }

    const card = deck.cards[idx]
    const correct = answer === card.back.trim().toLowerCase()
    deck.cardStates[idx] = { studied: true, correct }

    return {
      correct,
      correct_answer: card.back,
      explanation: correct
        ? 'Great job! Your answer is correct.'
        : `The correct answer is "${card.back}". Your answer "${args.answer}" did not match.`,
    }
  }

  if (toolName === 'get_deck_stats') {
    const deck_id = args.deck_id as string
    const deck = deckStore.get(deck_id)
    if (!deck) return { error: `Deck "${deck_id}" not found` }

    const studied = deck.cardStates.filter((s) => s.studied).length
    const correct = deck.cardStates.filter((s) => s.correct === true).length
    const incorrect = deck.cardStates.filter((s) => s.correct === false).length
    const score_percent = studied > 0 ? Math.round((correct / studied) * 100) : 0

    return {
      total: deck.cards.length,
      studied,
      correct,
      incorrect,
      score_percent,
    }
  }

  return null // Not a FlashForge tool
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
