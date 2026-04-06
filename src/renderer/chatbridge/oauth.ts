/**
 * Third-party app OAuth2 PKCE flow — token exchange, refresh, and state management.
 *
 * This is separate from auth.ts (Supabase user auth). This module handles
 * OAuth2 flows for external services like Google Books.
 */

import { getSupabaseClient } from './supabase'

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function base64urlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64urlEncode(array)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64urlEncode(new Uint8Array(hash))
}

// ---------------------------------------------------------------------------
// PKCE state map (stores verifier by state param, one-time use, 5 min TTL)
// ---------------------------------------------------------------------------

const stateMap = new Map<string, { verifier: string; appId: string; expires: number }>()

export function storeState(state: string, verifier: string, appId: string): void {
  stateMap.set(state, { verifier, appId, expires: Date.now() + 5 * 60 * 1000 })
}

export function getState(state: string): { verifier: string; appId: string } | null {
  const entry = stateMap.get(state)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    stateMap.delete(state)
    return null
  }
  stateMap.delete(state) // one-time use
  return { verifier: entry.verifier, appId: entry.appId }
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of stateMap) {
    if (now > val.expires) stateMap.delete(key)
  }
}, 60_000)

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  authConfig: { tokenUrl: string; clientIdEnvVar: string },
  redirectUri: string,
): Promise<{ access_token: string; refresh_token: string; expires_at: number }> {
  const clientId = (import.meta.env[authConfig.clientIdEnvVar] as string) || ''
  const res = await fetch(authConfig.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${err}`)
  }
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
}

// ---------------------------------------------------------------------------
// Token refresh with mutex
// ---------------------------------------------------------------------------

const refreshInProgress = new Map<string, Promise<{ access_token: string; expires_at: number }>>()

export async function refreshAccessToken(
  refreshToken: string,
  authConfig: { tokenUrl: string; clientIdEnvVar: string },
): Promise<{ access_token: string; expires_at: number }> {
  // Mutex: deduplicate concurrent refresh calls for the same refresh token
  const existing = refreshInProgress.get(refreshToken)
  if (existing) return existing

  const promise = (async () => {
    const clientId = (import.meta.env[authConfig.clientIdEnvVar] as string) || ''
    const res = await fetch(authConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
    const data = await res.json()
    return {
      access_token: data.access_token as string,
      expires_at: Date.now() + (data.expires_in as number) * 1000,
    }
  })()

  refreshInProgress.set(refreshToken, promise)
  promise.finally(() => refreshInProgress.delete(refreshToken))

  return promise
}

// ---------------------------------------------------------------------------
// Get or refresh token from Supabase
// ---------------------------------------------------------------------------

export async function getOrRefreshToken(
  appId: string,
  authConfig: { tokenUrl: string; clientIdEnvVar: string },
): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: tokenRow } = await supabase
    .from('user_app_tokens')
    .select('*')
    .eq('user_id', user.id)
    .eq('app_id', appId)
    .single()

  if (!tokenRow) return null

  // Token still valid (with 60s buffer)
  if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() > Date.now() + 60_000) {
    return tokenRow.access_token
  }

  // Need refresh
  try {
    const result = await refreshAccessToken(tokenRow.refresh_token, authConfig)
    await supabase
      .from('user_app_tokens')
      .update({
        access_token: result.access_token,
        expires_at: new Date(result.expires_at).toISOString(),
      })
      .eq('user_id', user.id)
      .eq('app_id', appId)
    return result.access_token
  } catch {
    // Refresh failed — delete token, user must re-auth
    await supabase.from('user_app_tokens').delete().eq('user_id', user.id).eq('app_id', appId)
    return null
  }
}

// ---------------------------------------------------------------------------
// Store / delete token in Supabase
// ---------------------------------------------------------------------------

export async function storeToken(
  userId: string,
  appId: string,
  tokens: { access_token: string; refresh_token: string; expires_at: number },
): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return

  await supabase.from('user_app_tokens').upsert({
    user_id: userId,
    app_id: appId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expires_at).toISOString(),
  })
}

export async function deleteToken(userId: string, appId: string): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return

  await supabase.from('user_app_tokens').delete().eq('user_id', userId).eq('app_id', appId)
}

// ---------------------------------------------------------------------------
// Build OAuth authorization URL
// ---------------------------------------------------------------------------

export function buildAuthUrl(
  authConfig: {
    authUrl: string
    clientIdEnvVar: string
    scopes: string[]
  },
  redirectUri: string,
  codeChallenge: string,
  state: string,
): string {
  const clientId = (import.meta.env[authConfig.clientIdEnvVar] as string) || ''
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: authConfig.scopes.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `${authConfig.authUrl}?${params.toString()}`
}
