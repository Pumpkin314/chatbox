import { generateOpenAppTool, getAppById } from './registry'
import type { ToolSchema } from './registry'

/**
 * Returns the set of ChatBridge tools available for the current context.
 * Always includes open_app. If an app is active, includes that app's tools.
 */
export function getChatBridgeTools(activeAppId: string | null): ToolSchema[] {
  const tools: ToolSchema[] = [generateOpenAppTool()]

  if (activeAppId) {
    const app = getAppById(activeAppId)
    if (app) {
      tools.push(...app.tools)
    }
  }

  return tools
}
