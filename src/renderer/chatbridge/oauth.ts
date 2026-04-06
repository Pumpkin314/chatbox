/**
 * Third-party OAuth2 PKCE flow helpers.
 *
 * Used by the host (SidePanel.tsx) to open Google consent popups,
 * exchange authorization codes for tokens, and store tokens in Supabase.
 *
 * This module is separate from auth.ts, which handles Supabase user auth.
 */

import type { AuthConfig } from './registry'
import { getSupabaseClient } from './supabase'

// In-memory PKCE state map: state -> {verifier, appId}
// Entries auto-expire after 5 minutes.
const stateMap = new Map<string, { verifier: string; appId: string; createdAt: number }>()
const STATE_TTL_MS = 5 * 60 * 1000

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
}

/**
 * Generate a PKCE code_verifier (43-128 character random string per RFC 7636).
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Compute code_challenge = base64url(SHA-256(code_verifier)).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Store PKCE state for later retrieval during the callback.
 */
export function storeState(state: string, verifier: string, appId: string): void {
  // Clean up expired entries
  const now = Date.now()
  for (const [key, entry] of stateMap) {
    if (now - entry.createdAt > STATE_TTL_MS) {
      stateMap.delete(key)
    }
  }
  stateMap.set(state, { verifier, appId, createdAt: now })
}

/**
 * Retrieve and remove PKCE state for a given state parameter.
 */
export function getState(state: string): { verifier: string; appId: string } | null {
  const entry = stateMap.get(state)
  if (!entry) return null
  if (Date.now() - entry.createdAt > STATE_TTL_MS) {
    stateMap.delete(state)
    return null
  }
  stateMap.delete(state)
  return { verifier: entry.verifier, appId: entry.appId }
}

/**
 * Build the full OAuth authorization URL with PKCE parameters.
 */
export function buildAuthUrl(
  authConfig: AuthConfig,
  redirectUri: string,
  codeChallenge: string,
  state: string,
): string {
  const clientId = import.meta.env[authConfig.clientIdEnvVar ?? ''] as string | undefined
  const params = new URLSearchParams({
    client_id: clientId ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: (authConfig.scopes ?? []).join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  })
  return `${authConfig.authUrl}?${params.toString()}`
}

/**
 * Exchange an authorization code for tokens using the PKCE flow.
 */
export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  authConfig: AuthConfig,
  redirectUri: string,
): Promise<OAuthTokens> {
  const clientId = import.meta.env[authConfig.clientIdEnvVar ?? ''] as string | undefined
  const response = await fetch(authConfig.tokenUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${errorBody}`)
  }

  return response.json() as Promise<OAuthTokens>
}

/**
 * Store OAuth tokens in the Supabase user_app_tokens table.
 */
export async function storeToken(
  userId: string,
  appId: string,
  tokens: OAuthTokens,
): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase not configured')

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error } = await supabase.from('user_app_tokens').upsert(
    {
      user_id: userId,
      app_id: appId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
    },
    { onConflict: 'user_id,app_id' },
  )

  if (error) throw new Error(`Failed to store token: ${error.message}`)
}

// --- Internal helpers ---

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
