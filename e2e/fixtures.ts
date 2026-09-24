import { test as base, expect, type Route } from '@playwright/test'

export const employeeId = '63000000-0000-4000-8000-000000000001'
export const serviceId = '64000000-0000-4000-8000-000000000001'
export const receipt = {
  id: '66000000-0000-4000-8000-000000000001', status: 'confirmed',
  starts_at: '2099-01-05T09:00:00Z', ends_at: '2099-01-05T09:30:00Z',
  cancellation_token: 'a'.repeat(64), cancellation_notice_hours: 12,
  cancellation_deadline: '2099-01-04T21:00:00Z', service_name: 'Corte',
  employee_name: 'Miguel', duration_minutes: 30, price_cents: 1500, currency: 'EUR',
}
export const catalog = {
  business: { name: 'Barbearia de teste', slug: 'barbearia-teste', timezone: 'Europe/Lisbon', cancellation_notice_hours: 12 },
  services: [{ id: serviceId, name: 'Corte', duration_minutes: 30, price_cents: 1500,
    currency: 'EUR', employees: [{ id: employeeId, name: 'Miguel' }] }],
}
export const availability = {
  server_now: '2099-01-01T12:00:00Z', timezone: 'Europe/Lisbon', duration_minutes: 30,
  slots: [{ starts_at: receipt.starts_at, ends_at: receipt.ends_at }],
}
export const customer = { ...receipt, business_name: catalog.business.name, timezone: 'Europe/Lisbon', can_cancel: true }
type RpcHandler = (route: Route, body: Record<string, unknown>) => Promise<void>
type Call = { name: string; body: Record<string, unknown> }
export function syntheticSession(id: string, email = 'team@example.test') {
  const expiresAt = Date.parse('2100-01-01T00:00:00Z') / 1000
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, role: 'authenticated', exp: expiresAt })}.test-signature`,
    refresh_token: 'synthetic-refresh-token', token_type: 'bearer', expires_at: expiresAt, expires_in: 3600,
    user: { id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2098-01-01T00:00:00Z' },
  }
}
export type TestApi = {
  calls: Call[];
  on: (name: string, handler: RpcHandler) => void;
  onAuth: (endpoint: 'token' | 'logout', handler: RpcHandler) => void;
  onGet: (table: string, handler: (route: Route, query: URLSearchParams) => Promise<void>) => void;
  signIn: (userId: string) => Promise<void>;
}
export const test = base.extend<{ api: TestApi }>({
  api: [async ({ context }, use) => {
    const calls: Call[] = []
    const unexpected: string[] = []
    let authenticated = false
    const reads = new Map<string, (route: Route, query: URLSearchParams) => Promise<void>>()
    const authHandlers = new Map<string, RpcHandler>()
    const handlers = new Map<string, RpcHandler>([
      ['get_public_booking_catalog', async (route) => { await route.fulfill({ json: catalog }) }],
      ['get_public_booking_availability', async (route) => { await route.fulfill({ json: availability }) }],
      ['confirm_booking', async (route) => { await route.fulfill({ json: receipt }) }],
      ['get_customer_booking', async (route) => { await route.fulfill({ json: customer }) }],
    ])
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin === 'http://127.0.0.1:4177') return route.continue()
      if (url.origin === 'https://booking-test.invalid' && ['GET', 'HEAD'].includes(request.method())) {
        const table = url.pathname.replace('/rest/v1/', '')
        const read = reads.get(table)
        if (read) {
          calls.push({ name: `${request.method()}:${table}`, body: Object.fromEntries(url.searchParams) })
          return read(route, url.searchParams)
        }
      }
      if (url.origin === 'https://booking-test.invalid' && request.method() === 'POST' && url.pathname.startsWith('/auth/v1/')) {
        const endpoint = url.pathname.slice('/auth/v1/'.length)
        const handler = authHandlers.get(endpoint)
        if (handler) {
          const body = request.postData() ? request.postDataJSON() : {}
          calls.push({ name: `AUTH:${endpoint}`, body })
          return handler(route, body)
        }
      }
      const name = url.pathname.startsWith('/rest/v1/rpc/') ? url.pathname.slice('/rest/v1/rpc/'.length) : ''
      const handler = url.origin === 'https://booking-test.invalid' ? handlers.get(name) : undefined
      if (!handler || request.method() !== 'POST') {
        unexpected.push(`${request.method()} ${url.origin}${url.pathname}`)
        return route.abort('blockedbyclient')
      }
      const body = request.postDataJSON() as Record<string, unknown>
      calls.push({ name, body })
      await handler(route, body)
    })
    await context.routeWebSocket(/wss?:\/\/.*/, (socket) => {
      // Vite HMR is local; no remote Realtime or Google connections are allowed.
      if (new URL(socket.url()).host === '127.0.0.1:4177') socket.connectToServer()
      else if (authenticated && new URL(socket.url()).hostname === 'booking-test.invalid') socket.close()
      else { unexpected.push('Unexpected external WebSocket'); socket.close() }
    })
    await use({ calls, on: (name, handler) => handlers.set(name, handler),
      onAuth: (endpoint, handler) => { authenticated = true; authHandlers.set(endpoint, handler) },
      onGet: (table, handler) => reads.set(table, handler),
      signIn: async (userId) => {
        authenticated = true
        // Synthetic local session only; never accepted by a real Supabase server.
        await context.addInitScript((session) => {
          // Seed once per context; reloading after logout must not restore the old user.
          if (localStorage.getItem('e2e-session-seeded')) return
          localStorage.setItem('e2e-session-seeded', 'true')
          localStorage.setItem('sb-booking-test-auth-token', JSON.stringify(session))
        }, syntheticSession(userId))
      },
    })
    expect(unexpected, 'Every external request must be explicitly mocked').toEqual([])
  }, { auto: true }],
})
export { expect }
