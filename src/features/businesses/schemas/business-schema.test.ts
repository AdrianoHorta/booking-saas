import { describe, expect, it } from 'vitest'
import { businessSchema, suggestBusinessSlug } from './business-schema'

describe('criação de empresa', () => {
  const values = { name: 'Studio', slug: 'studio', timezone: 'Europe/Lisbon' }
  it('normaliza espaços e maiúsculas', () => {
    expect(businessSchema.parse({ ...values, name: '  Studio  ', slug: ' STUDIO ' })).toEqual(values)
  })
  it.each(['ab', '-studio', 'studio-', 'studio--a', 'studio a', 'estúdio'])('rejeita o slug inválido %s', (slug) => {
    expect(businessSchema.safeParse({ ...values, slug }).success).toBe(false)
  })
  it('rejeita nomes vazios e fusos desconhecidos', () => {
    expect(businessSchema.safeParse({ ...values, name: '  ' }).success).toBe(false)
    expect(businessSchema.safeParse({ ...values, timezone: 'Mars/Olympus' }).success).toBe(false)
  })
  it('sugere um identificador sem acentos nem pontuação', () => {
    expect(suggestBusinessSlug('  Estúdio João & Filhos! ')).toBe('estudio-joao-filhos')
  })
  it('limita o identificador sem terminar com hífen', () => {
    const slug = suggestBusinessSlug('a'.repeat(62) + ' studio')
    expect(slug).toHaveLength(62)
    expect(slug.endsWith('-')).toBe(false)
  })
})
