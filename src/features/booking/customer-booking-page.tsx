import { useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { customerBooking } from './customer-booking-api'
import { PageHeading } from '../../components/ui/page-heading'
import { Button } from '../../components/ui/button'
import { useConfirmationFocus } from '../../components/ui/use-confirmation-focus'
import { Message } from '../../components/feedback/message'

export function CustomerBookingPage() {
  const { bookingId = '' } = useParams()
  const { hash } = useLocation()
  const token = new URLSearchParams(hash.slice(1)).get('token') ?? ''
  return <CustomerBooking key={`${bookingId}:${token}`} id={bookingId} token={token} />
}
function CustomerBooking({ id, token }: { id: string; token: string }) {
  const [confirming, setConfirming] = useState(false)
  const { triggerRef, keepRef } = useConfirmationFocus(confirming)
  const query = useQuery({ queryKey: ['customer-booking', id, token], queryFn: () => customerBooking(id, token), retry: false, gcTime: 0 })
  const mutation = useMutation({ mutationFn: () => customerBooking(id, token, true), onSuccess: () => { setConfirming(false); void query.refetch() } })
  const data = mutation.data ?? query.data
  const format = (value: string) => new Intl.DateTimeFormat('pt-PT', { timeZone: data?.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  if (!data) return <div className="max-w-xl space-y-4">{query.isPending ? <Message>A consultar a reserva…</Message> : <><Message error>{query.error?.message}</Message><Button onClick={() => void query.refetch()}>Tentar novamente</Button></>}</div>
  return <div className="max-w-xl space-y-5">
    <PageHeading eyebrow={data.business_name} title={data.status === 'cancelled' ? 'Reserva cancelada.' : 'A sua reserva.'} description={`${data.service_name} · ${data.employee_name}`} />
    <p className="font-medium">{format(data.starts_at)}</p>
    {data.status === 'confirmed' && <>
      <p>Cancelamento permitido até {format(data.cancellation_deadline)} ({data.cancellation_notice_hours} horas de antecedência).</p>
      {!data.can_cancel ? <Message>O prazo de cancelamento terminou. Contacte a empresa.</Message>
        : confirming ? <div className="space-y-3"><p>Confirma que pretende cancelar esta reserva? A vaga ficará livre.</p>
          <div className="flex flex-wrap gap-3"><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'A cancelar…' : 'Confirmar cancelamento'}</Button>
            <Button ref={keepRef} disabled={mutation.isPending} onClick={() => setConfirming(false)}>Manter reserva</Button></div></div>
          : <Button ref={triggerRef} onClick={() => setConfirming(true)}>Cancelar reserva</Button>}
    </>}
    {mutation.isError && <Message error>{mutation.error.message}</Message>}
    <Button disabled={query.isFetching || mutation.isPending} onClick={() => { mutation.reset(); void query.refetch() }}>Atualizar estado</Button>
    <p className="text-sm text-muted">Esta ligação é privada. Quem a tiver pode consultar e cancelar esta reserva dentro do prazo.</p>
  </div>
}
