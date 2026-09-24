import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/button'
import { useConfirmationFocus } from '../../components/ui/use-confirmation-focus'
import { Message } from '../../components/feedback/message'
import { cancelReservation } from './reservations-api'

export function CancelReservation({ businessId, bookingId, serviceName, startsAt, noticeHours = 12 }: {
  businessId: string; bookingId: string; serviceName: string; startsAt: string; noticeHours?: number
}) {
  const [confirming, setConfirming] = useState(false)
  const { triggerRef, keepRef } = useConfirmationFocus(confirming)
  const [viewedAt] = useState(() => Date.now())
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => cancelReservation(businessId, bookingId),
    onSuccess: async () => {
      await Promise.all(['reservations', 'reservation-summary', 'availability', 'public-booking-slots'].map((key) =>
        client.invalidateQueries({ queryKey: [key] })))
      setConfirming(false)
    },
  })
  if (mutation.isSuccess) return <Message>Reserva cancelada.</Message>
  if (!confirming && Date.parse(startsAt) <= viewedAt) return null
  if (!confirming && Date.parse(startsAt) - noticeHours * 3600000 < viewedAt) return <p className="text-xs text-muted">Prazo de cancelamento terminado.</p>
  return <div className="border-t border-line pt-3">
    {!confirming ? <button ref={triggerRef} type="button" className="min-h-10 text-sm text-brand underline underline-offset-4" onClick={() => setConfirming(true)}>Cancelar reserva</button>
      : <div className="space-y-3" role="group" aria-label={`Cancelar ${serviceName}`}>
        <p className="text-sm">Cancelar a reserva de {serviceName}? A vaga ficará livre. O cliente não recebe uma notificação automática.</p>
        <div className="flex flex-wrap gap-2"><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'A cancelar…' : 'Confirmar cancelamento'}</Button>
          <Button ref={keepRef} disabled={mutation.isPending} onClick={() => { setConfirming(false); mutation.reset() }}>Manter reserva</Button></div>
        {mutation.isError && <Message error>{mutation.error.message}</Message>}
      </div>}
  </div>
}
