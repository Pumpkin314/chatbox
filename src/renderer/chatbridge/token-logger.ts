/**
 * Token usage logger for ChatBridge.
 * Logs token usage to Supabase token_usage_log table after each LLM call.
 * L3 graceful degradation: falls back to console.log when Supabase is unavailable.
 * Never throws — all errors are caught and logged to console.
 */

import type { StreamTextResult } from '../../../shared/types'
import { getSupabaseClient } from './supabase'

export interface LogTokenUsageParams {
  userId?: string
  conversationId?: string
  model: string
  promptTokens: number
  completionTokens: number
}

/**
 * Per-model pricing in dollars per 1M tokens.
 * { input: $/1M input tokens, output: $/1M output tokens }
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
}

const DEFAULT_PRICING = { input: 1.0, output: 3.0 }

/**
 * Calculate estimated cost in dollars for a given model and token counts.
 */
export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output
}

/**
 * Log token usage to Supabase or console.
 * Fire-and-forget — never throws.
 */
export async function logTokenUsage(params: LogTokenUsageParams): Promise<void> {
  try {
    const { userId, conversationId, model, promptTokens, completionTokens } = params
    const estimatedCost = estimateCost(model, promptTokens, completionTokens)

    const record = {
      user_id: userId,
      conversation_id: conversationId,
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      estimated_cost: estimatedCost,
    }

    const client = getSupabaseClient()
    if (!client) {
      console.log('[TokenLogger] Supabase unavailable, logging to console:', record)
      return
    }

    // Skip insert when no authenticated user — RLS policy requires a valid user_id
    if (!userId) {
      console.log('[TokenLogger] No authenticated user, skipping insert:', record)
      return
    }

    const { error } = await client.from('token_usage_log').insert([record])
    if (error) {
      console.error('[TokenLogger] Failed to insert token usage:', error)
    }
  } catch (err) {
    console.error('[TokenLogger] Unexpected error:', err)
  }
}

/**
 * Extract usage data from a StreamTextResult and log it.
 * Intended to be called fire-and-forget after each streamText completion.
 * Does nothing if usage data is missing or zero.
 */
export function logTokenUsageFromResult(
  result: StreamTextResult,
  modelId: string,
  sessionId?: string
): void {
  const usage = result.usage
  if (!usage || (usage.promptTokens === 0 && usage.completionTokens === 0)) {
    return
  }

  // Fire-and-forget — do not await
  void logTokenUsage({
    conversationId: sessionId,
    model: modelId,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  })
}
