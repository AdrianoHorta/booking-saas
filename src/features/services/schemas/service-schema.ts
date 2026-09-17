import { z } from 'zod'

export const serviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'O nome é obrigatório.')
    .max(100, 'O nome é demasiado longo.'),

  description: z
    .string()
    .trim()
    .max(500, 'A descrição é demasiado longa.')
    .optional(),

  durationMinutes: z
    .number()
    .int('A duração tem de ser um número inteiro.')
    .positive('A duração tem de ser superior a 0.')
    .max(2147483647, 'A duração é demasiado longa.'),

  price: z
    .number()
    .nonnegative('O preço não pode ser negativo.')
    .max(21474836.47, 'O preço é demasiado elevado.'),
})

export type ServiceFormValues = z.infer<typeof serviceSchema>
