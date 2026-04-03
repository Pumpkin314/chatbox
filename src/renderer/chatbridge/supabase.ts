/**
 * Supabase client for ChatBridge.
 * Returns null when Supabase is not configured (L3 graceful degradation).
 * This module will be fully implemented in Sprint 0.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  return client
}

export function setSupabaseClient(c: SupabaseClient | null): void {
  client = c
}
