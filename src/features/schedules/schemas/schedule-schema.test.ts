import { expect, it } from 'vitest'
import { blockSchema, weekSchema } from './schedule-schema'
import { instantToLocal, localToInstant, minuteLabel } from '../schedule-time'

it('aceita semana vazia, pausas, períodos adjacentes e meia-noite', () => {
  expect(weekSchema.safeParse({ periods: [] }).success).toBe(true)
  expect(weekSchema.safeParse({ periods: [
    { weekday: 1, start: '09:00', end: '12:00' }, { weekday: 1, start: '12:00', end: '13:00' },
    { weekday: 1, start: '14:00', end: '18:00' }, { weekday: 7, start: '22:00', end: '24:00' },
    { weekday: 1, start: '00:00', end: '02:00' },
  ] }).success).toBe(true)
  expect(minuteLabel(1440)).toBe('24:00')
})
it.each([
  { weekday: 0, start: '09:00', end: '12:00' }, { weekday: 8, start: '09:00', end: '12:00' },
  { weekday: 1, start: '24:00', end: '24:00' }, { weekday: 1, start: '09:60', end: '12:00' },
  { weekday: 1, start: '22:00', end: '02:00' }, { weekday: 1, start: '09:00', end: '09:00' },
])('rejeita período inválido %j', (period) => {
  expect(weekSchema.safeParse({ periods: [period] }).success).toBe(false)
})
it('rejeita sobreposição e duplicados sem confundir dias distintos', () => {
  const first = { weekday: 1, start: '09:00', end: '12:00' }
  expect(weekSchema.safeParse({ periods: [first, { ...first, start: '11:00' }] }).success).toBe(false)
  expect(weekSchema.safeParse({ periods: [first, first] }).success).toBe(false)
  expect(weekSchema.safeParse({ periods: [first, { ...first, weekday: 2 }] }).success).toBe(true)
})
it('converte hora de Lisboa com offset sazonal explícito, independente do browser', () => {
  expect(localToInstant('2026-07-01T09:00', 'Europe/Lisbon')).toBe('2026-07-01T08:00:00Z')
  expect(localToInstant('2026-12-01T09:00', 'Europe/Lisbon')).toBe('2026-12-01T09:00:00Z')
  expect(instantToLocal('2026-07-01T08:00:00Z', 'Europe/Lisbon')).toBe('2026-07-01T09:00')
  expect(localToInstant('2026-07-01T09:00', 'Asia/Kathmandu')).toBe('2026-07-01T03:15:00Z')
})
it.each(['2026-03-29T01:30', '2026-10-25T01:30', '2026-02-30T12:00', 'invalid'])(
  'rejeita datas inexistentes ou ambíguas %s', (date) => {
    expect(() => localToInstant(date, 'Europe/Lisbon')).toThrow()
  },
)
it('dia inteiro na mudança de hora tem 23 ou 25 horas reais', () => {
  const elapsed = (start: string, end: string) => (Date.parse(localToInstant(end, 'Europe/Lisbon')) - Date.parse(localToInstant(start, 'Europe/Lisbon'))) / 3600000
  expect(elapsed('2026-03-29T00:00', '2026-03-30T00:00')).toBe(23)
  expect(elapsed('2026-10-25T00:00', '2026-10-26T00:00')).toBe(25)
})
it('valida descrição e ordem temporal dos bloqueios', () => {
  const schema = blockSchema('Europe/Lisbon')
  const valid = { label: ' Férias ', start: '2026-07-01T00:00', end: '2026-07-10T00:00' }
  expect(schema.parse(valid).label).toBe('Férias')
  expect(schema.safeParse({ ...valid, end: valid.start }).success).toBe(false)
  expect(schema.safeParse({ ...valid, end: '2026-06-01T00:00' }).success).toBe(false)
  expect(schema.safeParse({ ...valid, label: ' ' }).success).toBe(false)
})
