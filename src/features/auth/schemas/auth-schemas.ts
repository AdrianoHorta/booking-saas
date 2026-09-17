import { z } from 'zod'

const email = z.string().trim().email('Introduza um email válido.').max(254, 'O email é demasiado longo.')
const newPassword = z.string().min(8, 'Use pelo menos 8 caracteres.').max(128, 'Use no máximo 128 caracteres.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Introduza a sua password.'),
})
export const emailSchema = z.object({ email })
export const passwordSchema = z.object({
  password: newPassword,
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'As passwords não coincidem.',
  path: ['confirmPassword'],
})
export const registerSchema = z.object({
  email,
  password: newPassword,
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'As passwords não coincidem.',
  path: ['confirmPassword'],
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type EmailValues = z.infer<typeof emailSchema>
export type PasswordValues = z.infer<typeof passwordSchema>
