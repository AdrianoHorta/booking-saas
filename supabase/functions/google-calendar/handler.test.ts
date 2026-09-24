import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createCalendarHandler } from './handler'
import { seal } from './crypto'
const key = btoa('a'.repeat(32))
const rpc = vi.fn()
const getUser = vi.fn()
const remote = vi.fn()
const handler = createCalendarHandler((name) => ({ CALENDAR_APP_ORIGINS: 'http://localhost:5173',
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only', GOOGLE_CALENDAR_CLIENT_ID: 'client',
  GOOGLE_CALENDAR_CLIENT_SECRET: 'secret', CALENDAR_ENCRYPTION_KEY: key }[name]),
  (() => ({ auth: { getUser }, rpc })) as Parameters<typeof createCalendarHandler>[1])
const jwt = `header.${btoa(JSON.stringify({ session_id: 'session-a' }))}.signature`
const request = (action: string, fields = {}, origin = 'http://localhost:5173') => new Request('https://example.test', {
  method: 'POST', headers: { origin, authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ businessId: 'd1000000-0000-0000-0000-000000000001', action, ...fields }),
})
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', remote); getUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null }) })
afterEach(() => vi.unstubAllGlobals())
it('rejects untrusted origins and invalid sessions before touching credentials', async () => {
  expect((await handler(request('start', {}, 'https://evil.test'))).status).toBe(403)
  getUser.mockResolvedValue({ data: { user: null }, error: {} })
  expect((await handler(request('start'))).status).toBe(401)
  expect(rpc).not.toHaveBeenCalled(); expect(remote).not.toHaveBeenCalled()
})
it('stores only the hash and builds a fixed Google URL with minimal scopes', async () => {
  rpc.mockResolvedValue({ data: {}, error: null })
  const result = await (await handler(request('start'))).json()
  const url = new URL(result.url)
  expect(url.origin).toBe('https://accounts.google.com')
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/calendar/callback')
  expect(url.searchParams.get('scope')).not.toContain('calendar.events')
  expect(rpc.mock.calls[0][1].payload.state_hash).not.toBe(result.state)
})
it('does not exchange a code when the state or association fails', async () => {
  rpc.mockResolvedValue({ data: null, error: {} })
  expect((await handler(request('finish', { code: 'code', state: 'a'.repeat(64) }))).status).toBe(409)
  expect(remote).not.toHaveBeenCalled()
})
it('does not accept a calendar id absent from the Google writable list', async () => {
  rpc.mockResolvedValue({ data: { credentials: await seal({ refreshToken: 'token' }, key), version: 'v1' }, error: null })
  remote.mockResolvedValueOnce(Response.json({ access_token: 'access' }))
    .mockResolvedValueOnce(Response.json({ items: [{ id: 'read-only', summary: 'Private', accessRole: 'reader' }] }))
  expect((await handler(request('select', { calendarId: 'read-only' }))).status).toBe(400)
  expect(rpc).toHaveBeenCalledTimes(1)
})
it('preserves local secrets on revocation failure and returns no provider details', async () => {
  rpc.mockResolvedValue({ data: { credentials: await seal({ refreshToken: 'token' }, key), version: 'v1' }, error: null })
  remote.mockResolvedValue(Response.json({ error: 'provider-secret' }, { status: 500 }))
  const result = await handler(request('disconnect'))
  expect(result.status).toBe(502)
  expect(await result.text()).not.toContain('provider-secret')
  expect(rpc).toHaveBeenCalledTimes(1)
})
it('clears local secrets only after revocation succeeds', async () => {
  rpc.mockResolvedValue({ data: { credentials: await seal({ refreshToken: 'token' }, key), version: 'v1' }, error: null })
  remote.mockResolvedValue(new Response(null, { status: 200 }))
  expect((await handler(request('disconnect'))).status).toBe(200)
  expect(rpc.mock.calls[1][1]).toMatchObject({ action: 'disconnect', payload: { version: 'v1' } })
})
it('finishes OAuth with encrypted credentials and returns no token', async () => {
  rpc.mockResolvedValue({ data: { credentials: null, version: 'v1' }, error: null })
  remote.mockResolvedValueOnce(Response.json({ access_token: 'access-secret', refresh_token: 'refresh-secret', scope: 'openid https://www.googleapis.com/auth/calendar.calendarlist.readonly' }))
    .mockResolvedValueOnce(Response.json({ sub: 'google-account' }))
  const result = await handler(request('finish', { state: 'a'.repeat(64), code: 'code' }))
  expect(await result.json()).toEqual({ connected: true })
  expect(rpc.mock.calls[1][1].action).toBe('save')
  expect(rpc.mock.calls[1][1].payload.credentials).not.toContain('refresh-secret')
})
it('refuses partial consent before saving credentials', async () => {
  rpc.mockResolvedValue({ data: { credentials: null, version: 'v1' }, error: null })
  remote.mockResolvedValue(Response.json({ access_token: 'access', scope: 'openid' }))
  expect((await handler(request('finish', { state: 'a'.repeat(64), code: 'code' }))).status).toBe(422)
  expect(rpc).toHaveBeenCalledTimes(1)
})
it('never reuses a previous refresh token for a different Google account', async () => {
  rpc.mockResolvedValue({ data: { credentials: await seal({ refreshToken: 'old-token', account: 'old-account' }, key), version: 'v1' }, error: null })
  remote.mockResolvedValueOnce(Response.json({ access_token: 'access', scope: 'openid https://www.googleapis.com/auth/calendar.calendarlist.readonly' }))
    .mockResolvedValueOnce(Response.json({ sub: 'different-account' }))
  expect((await handler(request('finish', { state: 'a'.repeat(64), code: 'code' }))).status).toBe(422)
  expect(rpc).toHaveBeenCalledTimes(1)
})
