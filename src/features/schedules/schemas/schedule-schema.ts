import { z } from 'zod'
import { localToInstant, timeMinutes } from '../schedule-time'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:mm.')
export const weekSchema = z.object({
  periods: z.array(z.object({
    weekday: z.number().int().min(1).max(7),
    start: time,
    end: z.union([time, z.literal('24:00')]),
  })),
}).superRefine(({ periods }, context) => {
  periods.forEach((period, index) => {
    const start = timeMinutes(period.start)
    const end = timeMinutes(period.end)
    if (end <= start) context.addIssue({ code: 'custom', path: ['periods', index, 'end'], message: 'O fim deve ser posterior ao início. Divida turnos noturnos entre dois dias.' })
    if (periods.some((other, otherIndex) => otherIndex < index && other.weekday === period.weekday && start < timeMinutes(other.end) && end > timeMinutes(other.start))) {
      context.addIssue({ code: 'custom', path: ['periods', index, 'start'], message: 'Este período sobrepõe-se a outro do mesmo dia.' })
    }
  })
})
export type WeekValues = z.infer<typeof weekSchema>

export function blockSchema(timezone: string) {
  return z.object({
    label: z.string().trim().min(1, 'A descrição é obrigatória.').max(200, 'Use até 200 caracteres.'),
    start: z.string().min(1, 'Indique o início.'),
    end: z.string().min(1, 'Indique o fim.'),
  }).superRefine((values, context) => {
    const instants: Partial<Record<'start' | 'end', string>> = {}
    for (const field of ['start', 'end'] as const) {
      try { instants[field] = localToInstant(values[field], timezone) }
      catch (error) { context.addIssue({ code: 'custom', path: [field], message: (error as Error).message }) }
    }
    if (instants.start && instants.end && Date.parse(instants.end) <= Date.parse(instants.start)) {
      context.addIssue({ code: 'custom', path: ['end'], message: 'O fim deve ser posterior ao início.' })
    }
  })
}
export type BlockValues = z.infer<ReturnType<typeof blockSchema>>
