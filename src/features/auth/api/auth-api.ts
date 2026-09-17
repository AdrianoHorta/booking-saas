import { getSupabase } from '../../../lib/supabase/client'

export async function signIn(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({
    email, password,
    options: { emailRedirectTo: new URL('/auth/callback', window.location.origin).href },
  })
  if (error) throw error
  return data.session
}

export async function requestPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: new URL('/reset-password', window.location.origin).href,
  })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut({ scope: 'local' })
  if (error) throw error
}
