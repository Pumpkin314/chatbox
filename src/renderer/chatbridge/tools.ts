import { generateOpenAppTool, getAppById } from './registry'
import type { ToolSchema } from './registry'

/**
 * Returns the set of ChatBridge tools available for the current context.
 *
 * Tool gating rules:
 * - No app active: only open_app is available
 * - App active: open_app + that app's tools (close_app is added by tool-builder)
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
