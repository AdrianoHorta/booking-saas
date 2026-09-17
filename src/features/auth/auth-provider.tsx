import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(
    supabase ? null : 'O acesso à conta está temporariamente indisponível.',
  )

  useEffect(() => {
    if (!supabase) return
    let active = true
    let eventReceived = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      eventReceived = true
      setSession(nextSession)
      setIsLoading(false)
      setError(null)
    })

    // A subscrição é criada primeiro; uma resposta inicial tardia não substitui um evento novo.
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || eventReceived) return
      setSession(data.session)
      setError(sessionError ? 'Não foi possível recuperar a sessão. Tente recarregar a página.' : null)
      setIsLoading(false)
    }).catch(() => {
      if (!active || eventReceived) return
      setError('Não foi possível recuperar a sessão. Verifique a ligação e recarregue a página.')
      setIsLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ session, isLoading, error }}>{children}</AuthContext.Provider>
}
