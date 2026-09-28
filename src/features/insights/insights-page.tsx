import { useState } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context'
import { useBusiness } from '../businesses/hooks/use-businesses'
import type { BusinessSummary } from '../businesses/business.types'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { PageHeading } from '../../components/ui/page-heading'
import { Message } from '../../components/feedback/message'
import { getAnalytics, getIntegrationStatus, setBookingEmails, validatePeriod } from './insights-api'

export function InsightsPage() {
  const { businessId = '' } = useParams()
  const business = useBusiness(businessId)
  if (business.isPending) return <Message>A carregar a empresa…</Message>
  if (business.isError) return <><Message error>Não foi possível carregar a empresa.</Message><Button onClick={() => void business.refetch()}>Tentar novamente</Button></>
  if (!business.data || business.data.role === 'employee') return <Message>Esta página está disponível apenas para o proprietário e administradores da empresa.</Message>
  return <Insights key={businessId} business={business.data} />
}

const eventLabels = { confirmed: 'Confirmação', rescheduled: 'Reagendamento', cancelled: 'Cancelamento' }
const stateLabels = { pending: 'Em espera', processing: 'A processar', done: 'Concluído', skipped: 'Substituído ou desativado', failed: 'Requer atenção' }
const errors: Record<string, string> = { reconnect: 'Volte a autorizar o Google ou verifique o acesso do fornecedor de email.',
  configuration: 'A configuração do serviço precisa de ser concluída.', provider_unavailable: 'Serviço temporariamente indisponível.',
  provider_rejected: 'O serviço recusou a operação. Verifique a configuração ou o evento no calendário.',
  retry_window_expired: 'O envio não foi confirmado dentro do prazo. Verifique o fornecedor antes de reenviar.' }

function Insights({ business }: { business: BusinessSummary }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const client = useQueryClient()
  const [from, setFrom] = useState(() => Temporal.Now.plainDateISO(business.timezone).with({ day: 1 }).toString())
  const [to, setTo] = useState(() => Temporal.Now.plainDateISO(business.timezone).toString())
  let valid = true
  try { validatePeriod(from, to) } catch { valid = false }
  const analytics = useQuery({ queryKey: ['booking-analytics', userId, business.id, from, to], enabled: valid && Boolean(userId), retry: false,
    queryFn: ({ signal }) => getAnalytics(business.id, from, to, signal) })
  const statusKey = ['booking-integrations', userId, business.id]
  const status = useQuery({ queryKey: statusKey, enabled: Boolean(userId), retry: false, refetchInterval: 30_000,
    queryFn: ({ signal }) => getIntegrationStatus(business.id, signal) })
  const emails = useMutation({ mutationFn: (enabled: boolean) => setBookingEmails(business.id, enabled),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: statusKey }) } })
  const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
  return <div className="space-y-8">
    <Link to={`/dashboard/${business.id}`} className="text-sm text-brand underline underline-offset-4">Voltar à empresa</Link>
    <PageHeading eyebrow={business.name} title="Indicadores e notificações." description="Acompanhe as marcações e o estado dos envios automáticos." />
    <section aria-label="Indicadores" className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Desde" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <FormField label="Até" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <p className="text-sm text-muted">Reservas pela data de início no fuso {business.timezone}. O valor marcado não representa pagamentos recebidos.</p>
      {!valid ? <Message error>Escolha um período válido de 1 a 366 dias.</Message> : analytics.isPending ? <Message>A carregar indicadores…</Message>
        : analytics.isError ? <><Message error>{analytics.error.message}</Message><Button onClick={() => void analytics.refetch()}>Atualizar indicadores</Button></>
          : <>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
              ['Confirmadas', analytics.data.confirmed], ['Canceladas', analytics.data.cancelled],
              ['Valor marcado', money(analytics.data.booked_value_cents)], ['Horas marcadas', (analytics.data.booked_minutes / 60).toLocaleString('pt-PT', { maximumFractionDigits: 1 })],
            ].map(([label, value]) => <div key={label} className="rounded-sm border border-line bg-surface p-5"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold text-brand">{value}</dd></div>)}</dl>
            {analytics.data.daily.length === 0 ? <Message>Não existem reservas neste período.</Message> : <>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-display text-2xl">Marcações por dia</caption><thead><tr><th scope="col" className="py-2">Data</th><th scope="col">Confirmadas</th><th scope="col">Canceladas</th></tr></thead><tbody>
                {analytics.data.daily.map((day) => <tr key={day.date} className="border-t border-line"><th scope="row" className="py-2 font-normal">{Temporal.PlainDate.from(day.date).toLocaleString('pt-PT')}</th><td>{day.confirmed}</td><td>{day.cancelled}</td></tr>)}
              </tbody></table></div>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-display text-2xl">Serviços no período</caption><thead><tr><th scope="col" className="py-2">Serviço</th><th scope="col">Confirmadas</th><th scope="col">Valor marcado</th></tr></thead><tbody>
                {analytics.data.services.map((service) => <tr key={service.name} className="border-t border-line"><th scope="row" className="py-2 font-normal">{service.name}</th><td>{service.confirmed}</td><td>{money(service.booked_value_cents)}</td></tr>)}
              </tbody></table></div>
            </>}
          </>}
    </section>
    <section aria-label="Emails de reservas" className="space-y-4 rounded-sm border border-line bg-surface p-5">
      <h2 className="font-display text-3xl">Emails de reservas</h2>
      <p className="text-sm text-muted">Envie ao cliente a confirmação, o novo horário ou o cancelamento, com a ligação privada da reserva. Ative depois de configurar o serviço de email. Não são enviados emails retroativos ao ativar.</p>
      {status.isPending ? <Message>A consultar envios…</Message> : status.isError ? <><Message error>{status.error.message}</Message><Button onClick={() => void status.refetch()}>Atualizar envios</Button></>
        : <><p>{status.data.emails_enabled ? 'Emails automáticos ativos.' : 'Emails automáticos desativados.'}</p>
          <Button disabled={emails.isPending} onClick={() => emails.mutate(!status.data.emails_enabled)}>{emails.isPending ? 'A guardar…' : status.data.emails_enabled ? 'Desativar emails' : 'Ativar emails'}</Button>
          <p className="text-xs text-muted">Desativar também impede pedidos ainda por enviar; uma operação já em curso pode terminar.</p></>}
      {emails.isError && <Message error>{emails.error.message}</Message>}
    </section>
    {status.data && <section aria-label="Últimos envios" className="space-y-4">
      <h2 className="font-display text-3xl">Últimos envios</h2>
      <p className="text-sm text-muted">Até 30 operações de Google Calendar e email. Email concluído significa aceite pelo fornecedor; não confirma chegada à caixa de entrada.</p>
      {status.data.deliveries.length === 0 ? <Message>Ainda não existem pedidos de envio.</Message> : <ul className="space-y-3">{status.data.deliveries.map((delivery) => <li key={delivery.id} className="space-y-1 border-b border-line py-3 text-sm">
        <p className="font-medium">{delivery.channel === 'calendar' ? 'Google Calendar' : 'Email'} · {eventLabels[delivery.event]} · {stateLabels[delivery.state]}</p>
        <p className="text-muted">{new Intl.DateTimeFormat('pt-PT', { timeZone: business.timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(delivery.created_at))} · Tentativas: {delivery.attempts}</p>
        {delivery.error_code && <p>{errors[delivery.error_code] ?? 'Verifique o estado do serviço.'}</p>}
      </li>)}</ul>}
    </section>}
  </div>
}
