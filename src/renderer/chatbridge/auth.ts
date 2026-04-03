import type { AuthError, Session, User } from '@supabase/supabase-js'
import { atom } from 'jotai'
import type { createStore } from 'jotai'
import { supabase } from '@/chatbridge/supabase'

// --- Jotai atoms ---
export const userAtom = atom<User | null>(null)
export const sessionAtom = atom<Session | null>(null)
export const authLoadingAtom = atom<boolean>(true)

type AuthResult = { error: AuthError | { message: string } | null }

/**
 * Initialize auth state listener. Call once at app startup.
 * Sets up onAuthStateChange to keep atoms in sync with Supabase session.
 */
export function initAuth(store: ReturnType<typeof createStore>): (() => void) | undefined {
  if (!supabase) {
    store.set(authLoadingAtom, false)
    return undefined
  }

  // Check existing session
  supabase.auth.getSession().then(({ data: { session } }) => {
    store.set(sessionAtom, session)
    store.set(userAtom, session?.user ?? null)
    store.set(authLoadingAtom, false)
  })

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    store.set(sessionAtom, session)
    store.set(userAtom, session?.user ?? null)
    store.set(authLoadingAtom, false)
  })

  return () => subscription.unsubscribe()
}

/**
 * Sign in with email and password.
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) {
    return { error: { message: 'Supabase is not configured' } }
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error }
}

/**
 * Sign up with email and password.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!supabase) {
    return { error: { message: 'Supabase is not configured' } }
  }
  const { error } = await supabase.auth.signUp({ email, password })
  return { error }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<AuthResult> {
  if (!supabase) {
    return { error: { message: 'Supabase is not configured' } }
  }
  const { error } = await supabase.auth.signOut()
  return { error }
}
