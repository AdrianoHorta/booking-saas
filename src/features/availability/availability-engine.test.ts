import { describe, expect, it } from 'vitest'
import { calculateDailyAvailability, type AvailabilityInput } from './availability-engine'
import { dayBounds, expandWorkingHours, mergeIntervals } from './expand-working-hours'
import { availabilityFromContext, availabilityRequestSchema } from './api/availability-api'

// Não importa o cliente browser ao testar a conversão pura do contexto.
import { vi } from 'vitest'
vi.mock('../../lib/supabase/client', () => ({ getSupabase: vi.fn() }))

const stamp = (value: string) => Date.parse(value)
const interval = (start: string, end: string) => ({ start: stamp(start), end: stamp(end) })
const monday = [{ weekday: 1, start_minute: 540, end_minute: 720 }]
const base: AvailabilityInput = {
  date: '2026-07-06', timezone: 'Europe/Lisbon', durationMinutes: 30, slotIntervalMinutes: 15,
  now: stamp('2026-07-05T00:00Z'), workingHours: monday, blockedPeriods: [], bookingPeriods: [], externalBusyPeriods: [],
}

describe('expansão semanal', () => {
  it('usa dia ISO e offset sazonal sem modificar os horários', () => {
    const original = structuredClone(monday)
    expect(expandWorkingHours('2026-07-06', 'Europe/Lisbon', monday)).toEqual([interval('2026-07-06T08:00Z', '2026-07-06T11:00Z')])
    expect(expandWorkingHours('2026-01-05', 'Europe/Lisbon', monday)).toEqual([interval('2026-01-05T09:00Z', '2026-01-05T12:00Z')])
    expect(expandWorkingHours('2026-07-07', 'Europe/Lisbon', monday)).toEqual([])
    expect(monday).toEqual(original)
  })
  it('junta períodos consecutivos mas mantém pausas', () => {
    expect(expandWorkingHours(base.date, base.timezone, [...monday,
      { weekday: 1, start_minute: 720, end_minute: 780 }, { weekday: 1, start_minute: 840, end_minute: 1080 },
    ])).toEqual([interval('2026-07-06T08:00Z', '2026-07-06T12:00Z'), interval('2026-07-06T13:00Z', '2026-07-06T17:00Z')])
  })
  it.each([['2026-03-29', 23], ['2026-10-25', 25]] as const)('dia completo %s tem %s horas', (date, length) => {
    const result = expandWorkingHours(date, 'Europe/Lisbon', [{ weekday: 7, start_minute: 0, end_minute: 1440 }])[0]!
    expect((result.end - result.start) / 3600000).toBe(length)
    expect(result).toEqual(dayBounds(date, 'Europe/Lisbon'))
  })
  it.each(['2026-03-29', '2026-10-25'])('rejeita limites ambíguos/inexistentes em %s', (date) => {
    expect(() => expandWorkingHours(date, 'Europe/Lisbon', [{ weekday: 7, start_minute: 90, end_minute: 180 }])).toThrow(/ambígua/)
  })
  it('rejeita data, fuso e períodos inválidos', () => {
    expect(() => expandWorkingHours('2026-02-30', 'Europe/Lisbon', monday)).toThrow()
    expect(() => expandWorkingHours(base.date, 'Mars/Olympus', [])).toThrow()
    expect(() => expandWorkingHours(base.date, base.timezone, [{ weekday: 0, start_minute: 540, end_minute: 720 }])).toThrow()
    expect(() => expandWorkingHours(base.date, base.timezone, [{ weekday: 1, start_minute: 720, end_minute: 540 }])).toThrow()
  })
  it('une intervalos UTC duplicados/sobrepostos e mantém entrada intacta', () => {
    const input = [{ start: 20, end: 30 }, { start: 0, end: 10 }, { start: 5, end: 20 }]
    expect(mergeIntervals(input)).toEqual([{ start: 0, end: 30 }])
    expect(input[0]).toEqual({ start: 20, end: 30 })
  })
})

