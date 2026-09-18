import { expect, it } from 'vitest'
import { employeeSchema } from './employee-schema'

const valid = { name: ' Ana ', userId: '', serviceIds: [] }
it('permite profissional sem login ou serviços e normaliza o nome', () => {
  expect(employeeSchema.parse(valid)).toEqual({ ...valid, name: 'Ana' })
})
it.each([{ name: ' ' }, { name: 'a'.repeat(101) }, { userId: 'invalid' }, { serviceIds: ['invalid'] },
  { serviceIds: ['61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001'] },
])('rejeita dados inválidos %j', (input) => {
  expect(employeeSchema.safeParse({ ...valid, ...input }).success).toBe(false)
})
