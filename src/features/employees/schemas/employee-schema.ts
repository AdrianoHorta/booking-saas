import { z } from 'zod'

export const employeeSchema = z.object({
  name: z.string().trim().min(1, 'O nome é obrigatório.').max(100, 'O nome é demasiado longo.'),
  userId: z.union([z.literal(''), z.uuid('Selecione uma conta válida.')]),
  serviceIds: z.array(z.uuid()).refine((ids) => new Set(ids).size === ids.length, 'Selecione cada serviço apenas uma vez.'),
})
export type EmployeeFormValues = z.infer<typeof employeeSchema>
