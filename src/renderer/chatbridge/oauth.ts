import type { AuthConfig } from './registry'

/**
 * Retrieve a valid access token for the given app, refreshing if expired.
 * Returns the access_token string, or null if no token exists / refresh failed.
 *
 * Stub — PR 2.2 provides the real Supabase-backed implementation.
 */
export async function getOrRefreshToken(
  _appId: string,
  _authConfig: AuthConfig,
): Promise<string | null> {
  // Stub: always returns null (no token available)
  return null
}
