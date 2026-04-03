import appsData from './apps.json'

export interface ToolSchema {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface AuthConfig {
  type: string
  envVar?: string
  provider?: string
  authUrl?: string
  tokenUrl?: string
  clientIdEnvVar?: string
  scopes?: string[]
}

export interface AppRegistration {
  id: string
  name: string
  description: string
  type: 'internal' | 'external_public' | 'external_authenticated'
  tools: ToolSchema[]
  entrypoint: string
  authConfig: AuthConfig | null
  enabled: boolean
}

export function loadRegistry(): AppRegistration[] {
  return appsData as AppRegistration[]
}

export function getEnabledApps(): AppRegistration[] {
  return loadRegistry().filter((app) => app.enabled)
}

export function getAppById(id: string): AppRegistration | null {
  return loadRegistry().find((app) => app.id === id) ?? null
}

export function generateOpenAppTool(): ToolSchema {
  const enabled = getEnabledApps()
  const appList = enabled.map((app) => `${app.name} (${app.id}): ${app.description}`).join('; ')

  return {
    name: 'open_app',
    description: `Open an app in the side panel. Available apps: ${appList}`,
    parameters: {
      type: 'object',
      properties: {
        app_id: {
          type: 'string',
          enum: enabled.map((app) => app.id),
          description: 'The ID of the app to open',
        },
      },
      required: ['app_id'],
    },
  }
}
