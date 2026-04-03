import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient
  }

  const url = typeof process !== 'undefined'
    ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    : undefined
  const anonKey = typeof process !== 'undefined'
    ? process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    : undefined

  if (!url || !anonKey) {
    console.warn('[ChatBridge] Supabase not configured: missing URL or anon key')
    return null
  }

  supabaseClient = createClient(url, anonKey)
  return supabaseClient
}

export const supabase = getSupabaseClient()
