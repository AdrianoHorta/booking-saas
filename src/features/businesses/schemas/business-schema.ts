import { z } from 'zod'

export const timezoneOptions = [
  { value: 'Europe/Lisbon', label: 'Portugal continental — Lisboa' },
  { value: 'Atlantic/Madeira', label: 'Portugal — Madeira' },
  { value: 'Atlantic/Azores', label: 'Portugal — Açores' },
  { value: 'Europe/Madrid', label: 'Espanha — Madrid' },
  { value: 'America/Sao_Paulo', label: 'Brasil — São Paulo' },
  { value: 'UTC', label: 'UTC' },
] as const

export const businessSchema = z.object({
  name: z.string().trim().min(2, 'Use pelo menos 2 caracteres.').max(120, 'Use no máximo 120 caracteres.'),
  slug: z.string().trim().toLowerCase().min(3, 'Use pelo menos 3 caracteres.').max(63, 'Use no máximo 63 caracteres.')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use letras sem acentos, números e hífen entre palavras.'),
  timezone: z.enum(timezoneOptions.map((option) => option.value)),
})

export type BusinessFormValues = z.infer<typeof businessSchema>
export const businessIdSchema = z.uuid()

export function suggestBusinessSlug(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63).replace(/-$/, '')
}
