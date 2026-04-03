import type { Store } from 'jotai'
import { activeAppAtom, appStateAtom } from './app-lifecycle'
import { appContextHistoryAtom } from './context-manager'
import { getAppById } from './registry'

/**
 * Generates the ChatBridge context section for the system prompt.
 * Includes active app state and recent app interaction history.
 */
export function getChatBridgeSystemPrompt(store: Store): string {
  const sections: string[] = []
  const activeAppId = store.get(activeAppAtom)
  const appState = store.get(appStateAtom)
  const history = store.get(appContextHistoryAtom)

  // Active app context
  if (activeAppId) {
    const app = getAppById(activeAppId)
    if (app) {
      sections.push(`## Active App: ${app.name}`)
      sections.push(`${app.description}`)
      if (appState && Object.keys(appState).length > 0) {
        sections.push(`Current state: ${JSON.stringify(appState)}`)
      }
      sections.push(`Available tools: ${app.tools.map((t) => t.name).join(', ')}`)
    }
  }

  // Recent app history (last 5 entries)
  const recentHistory = history.slice(-5)
  if (recentHistory.length > 0) {
    sections.push(`## Recent App Interactions`)
    for (const entry of recentHistory) {
      const stateStr = JSON.stringify(entry.state)
      // Truncate large states
      const truncated = stateStr.length > 500 ? stateStr.slice(0, 500) + '...' : stateStr
      sections.push(`- ${entry.appName} (${entry.type}): ${truncated}`)
    }
  }

  if (sections.length === 0) return ''
  return `\n---\n# ChatBridge Context\n${sections.join('\n')}\n---\n`
}
