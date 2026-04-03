import { generateOpenAppTool, getAppById, getEnabledApps } from './registry'
import type { ToolSchema } from './registry'

/**
 * Returns the set of ChatBridge tools available for the current context.
 * Always includes open_app + all enabled app tools so the LLM can call
 * app-specific tools (e.g. get_weather) in the same multi-step stream
 * after calling open_app.
 */
export function getChatBridgeTools(activeAppId: string | null): ToolSchema[] {
  const tools: ToolSchema[] = [generateOpenAppTool()]

  // Include all enabled app tools so multi-step tool calls work
  // (the tool set is static for the duration of a streamText call)
  for (const app of getEnabledApps()) {
    tools.push(...app.tools)
  }

  return tools
}
