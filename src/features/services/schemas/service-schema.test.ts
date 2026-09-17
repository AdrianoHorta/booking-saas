import { describe, expect, it } from 'vitest'
import { serviceSchema } from './service-schema'

const valid = { name: ' Corte ', description: ' Teste ', durationMinutes: 30, price: 12.34 }
describe('serviceSchema', () => {
  it('normaliza texto e aceita serviços gratuitos', () => {
    expect(serviceSchema.parse({ ...valid, price: 0 })).toEqual({ ...valid, name: 'Corte', description: 'Teste', price: 0 })
  })
  it.each([
    { name: '   ' }, { name: 'a'.repeat(101) }, { description: 'a'.repeat(501) },
    { durationMinutes: 0 }, { durationMinutes: -1 }, { durationMinutes: 1.5 },
    { durationMinutes: NaN }, { durationMinutes: 2147483648 },
    { price: -1 }, { price: NaN }, { price: Infinity }, { price: 21474836.48 },
  ])('rejeita valores inválidos %j', (input) => {
    expect(serviceSchema.safeParse({ ...valid, ...input }).success).toBe(false)
  })
})
