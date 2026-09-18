import { calculateSlots, type TimeInterval } from './calculate-slots'
import { dayBounds, expandWorkingHours, mergeIntervals, parseLocalDate, type WeeklyPeriod } from './expand-working-hours'

export type AvailabilityInput = {
  date: string
  timezone: string
  durationMinutes: number
  slotIntervalMinutes: number
  now: number
  workingHours: readonly WeeklyPeriod[]
  blockedPeriods: readonly TimeInterval[]
  /** Fontes futuras recebem instantes; falhas de leitura não devem virar uma lista vazia. */
  bookingPeriods: readonly TimeInterval[]
  externalBusyPeriods: readonly TimeInterval[]
}

export function calculateDailyAvailability(input: AvailabilityInput): TimeInterval[] {
  const { durationMinutes, slotIntervalMinutes, now } = input
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 31 * 1440) {
    throw new RangeError('A consulta suporta serviços com duração entre 1 minuto e 31 dias.')
  }
  if (!Number.isInteger(slotIntervalMinutes) || slotIntervalMinutes < 5 || slotIntervalMinutes > 120 || slotIntervalMinutes % 5 !== 0) {
    throw new RangeError('Intervalo de marcação inválido.')
  }
  if (!Number.isSafeInteger(now)) throw new RangeError('Hora de referência inválida.')
  const date = parseLocalDate(input.date)
  const bounds = dayBounds(input.date, input.timezone)
  if (bounds.end <= now) return []
  const working = expandWorkingHours(input.date, input.timezone, input.workingHours)
  // Só prolonga o turno que realmente continua após a meia-noite.
  // Não deixa um horário inválido num dia futuro sem ligação bloquear a consulta de hoje.
  let previousEnd = bounds.end
  for (let offset = 1; offset <= Math.ceil(durationMinutes / 1440) + 1; offset++) {
    if (working.at(-1)?.end !== previousEnd) break
    const next = date.add({ days: offset })
    const local = mergeIntervals(input.workingHours.filter((p) => p.weekday === next.dayOfWeek)
      .map((p) => ({ start: p.start_minute, end: p.end_minute })))
    const first = local[0]
    if (!first || first.start !== 0) break
    working.push(...expandWorkingHours(next.toString(), input.timezone, [{ weekday: next.dayOfWeek, start_minute: first.start, end_minute: first.end }]))
    previousEnd = dayBounds(next.toString(), input.timezone).end
    if (working.at(-1)!.end >= bounds.end + durationMinutes * 60_000) break
  }
  const busy = mergeIntervals([...input.blockedPeriods, ...input.bookingPeriods, ...input.externalBusyPeriods])
  return mergeIntervals(working).filter((period) => period.start < bounds.end && period.end > bounds.start)
    .flatMap((period) => {
      // Limita candidatos ao dia pedido, mantendo margem de duração após meia-noite.
      const end = Math.min(period.end, bounds.end + durationMinutes * 60_000)
      return calculateSlots({ workingPeriod: { start: period.start, end }, busyPeriods: busy, durationMinutes, slotIntervalMinutes })
    }).filter((slot) => slot.start >= Math.max(now, bounds.start) && slot.start < bounds.end)
}