describe('disponibilidade diária', () => {
  it('combina bloqueios, reservas e períodos externos pelo mesmo contrato', () => {
    const slots = calculateDailyAvailability({ ...base,
      blockedPeriods: [interval('2026-07-06T08:30Z', '2026-07-06T09:00Z')],
      bookingPeriods: [interval('2026-07-06T09:00Z', '2026-07-06T09:30Z')],
      externalBusyPeriods: [interval('2026-07-06T09:30Z', '2026-07-06T10:30Z')],
    })
    expect(slots).toEqual([interval('2026-07-06T08:00Z', '2026-07-06T08:30Z'), interval('2026-07-06T10:30Z', '2026-07-06T11:00Z')])
  })
  it('filtra passado mantendo a grelha e inclui início exatamente agora', () => {
    const slots = calculateDailyAvailability({ ...base, now: stamp('2026-07-06T08:30Z') })
    expect(slots[0]?.start).toBe(stamp('2026-07-06T08:30Z'))
    expect(calculateDailyAvailability({ ...base, now: stamp('2026-07-06T08:31Z') })[0]?.start).toBe(stamp('2026-07-06T08:45Z'))
    expect(calculateDailyAvailability({ ...base, now: stamp('2026-07-07T00:00Z') })).toEqual([])
  })
  it('serviços podem atravessar períodos adjacentes mas não pausas', () => {
    expect(calculateDailyAvailability({ ...base, durationMinutes: 240, workingHours: [...monday,
      { weekday: 1, start_minute: 720, end_minute: 780 },
    ] })).toHaveLength(1)
    expect(calculateDailyAvailability({ ...base, durationMinutes: 240, workingHours: [...monday,
      { weekday: 1, start_minute: 780, end_minute: 840 },
    ] })).toEqual([])
  })
  it('permite terminar no dia seguinte e desconta bloqueios após meia-noite', () => {
    const night = { ...base, durationMinutes: 120, slotIntervalMinutes: 60, workingHours: [
      { weekday: 1, start_minute: 1320, end_minute: 1440 }, { weekday: 2, start_minute: 0, end_minute: 120 },
    ] }
    expect(calculateDailyAvailability(night)).toEqual([
      interval('2026-07-06T21:00Z', '2026-07-06T23:00Z'), interval('2026-07-06T22:00Z', '2026-07-07T00:00Z'),
    ])
    expect(calculateDailyAvailability({ ...night, blockedPeriods: [interval('2026-07-06T23:30Z', '2026-07-07T00:00Z')] })).toEqual([
      interval('2026-07-06T21:00Z', '2026-07-06T23:00Z'),
    ])
  })
  it('não prolonga turno quando o dia seguinte tem intervalo fechado', () => {
    expect(calculateDailyAvailability({ ...base, durationMinutes: 180, workingHours: [
      { weekday: 1, start_minute: 1320, end_minute: 1440 }, { weekday: 2, start_minute: 60, end_minute: 240 },
    ] })).toEqual([])
  })
  it('horário inválido noutro dia sem ligação não bloqueia o dia pedido', () => {
    expect(calculateDailyAvailability({ ...base, date: '2026-03-28', now: stamp('2026-03-27T00:00Z'), workingHours: [
      { weekday: 6, start_minute: 540, end_minute: 720 }, { weekday: 7, start_minute: 90, end_minute: 180 },
    ] })).toHaveLength(11)
  })
  it('mantém instantes distintos nas duas ocorrências da hora repetida', () => {
    const slots = calculateDailyAvailability({ ...base, date: '2026-10-25', now: stamp('2026-10-24T00:00Z'), durationMinutes: 60, slotIntervalMinutes: 60,
      workingHours: [{ weekday: 7, start_minute: 0, end_minute: 240 }],
    })
    expect(slots).toHaveLength(5)
    expect(new Set(slots.map((slot) => slot.start)).size).toBe(5)
  })
  it('sem horário ou duração superior ao turno devolve vazio', () => {
    expect(calculateDailyAvailability({ ...base, workingHours: [] })).toEqual([])
    expect(calculateDailyAvailability({ ...base, durationMinutes: 181 })).toEqual([])
  })
  it('rejeita parâmetros inválidos em vez de produzir vagas incorretas', () => {
    for (const change of [{ durationMinutes: 0 }, { durationMinutes: 44641 }, { slotIntervalMinutes: 0 }, { slotIntervalMinutes: 7 }, { now: NaN }]) {
      expect(() => calculateDailyAvailability({ ...base, ...change })).toThrow()
    }
  })
})

const context = { server_now: '2026-07-05T00:00:00Z', timezone: base.timezone, duration_minutes: 30, slot_interval_minutes: 15,
  business_active: true, employee_active: true, service_active: true, assigned: true, working_hours: monday, blocked_periods: [], booking_periods: [] }
it.each(['business_active', 'employee_active', 'service_active', 'assigned'] as const)('contexto %s=false nunca produz vagas', (field) => {
  const result = availabilityFromContext(base.date, { ...context, [field]: false })
  expect(result.slots).toEqual([])
  expect(result.reason).not.toBeNull()
})
it('rejeita resposta incompleta da API em vez de tratar falha como agenda livre', () => {
  expect(() => availabilityFromContext(base.date, { ...context, blocked_periods: undefined })).toThrow()
  expect(() => availabilityFromContext(base.date, { ...context, booking_periods: undefined })).toThrow()
})
it('reservas reais do contexto retiram vagas mesmo quando os detalhes do cliente não são visíveis', () => {
  const result = availabilityFromContext(base.date, { ...context, booking_periods: [{ starts_at: '2026-07-06T08:00:00Z', ends_at: '2026-07-06T10:30:00Z' }] })
  expect(result.slots).toEqual([interval('2026-07-06T10:30Z', '2026-07-06T11:00Z')])
})
it('usa hora do servidor e valida a seleção', () => {
  expect(availabilityFromContext(base.date, { ...context, server_now: '2026-07-06T10:30:00Z' }).slots).toEqual([
    interval('2026-07-06T10:30Z', '2026-07-06T11:00Z'),
  ])
  expect(availabilityRequestSchema.safeParse({ businessId: 'bad', employeeId: 'bad', serviceId: 'bad', date: '2026-02-30' }).success).toBe(false)
})
