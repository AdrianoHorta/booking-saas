import { expect, it } from 'vitest'
import { hash, randomState, seal, unseal } from './crypto'
const key = btoa('a'.repeat(32))
it('encrypts credentials with randomized authenticated encryption', async () => {
  const value = { refreshToken: 'secret-token', account: 'account-1' }
  const first = await seal(value, key)
  expect(first).not.toContain('secret-token')
  expect(first).not.toBe(await seal(value, key))
  expect(await unseal(first, key)).toEqual(value)
  await expect(unseal(first, btoa('b'.repeat(32)))).rejects.toThrow()
  const changed = atob(first).split(''); changed[15] = String.fromCharCode(changed[15].charCodeAt(0) ^ 1)
  await expect(unseal(btoa(changed.join('')), key)).rejects.toThrow()
})
it('uses random states and stable hashes without storing the original value', async () => {
  const state = randomState()
  expect(state).toMatch(/^[a-f0-9]{64}$/)
  expect(state).not.toBe(randomState())
  expect(await hash(state)).not.toBe(state)
  expect(await hash(state)).toBe(await hash(state))
})
