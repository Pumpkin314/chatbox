import { tool } from 'ai'
import { z } from 'zod'
import type { ToolSet } from 'ai'
import { getChatBridgeTools } from './tools'
import type { ToolSchema } from './registry'
import { routeToolCall } from './tool-router'

/**
 * Convert a JSON Schema property to a Zod schema.
 * Handles types found in apps.json tool definitions.
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

  // String with enum constraint — encode allowed values in description
  let schema = z.string()
  if (Array.isArray(prop.enum)) {
    const enumDesc = `${desc ? desc + '. ' : ''}Allowed values: ${(prop.enum as string[]).join(', ')}`
    schema = schema.describe(enumDesc)
    return schema
  }
  if (desc) schema = schema.describe(desc)
  return schema
}

/**
 * Convert a ToolSchema (from the registry) into a Zod object schema.
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
    inputSchema: z.object({}),
    execute: async () => {
      return await routeToolCall('close_app', {})
    },
  })
}

/**
 * Builds a Vercel AI SDK ToolSet from ChatBridge tool schemas.
 * Uses inputSchema (not parameters) to match how existing tools work —
 * the AI SDK's OpenAI provider reads tool.inputSchema for the JSON Schema.
 */
export function buildToolSet(activeAppId: string | null): ToolSet {
  const schemas = getChatBridgeTools(activeAppId)
  const toolSet: ToolSet = {}

  for (const schema of schemas) {
    toolSet[schema.name] = tool({
      description: schema.description,
      inputSchema: toolSchemaToZodParams(schema),
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
