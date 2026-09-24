import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context'
import { Button } from '../../components/ui/button'
import { Message } from '../../components/feedback/message'
import { calendarAction, pendingCalendarKey, pendingSchema } from './calendar-api'

function readCallback() {
  const params = new URLSearchParams(window.location.search)
  // Remove the short-lived authorization code from browser history immediately.
  window.history.replaceState(null, '', window.location.pathname)
  try {
    const pending = pendingSchema.parse(JSON.parse(sessionStorage.getItem(pendingCalendarKey) ?? 'null'))
    sessionStorage.removeItem(pendingCalendarKey)
    if (params.get('state') !== pending.state) return null
    return { ...pending, code: params.get('code'), denied: params.has('error') }
  } catch { return null }
}
// Lazy route module runs once, avoiding repeated state consumption in StrictMode.
const callback = readCallback()
export function CalendarCallbackPage() {
  const { session, isLoading } = useAuth()
  const [attempted, setAttempted] = useState(false)
  const mutation = useMutation({ mutationFn: () => calendarAction(callback!.businessId, 'finish', { state: callback!.state, code: callback!.code! }) })
  const valid = callback && !callback.denied && callback.code && callback.userId === session?.user.id
  return <div className="space-y-5">
    <h1 className="font-display text-4xl">Ligar Google Calendar</h1>
    {isLoading ? <Message>A verificar sessão…</Message> : !valid ? <Message error>A autorização foi recusada, expirou ou pertence a outra sessão. Volte à empresa e inicie uma nova ligação.</Message>
      : mutation.isSuccess ? <Message>Conta Google autorizada. Volte à empresa para escolher o calendário.</Message>
        : <><p>Concluir a ligação do Google ao seu perfil de colaborador?</p>
          <Button disabled={attempted} onClick={() => { setAttempted(true); mutation.mutate() }}>{mutation.isPending ? 'A concluir…' : 'Concluir ligação'}</Button>
          {mutation.isError && <Message error>{mutation.error.message} Se o resultado for incerto, consulte primeiro o estado na empresa.</Message>}</>}
    <Link className="text-brand underline" to={callback ? `/dashboard/${callback.businessId}` : '/dashboard'}>Voltar à empresa</Link>
  </div>
}
