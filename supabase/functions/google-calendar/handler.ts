import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0'
import { eventScope, hash, randomState, scope, seal, unseal } from './crypto.ts'

export function createCalendarHandler(readEnv: (name: string) => string | undefined, createClient: (url: string, key: string, options: { auth: { persistSession: boolean; autoRefreshToken: boolean } }) => SupabaseClient) {
const env = (name: string) => { const value = readEnv(name); if (!value) throw new Error('configuration'); return value }
type Calendar = { id: string; summary: string; accessRole: string }
return async (request: Request) => {
  const origin = request.headers.get('origin') ?? ''
  const allowed = (readEnv('CALENDAR_APP_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' }
  const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (!allowed.includes(origin)) return response({ error: 'Origem não autorizada.' }, 403)
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (request.method !== 'POST') return response({ error: 'Método inválido.' }, 405)
  try {
    const keys = readEnv('SUPABASE_SECRET_KEYS')
    const serverKey = keys ? JSON.parse(keys).default : env('SUPABASE_SERVICE_ROLE_KEY')
    if (typeof serverKey !== 'string' || !serverKey) throw new Error('configuration')
    const server = createClient(env('SUPABASE_URL'), serverKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const jwt = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
    const { data: auth, error: authError } = await server.auth.getUser(jwt)
    if (authError || !auth.user) return response({ error: 'Inicie sessão novamente.' }, 401)
    // getUser verified this token before any claims are used. Refreshes preserve session_id.
    const claims = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof claims.session_id !== 'string') return response({ error: 'Sessão inválida.' }, 401)
    const stateHash = (state: string) => hash(`${state}:${origin}:${claims.session_id}`)
    const body = await request.json()
    if (!/^[0-9a-f-]{36}$/i.test(body.businessId ?? '')) return response({ error: 'Empresa inválida.' }, 400)
    const db = async (action: string, payload = {}) => {
      const { data, error } = await server.rpc('calendar_connection_backend', {
        action, target_business_id: body.businessId, target_user_id: auth.user.id, payload,
      })
      if (error) throw new Error('authorization')
      return data
    }
    const clientId = env('GOOGLE_CALENDAR_CLIENT_ID')
    const clientSecret = env('GOOGLE_CALENDAR_CLIENT_SECRET')
    const encryptionKey = env('CALENDAR_ENCRYPTION_KEY')
    const redirectUri = `${origin}/calendar/callback`
    const token = async (params: Record<string, string>) => {
      const result = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', body: new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret }), signal: AbortSignal.timeout(15_000),
      })
      if (!result.ok) throw new Error(result.status === 400 ? 'reconnect' : 'provider')
      return await result.json()
    }
    const calendars = async (accessToken: string): Promise<Calendar[]> => {
      const list: Calendar[] = []
      let next = ''
      do {
        const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList')
        url.searchParams.set('minAccessRole', 'writer')
        if (next) url.searchParams.set('pageToken', next)
        const result = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) })
        if (!result.ok) throw new Error(result.status === 401 || result.status === 403 ? 'reconnect' : 'provider')
        const data = await result.json()
        list.push(...(data.items ?? []).filter((c: Calendar) => c.accessRole === 'owner' || c.accessRole === 'writer')
          .map((c: Calendar) => ({ id: c.id, summary: c.summary, accessRole: c.accessRole })))
        next = data.nextPageToken ?? ''
      } while (next)
      return list
    }
    if (body.action === 'start') {
      const state = randomState()
      await db('start', { state_hash: await stateHash(state) })
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri,
        response_type: 'code', scope, state, access_type: 'offline', prompt: 'consent' }).toString()
      return response({ url: url.toString(), state })
    }
    if (body.action === 'finish') {
      if (typeof body.state !== 'string' || !/^[a-f0-9]{64}$/.test(body.state) || typeof body.code !== 'string' || body.code.length > 4096) throw new Error('authorization')
      const connection = await db('consume', { state_hash: await stateHash(body.state) })
      const credentials = await token({ grant_type: 'authorization_code', code: body.code, redirect_uri: redirectUri })
      const granted = String(credentials.scope ?? '').split(' ')
      if (!granted.includes('https://www.googleapis.com/auth/calendar.calendarlist.readonly') || !granted.includes(eventScope)) throw new Error('reconnect')
      const identity = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${credentials.access_token}` }, signal: AbortSignal.timeout(15_000),
      })
      if (!identity.ok) throw new Error('provider')
      const account = (await identity.json()).sub
      if (typeof account !== 'string') throw new Error('provider')
      const previous = connection.credentials ? await unseal(connection.credentials, encryptionKey) : null
      const refreshToken = credentials.refresh_token ?? (previous?.account === account && previous.canWriteEvents === true ? previous.refreshToken : null)
      if (!refreshToken) throw new Error('reconnect')
      await db('save', { version: connection.version, credentials: await seal({ refreshToken, account, canWriteEvents: true }, encryptionKey) })
      return response({ connected: true })
    }
    const connection = await db('read')
    if (!connection.credentials) throw new Error('reconnect')
    const stored = await unseal(connection.credentials, encryptionKey)
    if (body.action === 'disconnect') {
      const result = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST', body: new URLSearchParams({ token: stored.refreshToken }), signal: AbortSignal.timeout(15_000),
      })
      if (!result.ok) {
        const failure = await result.json().catch(() => ({}))
        if (result.status !== 400 || failure.error !== 'invalid_token') throw new Error('provider')
      }
      await db('disconnect', { version: connection.version })
      return response({ connected: false })
    }
    if (body.action !== 'calendars' && body.action !== 'select') return response({ error: 'Operação inválida.' }, 400)
    const credentials = await token({ grant_type: 'refresh_token', refresh_token: stored.refreshToken })
    const list = await calendars(credentials.access_token)
    if (body.action === 'calendars') return response({ calendars: list })
    const selected = list.find((calendar) => calendar.id === body.calendarId)
    if (!selected) return response({ error: 'Escolha um calendário disponível para escrita.' }, 400)
    await db('select', { version: connection.version, calendar_id: selected.id, calendar_name: selected.summary })
    return response({ selected: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'configuration') return response({ error: 'A integração Google ainda não está configurada.' }, 503)
    if (code === 'authorization') return response({ error: 'A ligação mudou ou a autorização expirou. Volte à empresa e tente novamente.' }, 409)
    if (code === 'reconnect') return response({ error: 'É necessário voltar a autorizar o acesso no Google.' }, 422)
    return response({ error: 'Não foi possível contactar o Google. Tente novamente.' }, 502)
  }
}
}

