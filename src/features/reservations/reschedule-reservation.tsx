import { useState } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { Message } from '../../components/feedback/message'
import { getRescheduleSlots, rescheduleReservation, RescheduleError, type RescheduleRequest } from './reschedule-api'

export function RescheduleReservation({ businessId, bookingId, startsAt, timezone }: { businessId: string; bookingId: string; startsAt: string; timezone: string }) {
  const [open, setOpen] = useState(false)
  const [viewedAt] = useState(() => Date.now())
  if (Date.parse(startsAt) <= viewedAt) return null
  return <>
    <button type="button" className="min-h-10 text-sm text-brand underline underline-offset-4" onClick={() => setOpen(true)}>Reagendar reserva</button>
    {open && <RescheduleEditor businessId={businessId} bookingId={bookingId} startsAt={startsAt} timezone={timezone} onClose={() => setOpen(false)} />}
  </>
}
function RescheduleEditor({ businessId, bookingId, startsAt, timezone, onClose }: { businessId: string; bookingId: string; startsAt: string; timezone: string; onClose: () => void }) {
  const [date, setDate] = useState(() => Temporal.Instant.from(startsAt).toZonedDateTimeISO(timezone).toPlainDate().toString())
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState<RescheduleRequest | null>(null)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['reschedule-slots', businessId, bookingId, date], enabled: Boolean(date) && !pending, retry: false,
    queryFn: ({ signal }) => getRescheduleSlots(businessId, bookingId, date, signal) })
  const mutation = useMutation({ mutationFn: rescheduleReservation, onSuccess: async () => {
    await Promise.all(['reservations','reservation-summary','availability','public-booking-slots','reschedule-slots'].map((key) => client.invalidateQueries({ queryKey: [key] })))
    onClose()
  }, onError: (error) => { if (!(error instanceof RescheduleError) || !error.uncertain) { setPending(null); setSelected(''); void query.refetch() } } })
  const changed = query.data && Date.parse(query.data.expected_start) !== Date.parse(startsAt)
  const validSelection = query.data?.slots.some((slot) => slot.starts_at === selected)
  const format = (value: string) => new Intl.DateTimeFormat('pt-PT', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  return <Dialog label="Reagendar reserva" onClose={onClose} preventClose={mutation.isPending || Boolean(pending)}>
    <h2 className="font-display text-3xl">Reagendar reserva</h2>
    <p className="my-4 text-sm">Horário atual: {format(startsAt)}. O serviço, profissional, duração e preço mantêm-se.</p>
    {pending ? <p className="my-4">Novo horário pedido: {format(pending.requestedStart)}</p> : <div className="space-y-4">
      <FormField label="Nova data" type="date" value={date} onChange={(event) => { setDate(event.target.value); setSelected(''); mutation.reset() }} />
      {query.isFetching ? <Message>A consultar vagas…</Message> : query.isError ? <><Message error>{query.error.message}</Message><Button onClick={() => void query.refetch()}>Atualizar vagas</Button></>
        : query.data?.slots.length ? <label className="block text-sm">Novo horário<select className="mt-2 min-h-12 w-full border border-line bg-surface p-3" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Escolha um horário</option>{query.data.slots.map((slot) => <option key={slot.starts_at} value={slot.starts_at}>{format(slot.starts_at)}</option>)}
        </select></label> : <Message>Não existem vagas nesta data.</Message>}
    </div>}
    <p className="my-4 text-sm text-muted">Confirme a alteração com o cliente. Não é enviada notificação automática.</p>
    {mutation.isError && <Message error>{mutation.error.message}</Message>}
    {changed && !pending && <Message error>A reserva foi alterada entretanto. Feche esta janela e atualize a lista.</Message>}
    <div className="mt-5 flex flex-wrap gap-3"><Button disabled={mutation.isPending || (!pending && (!validSelection || changed || query.isFetching || query.isError))} onClick={() => {
      const request = pending ?? { businessId, bookingId, expectedStart: startsAt, requestedStart: selected }
      setPending(request); mutation.mutate(request)
    }}>{mutation.isPending ? 'A guardar…' : pending ? 'Verificar alteração' : 'Confirmar novo horário'}</Button>
      {!pending && <Button disabled={mutation.isPending} onClick={onClose}>Manter horário</Button>}
    </div>
  </Dialog>
}
