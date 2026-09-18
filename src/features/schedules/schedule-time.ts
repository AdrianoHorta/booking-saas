import { Temporal } from '@js-temporal/polyfill'

export const weekdays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

export function minuteLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function timeMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function localToInstant(value: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Indique uma data e hora válidas.')
  try {
    const local = Temporal.PlainDateTime.from(value, { overflow: 'reject' })
    return local.toZonedDateTime(timezone, { disambiguation: 'reject' }).toInstant().toString()
  } catch {
    throw new Error('Data/hora inválida, inexistente ou ambígua neste fuso horário. Escolha outra hora.')
  }
}

export function instantToLocal(value: string, timezone: string) {
  return Temporal.Instant.from(value).toZonedDateTimeISO(timezone).toPlainDateTime().toString({ smallestUnit: 'minute' })
}

export function formatInstant(value: string, timezone: string) {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
