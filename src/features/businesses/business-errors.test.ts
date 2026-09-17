import { expect, it } from 'vitest'
import { getBusinessErrorMessage } from './business-errors'

it('explica a colisão de slug sem expor detalhes SQL', () => {
  expect(getBusinessErrorMessage({ code: '23505', details: 'private database detail' })).toContain('identificador já está em uso')
})
it('não apresenta mensagens arbitrárias do servidor', () => {
  expect(getBusinessErrorMessage(new Error('private database detail'))).not.toContain('private database detail')
})
