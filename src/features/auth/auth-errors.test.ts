import { describe, expect, it } from 'vitest'
import { AuthApiError } from '@supabase/supabase-js'
import { getAuthErrorMessage } from './auth-errors'

describe('erros de autenticação', () => {
  it('traduz credenciais inválidas sem expor a resposta original', () => {
    expect(getAuthErrorMessage(new AuthApiError('internal detail', 400, 'invalid_credentials')))
      .toBe('Email ou password incorretos.')
  })
  it('trata limites de pedidos', () => {
    expect(getAuthErrorMessage(new AuthApiError('rate limit', 429, undefined))).toContain('Aguarde')
  })
  it('não apresenta mensagens internas de erros desconhecidos', () => {
    expect(getAuthErrorMessage(new Error('sensitive server response'))).not.toContain('sensitive')
  })
})
