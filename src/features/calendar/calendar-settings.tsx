import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context'
import { Button } from '../../components/ui/button'
import { Message } from '../../components/feedback/message'
import { calendarAction, calendarsSchema, getCalendarConnection, startCalendarConnection } from './calendar-api'

export function CalendarSettings({ businessId }: { businessId: string }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const client = useQueryClient()
  const [selected, setSelected] = useState('')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const key = ['calendar-connection', userId, businessId]
  const connection = useQuery({ queryKey: key, queryFn: () => getCalendarConnection(businessId), enabled: Boolean(userId), retry: false })
  const calendars = useQuery({ queryKey: ['google-calendars', userId, businessId],
    queryFn: async () => calendarsSchema.parse(await calendarAction(businessId, 'calendars')).calendars,
    enabled: connection.data?.connected === true, retry: false, staleTime: 0 })
  const action = useMutation({ mutationFn: async (operation: 'start' | 'select' | 'disconnect') => {
    if (operation === 'start') return startCalendarConnection(businessId, userId)
    return calendarAction(businessId, operation, operation === 'select' ? { calendarId: selected } : {})
  }, onSuccess: async (_, operation) => {
    if (operation !== 'start') {
      setSelected(''); setConfirmDisconnect(false)
      client.removeQueries({ queryKey: ['google-calendars', userId, businessId] })
      await client.invalidateQueries({ queryKey: key })
    }
  } })
  return <section className="space-y-4 rounded-sm border border-line bg-surface p-5" aria-label="Google Calendar">
    <h2 className="font-display text-3xl">O meu Google Calendar</h2>
    <p className="text-sm text-muted">Ligue a sua conta e escolha um calendário. A sincronização automática das reservas será disponibilizada numa próxima etapa.</p>
    {connection.isPending ? <Message>A consultar ligação…</Message> : connection.isError ? <><Message error>{connection.error.message}</Message><Button onClick={() => void connection.refetch()}>Tentar novamente</Button></>
      : !connection.data ? <Message>Para ligar um calendário, a sua conta tem de estar associada a um colaborador ativo desta empresa.</Message> : <>
        <p>Profissional: <strong>{connection.data.employee_name}</strong></p>
        <p>{connection.data.connected ? connection.data.calendar_name ? `Calendário escolhido: ${connection.data.calendar_name}` : 'Conta autorizada. Escolha um calendário.' : 'Nenhuma conta Google ligada.'}</p>
        <Button disabled={action.isPending} onClick={() => action.mutate('start')}>{connection.data.connected ? 'Voltar a autorizar no Google' : 'Ligar Google Calendar'}</Button>
        {connection.data.connected && <>
          {calendars.isPending ? <Message>A consultar calendários…</Message> : calendars.isError ? <><Message error>{calendars.error.message}</Message><Button disabled={calendars.isFetching} onClick={() => void calendars.refetch()}>Atualizar calendários</Button></>
            : calendars.data?.length ? <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">Calendário<select className="mt-2 block min-h-12 border border-line bg-surface px-3" value={selected} onChange={(event) => setSelected(event.target.value)} disabled={action.isPending}>
                <option value="">Escolha um calendário</option>{calendars.data.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.summary}</option>)}
              </select></label><Button disabled={!selected || action.isPending} onClick={() => action.mutate('select')}>Guardar calendário</Button>
            </div> : <Message>Não existem calendários em que possa criar eventos.</Message>}
          {confirmDisconnect ? <div className="space-y-3"><p>Desligar a conta Google? Esta ação não altera as reservas da aplicação.</p>
            <Button disabled={action.isPending} onClick={() => action.mutate('disconnect')}>Confirmar desconexão</Button>{' '}
            <Button disabled={action.isPending} onClick={() => setConfirmDisconnect(false)}>Manter ligação</Button></div>
            : <Button disabled={action.isPending} onClick={() => setConfirmDisconnect(true)}>Desligar Google Calendar</Button>}
        </>}
      </>}
    {action.isPending && <p role="status">A processar…</p>}
    {action.isError && <Message error>{action.error.message}</Message>}
  </section>
}
