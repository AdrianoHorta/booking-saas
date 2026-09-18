import { Temporal } from '@js-temporal/polyfill'
import type { TimeInterval } from './calculate-slots'

export type WeeklyPeriod = { weekday: number; start_minute: number; end_minute: number }

export function parseLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Indique uma data válida.')
  return Temporal.PlainDate.from(value, { overflow: 'reject' })
}

/** Une intervalos adjacentes/sobrepostos sem modificar os dados recebidos. */
export function mergeIntervals(intervals: readonly TimeInterval[]): TimeInterval[] {
  const merged: TimeInterval[] = []
  for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
    if (!Number.isSafeInteger(interval.start) || !Number.isSafeInteger(interval.end) || interval.end <= interval.start) {
      throw new RangeError('Intervalo temporal inválido.')
    }
    const last = merged.at(-1)
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
    else merged.push({ ...interval })
  }
  return merged
}

export function dayBounds(date: string, timezone: string): TimeInterval {
  const day = parseLocalDate(date)
  return {
    start: day.toZonedDateTime(timezone).epochMilliseconds,
    end: day.add({ days: 1 }).toZonedDateTime(timezone).epochMilliseconds,
  }
}

/** Um dia local; 1440 significa a meia-noite local seguinte, nunca +24h UTC. */
export function expandWorkingHours(date: string, timezone: string, periods: readonly WeeklyPeriod[]): TimeInterval[] {
  const day = parseLocalDate(date)
  dayBounds(date, timezone) // Valida o fuso também num dia sem horário.
  for (const period of periods) {
    if (![period.weekday, period.start_minute, period.end_minute].every(Number.isInteger) ||
        period.weekday < 1 || period.weekday > 7 || period.start_minute < 0 ||
        period.end_minute > 1440 || period.end_minute <= period.start_minute) {
      throw new RangeError('Horário semanal inválido.')
    }
  }
  // Une em hora local antes da conversão: uma fronteira interna não é um limite do turno.
  const local = mergeIntervals(periods.filter((p) => p.weekday === day.dayOfWeek)
    .map((p) => ({ start: p.start_minute, end: p.end_minute })))
  const instant = (minute: number) => day.toPlainDateTime({ hour: 0 }).add({ minutes: minute })
    .toZonedDateTime(timezone, { disambiguation: 'reject' }).epochMilliseconds
  return local.map((period) => {
    try { return { start: instant(period.start), end: instant(period.end) } }
    catch { throw new RangeError('O horário contém uma hora inexistente ou ambígua nesta data. Ajuste o horário antes de consultar vagas.') }
  })
}
