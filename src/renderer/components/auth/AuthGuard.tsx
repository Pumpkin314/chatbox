import { Flex, Loader } from '@mantine/core'
import { useAtomValue } from 'jotai'
import type { ReactNode } from 'react'
import { authLoadingAtom, userAtom } from '@/chatbridge/auth'
import { supabase } from '@/chatbridge/supabase'
import LoginPage from './LoginPage'

interface AuthGuardProps {
  children: ReactNode
}

/**
 * Route guard that checks authentication state before rendering main app.
 *
 * - If Supabase is not configured (no env vars): skip auth, show children (L3 graceful degradation)
 * - If loading: show spinner
 * - If not authenticated: show LoginPage
 * - If authenticated: show children
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const user = useAtomValue(userAtom)
  const authLoading = useAtomValue(authLoadingAtom)

  // L3 graceful degradation: if Supabase is not configured, skip auth entirely
  if (!supabase) {
    return <>{children}</>
  }

  // Show loading spinner while auth state is being determined
  if (authLoading) {
    return (
      <Flex align="center" justify="center" className="h-full w-full">
        <Loader size="lg" />
      </Flex>
    )
  }

  // Not authenticated: show login page
  if (!user) {
    return <LoginPage />
  }

  // Authenticated: show the app
  return <>{children}</>
}
