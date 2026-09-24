import { expect, it } from 'vitest'
import { canCancel, cancel, dates, move, reserve, restore, seed, slots } from './demo-model'

const now = Date.parse('2026-10-24T10:00:00Z')
it('offers local business hours after a daylight-saving transition without overlaps', () => {
  const state = seed(now)
  const date = dates(now)[0]
  expect(date).toBe('2026-10-25')
  const free = slots(state, 'miguel', 'corte', date, undefined, now)
  expect(new Date(free[0]).toISOString()).toBe('2026-10-25T10:30:00.000Z')
  expect(free).not.toContain(state.bookings[0].start)
  const longer = slots(state, 'miguel', 'corte-barba', date, undefined, now)
  expect(new Date(longer.at(-1)!).toISOString()).toBe('2026-10-25T17:00:00.000Z')
})
it('creates a snapshot and refuses a second overlapping booking', () => {
  const state = seed(now)
  const input = { professional: 'miguel' as const, service: 'corte-barba' as const, date: dates(now)[0], start: slots(state, 'miguel', 'corte-barba', dates(now)[0], undefined, now)[0], client: 'Exemplo' }
  const next = reserve(state, input, now)
  expect(next.bookings.at(-1)).toMatchObject({ cents: 2500, minutes: 60 })
  expect(() => reserve(next, input, now)).toThrow('horário disponível')
  expect(state.bookings).toHaveLength(2)
})
it('allows cancellation at the exact deadline and frees the slot', () => {
  const state = seed(now)
  const booking = state.bookings[0]
  const deadline = booking.start - 12 * 3600_000
  expect(canCancel(booking, deadline)).toBe(true)
  expect(canCancel(booking, deadline + 1)).toBe(false)
  expect(() => cancel(state, booking.id, deadline + 1)).toThrow('prazo')
  const next = cancel(state, booking.id, now)
  expect(slots(next, 'miguel', 'corte', dates(now)[0], undefined, now)).toContain(booking.start)
})
it('reschedules atomically while preserving identity, service and price', () => {
  const state = seed(now)
  const booking = state.bookings[0]
  const target = slots(state, 'miguel', 'corte', dates(now)[1], undefined, now)[0]
  const next = move(state, booking.id, dates(now)[1], target, now)
  expect(next.bookings[0]).toEqual({ ...booking, start: target })
  expect(() => move(state, booking.id, 'invalid', target, now)).toThrow()
  expect(state.bookings[0]).toEqual(booking)
})
it('recovers malformed storage and resets examples after the day changes', () => {
  const state = seed(now)
  expect(restore('invalid', now)).toEqual(state)
  expect(restore(JSON.stringify(state), now)).toEqual(state)
  const tomorrow = now + 86400_000
  expect(restore(JSON.stringify(state), tomorrow)).toEqual(seed(tomorrow))
})
