import { expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase/client', () => ({ getSupabase: vi.fn() }))
import { validatePeriod, analyticsSchema, integrationSchema } from './insights-api'
it('accepts a leap-year range and rejects invalid or unbounded periods', () => {
  expect(() => validatePeriod('2028-01-01', '2028-12-31')).not.toThrow()
  for (const [from, to] of [['2028-01-01', '2029-01-01'], ['2026-02-29', '2026-03-01'], ['2026-07-10', '2026-07-09'], ['', '2026-07-09']]) {
    expect(() => validatePeriod(from, to)).toThrow()
  }
})
it('rejects malformed indicators and strips unexpected sensitive status fields', () => {
  expect(analyticsSchema.safeParse({ confirmed: -1 }).success).toBe(false)
  const status = integrationSchema.parse({ emails_enabled: false, credentials: 'secret', deliveries: [] })
  expect(status).toEqual({ emails_enabled: false, deliveries: [] })
})
