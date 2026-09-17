import { describe, expect, it } from 'vitest'
import { emailSchema, loginSchema, passwordSchema, registerSchema } from './auth-schemas'

describe('validação de autenticação', () => {
  it('normaliza espaços no email mas preserva a password exata', () => {
    expect(loginSchema.parse({ email: '  pessoa@example.test ', password: ' secret ' }))
      .toEqual({ email: 'pessoa@example.test', password: ' secret ' })
  })
  it('permite login com passwords anteriores à política de registo', () => {
    expect(loginSchema.safeParse({ email: 'pessoa@example.test', password: 'old' }).success).toBe(true)
  })
  it('rejeita emails inválidos na recuperação', () => {
    expect(emailSchema.safeParse({ email: 'sem-email' }).success).toBe(false)
  })
  it('rejeita passwords curtas no registo', () => {
    expect(registerSchema.safeParse({ email: 'pessoa@example.test', password: 'short', confirmPassword: 'short' }).success).toBe(false)
  })
  it('associa o erro de confirmação ao campo correto', () => {
    const result = passwordSchema.safeParse({ password: 'password-123', confirmPassword: 'different-123' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
  })
  it('aceita uma nova password e confirmação válidas', () => {
    expect(passwordSchema.safeParse({ password: 'password-123', confirmPassword: 'password-123' }).success).toBe(true)
  })
})
