import { z } from 'zod'
import { getSupabase } from '../../../lib/supabase/client'

export const memberInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Indique um email válido.').max(254)),
  role: z.enum(['employee', 'admin']),
})
export type MemberInput = z.infer<typeof memberInputSchema>
const memberSchema = z.object({ user_id: z.uuid(), email: z.string().nullable(), role: z.enum(['owner', 'admin', 'employee']) })
function memberError(error: { code?: string }) {
  if (error.code === 'P0002') return new Error('Esta conta ainda não existe. Peça à pessoa para se registar primeiro.')
  if (error.code === '42501') return new Error('Não tem permissão para alterar este membro. Atualize a página para verificar o seu acesso.')
  return new Error('Não foi possível concluir a operação. Atualize a lista e tente novamente.')
}
export async function listBusinessMembers(businessId: string, signal?: AbortSignal) {
  let query = getSupabase().rpc('list_business_members', { target_business_id: z.uuid().parse(businessId) })
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw memberError(error)
  return z.array(memberSchema).parse(data)
}
export async function saveBusinessMember(businessId: string, values: MemberInput) {
  const input = memberInputSchema.parse(values)
  const { error } = await getSupabase().rpc('save_business_member', { target_business_id: z.uuid().parse(businessId), member_email: input.email, member_role: input.role })
  if (error) throw memberError(error)
}
export async function removeBusinessMember(businessId: string, userId: string) {
  const { error } = await getSupabase().rpc('remove_business_member', { target_business_id: z.uuid().parse(businessId), target_user_id: z.uuid().parse(userId) })
  if (error) throw memberError(error)
}
