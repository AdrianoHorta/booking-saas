import { expect, it } from 'vitest'
import { calculateSlots, type TimeInterval } from './calculate-slots'

const time = (value: string) => Date.parse(`2026-07-01T${value}:00Z`)
const period = (start: string, end: string): TimeInterval => ({ start: time(start), end: time(end) })
const input = { workingPeriod: period('09:00', '10:00'), busyPeriods: [], durationMinutes: 30, slotIntervalMinutes: 15 }

it('gera uma grelha sem ultrapassar o fim do horário', () => {
  expect(calculateSlots(input)).toEqual([
    period('09:00', '09:30'), period('09:15', '09:45'), period('09:30', '10:00'),
  ])
})
it('permite contacto nos limites mas rejeita qualquer sobreposição', () => {
  expect(calculateSlots({ ...input, busyPeriods: [period('09:30', '10:00')] })).toEqual([period('09:00', '09:30')])
  expect(calculateSlots({ ...input, busyPeriods: [period('09:00', '09:30')] })).toEqual([period('09:30', '10:00')])
})
it('mantém a grelha original após um bloqueio desalinhado', () => {
  expect(calculateSlots({ ...input, busyPeriods: [period('09:00', '09:20')] })).toEqual([period('09:30', '10:00')])
})
it('aceita bloqueios sobrepostos, duplicados e fora do horário sem os modificar', () => {
  const busyPeriods = [period('09:10', '09:20'), period('09:00', '09:25'), period('09:10', '09:20'), period('11:00', '12:00')]
  const original = structuredClone(busyPeriods)
  expect(calculateSlots({ ...input, busyPeriods })).toEqual([period('09:30', '10:00')])
  expect(busyPeriods).toEqual(original)
})
it('devolve vazio se tudo estiver ocupado ou o serviço não couber', () => {
  expect(calculateSlots({ ...input, busyPeriods: [period('08:00', '11:00')] })).toEqual([])
  expect(calculateSlots({ ...input, durationMinutes: 61 })).toEqual([])
})
it('distingue duração de serviço e intervalo entre inícios', () => {
  expect(calculateSlots({ ...input, durationMinutes: 20, slotIntervalMinutes: 30 })).toEqual([
    period('09:00', '09:20'), period('09:30', '09:50'),
  ])
})
it.each([0, -1, 1.5, NaN, Infinity])('rejeita duração ou passo inválidos: %s', (value) => {
  expect(() => calculateSlots({ ...input, durationMinutes: value })).toThrow(RangeError)
  expect(() => calculateSlots({ ...input, slotIntervalMinutes: value })).toThrow(RangeError)
})
it('rejeita intervalos inválidos sem ocultar erros nos dados', () => {
  expect(() => calculateSlots({ ...input, workingPeriod: period('10:00', '09:00') })).toThrow(RangeError)
  expect(() => calculateSlots({ ...input, busyPeriods: [{ start: NaN, end: time('10:00') }] })).toThrow(RangeError)
  expect(() => calculateSlots({ ...input, busyPeriods: [period('09:00', '09:00')] })).toThrow(RangeError)
})
