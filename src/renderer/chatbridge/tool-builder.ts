import { tool } from 'ai'
import { z } from 'zod'
import type { ToolSet } from 'ai'
import { getChatBridgeTools } from './tools'
import type { ToolSchema } from './registry'
import { routeToolCall } from './tool-router'

/**
 * Convert a JSON Schema property definition to a Zod schema.
 * Handles the types found in apps.json tool parameter definitions.
 */
function jsonPropertyToZod(prop: Record<string, unknown>): z.ZodType {
  const desc = typeof prop.description === 'string' ? prop.description : undefined

  if (prop.type === 'number') {
    let schema = z.number()
    if (desc) schema = schema.describe(desc)
    return schema
  }

  if (prop.type === 'array') {
    const items = (prop.items ?? {}) as Record<string, unknown>
    let schema = z.array(jsonPropertyToZod(items))
    if (desc) schema = schema.describe(desc)
    return schema
  }

  // Default to string (handles enum too)
  if (Array.isArray(prop.enum)) {
    const values = prop.enum as [string, ...string[]]
    let schema = z.enum(values)
    if (desc) schema = schema.describe(desc)
    return schema
  }

  let schema = z.string()
  if (desc) schema = schema.describe(desc)
  return schema
}

/**
 * Convert a ToolSchema (from the registry) into a Zod object schema
 * for use with the Vercel AI SDK tool() helper.
 */
function toolSchemaToZodParams(schema: ToolSchema): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {}
  const props = schema.parameters.properties
  const required = schema.parameters.required ?? []

  for (const [key, value] of Object.entries(props)) {
    const prop = value as Record<string, unknown>
    let zodProp = jsonPropertyToZod(prop)
    if (!required.includes(key)) {
      zodProp = zodProp.optional()
    }
    shape[key] = zodProp
  }

  return z.object(shape)
}

/**
 * Build a close_app system tool (not registered in apps.json).
 */
function buildCloseAppTool() {
  return tool({
    description: 'Close the currently active app in the side panel',
    parameters: z.object({}),
    execute: async () => {
      return await routeToolCall('close_app', {})
    },
  })
}

/**
 * Builds a Vercel AI SDK ToolSet from ChatBridge tool schemas.
 * When no app is active, only open_app is included.
 * When an app is active, open_app + close_app + all app-specific tools are included.
 */
export function buildToolSet(activeAppId: string | null): ToolSet {
  const schemas = getChatBridgeTools(activeAppId)
  const toolSet: ToolSet = {}

  for (const schema of schemas) {
    toolSet[schema.name] = tool({
      description: schema.description,
      parameters: toolSchemaToZodParams(schema),
      execute: async (args) => {
        return await routeToolCall(schema.name, args as Record<string, unknown>)
      },
    })
  }

  // Add close_app when an app is active (system tool, not in apps.json)
  if (activeAppId) {
    toolSet['close_app'] = buildCloseAppTool()
  }

  return toolSet
}
