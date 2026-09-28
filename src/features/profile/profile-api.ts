import { z } from 'zod'
import { getSupabase } from '../../lib/supabase/client'

export const profileSchema = z.object({ full_name: z.string(), avatar_path: z.string().nullable() })
export type Profile = z.infer<typeof profileSchema>
export const profileNameSchema = z.object({ name: z.string().trim().min(1, 'Indique o seu nome.').max(120, 'Use até 120 caracteres.') })
export async function getMyProfile(signal?: AbortSignal) {
  const query = getSupabase().rpc('get_my_profile')
  const { data, error } = await (signal ? query.abortSignal(signal) : query)
  if (error) throw new Error('Não foi possível carregar o perfil. Tente novamente.')
  return profileSchema.parse(data)
}
export async function saveMyProfile(name: string) {
  const { data, error } = await getSupabase().rpc('save_my_profile', { profile_name: profileNameSchema.parse({ name }).name })
  if (error) throw new Error('Não foi possível guardar o nome. Tente novamente.')
  return profileSchema.parse(data)
}
export async function setMyAvatar(path: string | null) {
  const { data, error } = await getSupabase().rpc('set_my_avatar', { image_path: path })
  if (error) throw new Error('Não foi possível guardar a fotografia. Atualize o perfil para verificar o resultado antes de tentar novamente.')
  return profileSchema.parse(data)
}
export async function changeEmail(email: string) {
  const { data, error } = await getSupabase().auth.updateUser({ email }, { emailRedirectTo: new URL('/auth/callback', window.location.origin).href })
  if (error) throw error
  return data.user
}
export async function changePassword(password: string, currentPassword: string, nonce?: string) {
  const { error } = await getSupabase().auth.updateUser({ password, current_password: currentPassword, ...(nonce ? { nonce } : {}) })
  if (error) throw error
}
export async function sendPasswordCode() {
  const { error } = await getSupabase().auth.reauthenticate()
  if (error) throw error
}
