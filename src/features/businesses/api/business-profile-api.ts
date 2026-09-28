import { z } from 'zod'
import { getSupabase } from '../../../lib/supabase/client'
import { businessIdSchema } from '../schemas/business-schema'

export const businessDetailsSchema = z.object({
  name: z.string().trim().min(2, 'Use pelo menos 2 caracteres.').max(120),
  description: z.string().trim().max(2000), phone: z.string().trim().max(40), address: z.string().trim().max(500),
  email: z.string().trim().max(254).refine((value) => !value || z.email().safeParse(value).success, 'Indique um email válido.'),
})
export type BusinessDetails = z.infer<typeof businessDetailsSchema>
export async function saveBusinessDetails(businessId: string, input: BusinessDetails) {
  const values = businessDetailsSchema.parse(input)
  const { error } = await getSupabase().rpc('save_business_details', { target_business_id: businessIdSchema.parse(businessId),
    business_name: values.name, business_description: values.description, business_email: values.email, business_phone: values.phone, business_address: values.address })
  if (error?.code === '42501') throw new Error('Apenas o proprietário pode alterar estes dados.')
  if (error) throw new Error('Não foi possível guardar os dados da empresa. Tente novamente.')
}
export async function setBusinessLogo(businessId: string, path: string | null) {
  const { error } = await getSupabase().rpc('set_business_logo', { target_business_id: businessIdSchema.parse(businessId), image_path: path })
  if (error) throw new Error('Não foi possível guardar o logótipo. Atualize a empresa para verificar o resultado antes de tentar novamente.')
}
