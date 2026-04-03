import type { ChatBridgeApp } from './registry'

export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/**
 * Returns tool schemas for the given active app.
 * If no app is active, returns an empty array.
 */
export function getChatBridgeTools(app: ChatBridgeApp | null): ToolSchema[] {
  if (!app?.tools) return []
  return app.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))
}
