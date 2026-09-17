import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

type AuthState = {
  session: Session | null
  isLoading: boolean
  error: string | null
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth exige um AuthProvider.')
  return context
}
