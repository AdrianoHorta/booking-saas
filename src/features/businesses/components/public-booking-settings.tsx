import { Button } from '../../../components/ui/button'
import { CancellationSettings } from './cancellation-settings'
import { Message } from '../../../components/feedback/message'
import type { BusinessSummary } from '../business.types'
import { useSetPublicBookingEnabled } from '../hooks/use-businesses'

export function PublicBookingSettings({ business }: { business: BusinessSummary }) {
  const mutation = useSetPublicBookingEnabled()
  const canManage = business.role === 'owner' || business.role === 'admin'
  const enabled = business.public_booking_enabled
  return <section className="max-w-xl space-y-4" aria-labelledby="public-booking-heading">
    <h2 id="public-booking-heading" className="font-display text-3xl">Reservas públicas</h2>
    <p className="leading-relaxed text-muted">
      Ao ativar, permite consultar os serviços, profissionais e vagas da empresa e fazer novas reservas sem iniciar sessão.
      Desativar impede novas reservas públicas e mantém as reservas existentes.
    </p>
    <p className="font-medium">Publicação: {enabled ? 'Ativada' : 'Desativada'}</p>
    {enabled && business.is_active && <a href={`/book/${encodeURIComponent(business.slug)}`} className="block break-all text-sm text-brand underline underline-offset-4">Abrir página pública: /book/{business.slug}</a>}
    {!business.is_active && <Message>A empresa está inativa. Não aceita novas reservas públicas e não pode ativar a publicação.</Message>}
    {canManage ? <Button disabled={mutation.isPending || (!business.is_active && !enabled)}
      onClick={() => mutation.mutate({ businessId: business.id, enabled: !enabled })}>
      {mutation.isPending ? 'A guardar…' : enabled ? 'Desativar reservas públicas' : 'Ativar reservas públicas'}
    </Button> : <p className="text-sm text-muted">Apenas o proprietário e os administradores podem alterar a publicação.</p>}
    {mutation.isError && <Message error>{mutation.error.message}</Message>}
    {mutation.isSuccess && <Message>Alteração de publicação guardada.</Message>}
    {canManage && <CancellationSettings businessId={business.id} initialHours={business.cancellation_notice_hours ?? 12} />}
  </section>
}
