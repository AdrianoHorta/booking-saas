import { describe, expect, it } from 'vitest'
import { parseSupabaseEnv } from './env'

describe('configuração pública Supabase', () => {
  it('aceita apenas URL HTTPS e publishable key', () => {
    expect(parseSupabaseEnv('https://example.supabase.co', 'sb_publishable_example'))
      .toEqual({ url: 'https://example.supabase.co', key: 'sb_publishable_example' })
  })
  it('rejeita chaves privilegiadas ou configuração ausente', () => {
    expect(parseSupabaseEnv('https://example.supabase.co', 'sb_secret_example')).toBeNull()
    expect(parseSupabaseEnv(undefined, '')).toBeNull()
  })
  it('rejeita URLs com credenciais ou protocolos inesperados', () => {
    expect(parseSupabaseEnv('https://user:password@example.supabase.co', 'sb_publishable_example')).toBeNull()
    expect(parseSupabaseEnv('javascript:alert(1)', 'sb_publishable_example')).toBeNull()
  })
})
