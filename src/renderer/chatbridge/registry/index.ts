export interface ChatBridgeApp {
  id: string
  name: string
  description: string
  entrypoint: string
  icon?: string
  tools?: ChatBridgeTool[]
}

export interface ChatBridgeTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

let registry: ChatBridgeApp[] = []

export function loadRegistry(apps: ChatBridgeApp[]): void {
  registry = apps
}

export function getAppById(id: string): ChatBridgeApp | undefined {
  return registry.find((app) => app.id === id)
}

export function getAllApps(): ChatBridgeApp[] {
  return [...registry]
}
