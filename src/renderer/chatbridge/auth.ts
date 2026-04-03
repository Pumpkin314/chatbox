import { atom } from 'jotai'
import type { User, Session } from '@supabase/supabase-js'

/**
 * Auth atoms for ChatBridge.
 * These hold the current Supabase user and session.
 * When null, the user is not authenticated and we fall back to local storage.
 */
export const userAtom = atom<User | null>(null)
export const sessionAtom = atom<Session | null>(null)
