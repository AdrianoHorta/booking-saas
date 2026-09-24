import { createClient } from '@supabase/supabase-js'
import { supabaseEnv } from '../env'
import type { Database } from './database.types'

// Capturado antes de o SDK consumir e limpar o fragmento do link de autenticação.
const initialUrl = new URL(window.location.href)
export const hasAuthLinkError = new URLSearchParams(initialUrl.hash.slice(1)).has('error') ||
  initialUrl.searchParams.has('error') ||
  new URLSearchParams(initialUrl.hash.slice(1)).has('error_code')

export const supabase = supabaseEnv
  ? createClient<Database>(supabaseEnv.url, supabaseEnv.key, {
      auth: {
        flowType: 'implicit',
        persistSession: true,
        autoRefreshToken: true,
        // Calendar authorization codes belong to Google, not Supabase Auth.
        detectSessionInUrl: initialUrl.pathname !== '/calendar/callback',
      },
    })
  : null

export function getSupabase() {
  if (!supabase) throw new Error('Auth configuration unavailable')
  return supabase
}
