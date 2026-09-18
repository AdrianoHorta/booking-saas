import { useState } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context'
import { getEmployees } from '../employees/api/employees-api'
import { useBusiness } from '../businesses/hooks/use-businesses'
import { businessIdSchema } from '../businesses/schemas/business-schema'
import type { BusinessSummary } from '../businesses/business.types'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { PageHeading } from '../../components/ui/page-heading'
import { Message } from '../../components/feedback/message'
import { getOwnProfessional, getReservations, reservationBounds, type ReservationFilters } from './reservations-api'

export function ReservationsPage() {
  const { businessId = '' } = useParams()
  const business = useBusiness(businessId)
  if (!businessIdSchema.safeParse(businessId).success) return <Message>Empresa indisponível.</Message>
  if (business.isPending) return <Message>A carregar a empresa…</Message>
  if (business.isError) return <div className="space-y-4"><Message error>Não foi possível carregar a empresa.</Message><Button onClick={() => void business.refetch()}>Tentar novamente</Button></div>
  if (!business.data) return <Message>Esta empresa não está disponível para a sua conta.</Message>
  return <ReservationsContent key={businessId} business={business.data} />
}
function ReservationsContent({ business }: { business: BusinessSummary }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const employee = business.role === 'employee'
  const [from, setFrom] = useState(() => Temporal.Now.plainDateISO(business.timezone).toString())
  const [to, setTo] = useState(() => Temporal.Now.plainDateISO(business.timezone).add({ days: 6 }).toString())
  const [status, setStatus] = useState<ReservationFilters['status']>('all')
  const [page, setPage] = useState(0)
  const [employeeId, setEmployeeId] = useState('')
  const professionals = useQuery({ queryKey: ['reservation-professionals', userId, business.id], enabled: !employee && Boolean(userId), retry: false,
    queryFn: ({ signal }) => getEmployees(business.id, signal) })
  const selectedProfessional = professionals.data?.find((person) => person.id === employeeId)
  const filters = { businessId: business.id, timezone: business.timezone, from, to, status, page, employeeId: employee ? undefined : employeeId || undefined }
  let validation = ''
  try { reservationBounds(filters) } catch { validation = 'Escolha datas válidas e um período de 1 a 31 dias, com o fim igual ou posterior ao início.' }
  const profile = useQuery({ queryKey: ['own-professional', userId, business.id], enabled: employee && Boolean(userId), retry: false,
    queryFn: ({ signal }) => getOwnProfessional(business.id, userId!, signal) })
  const query = useQuery({ queryKey: ['reservations', userId, filters],
    enabled: Boolean(userId) && !validation && (employee ? Boolean(profile.data) : Boolean(selectedProfessional)), retry: false,
    queryFn: ({ signal }) => getReservations(filters, signal) })
  const format = (value: string) => new Intl.DateTimeFormat('pt-PT', { timeZone: business.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  return <div className="space-y-7">
    <Link to={`/dashboard/${business.id}`} className="text-sm text-brand underline underline-offset-4">Voltar à empresa</Link>
    <PageHeading eyebrow={business.name} title={employee ? 'As minhas reservas.' : selectedProfessional ? `Reservas da empresa - ${selectedProfessional.name}` : 'Reservas da empresa.'}
      description={employee ? 'Consulte as marcações do profissional associado à sua conta.' : 'Consulte as marcações e os contactos dos clientes da sua empresa.'} />
    {!employee && <section className="space-y-4 rounded-sm border border-line bg-surface p-5" aria-label="Colaboradores">
      <h2 className="font-display text-2xl">Colaboradores</h2>
      {professionals.isPending ? <Message>A carregar colaboradores…</Message> : professionals.isError ? <><Message error>Não foi possível carregar os colaboradores.</Message><Button onClick={() => void professionals.refetch()}>Tentar novamente</Button></>
        : professionals.data.length === 0 ? <Message>Ainda não existem colaboradores nesta empresa.</Message>
          : <div className="flex flex-wrap gap-3">{professionals.data.map((person) => <button key={person.id} type="button" aria-pressed={employeeId === person.id}
            onClick={() => { setEmployeeId(person.id); setPage(0) }}
            className={`min-h-12 rounded-sm border px-5 py-3 text-sm font-medium ${employeeId === person.id ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink hover:border-brand'}`}>
            {person.name}{!person.is_active && <span className="ml-2 text-xs">(Inativo)</span>}
          </button>)}</div>}
    </section>}
    {employee && profile.isPending ? <Message>A verificar o seu perfil de profissional…</Message>
      : employee && profile.isError ? <div className="space-y-4"><Message error>{profile.error.message}</Message><Button onClick={() => void profile.refetch()}>Verificar associação</Button></div>
        : employee && !profile.data ? <Message>A sua conta ainda não está associada a um profissional desta empresa. Peça ao proprietário ou administrador para fazer a associação em Gerir colaboradores.</Message>
          : !employee && !selectedProfessional ? <Message>Escolha um colaborador para consultar as reservas.</Message> : <>
            <div className="grid gap-4 rounded-sm border border-line p-5 sm:grid-cols-3">
              <FormField label="Desde" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0) }} />
              <FormField label="Até" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(0) }} />
              <label className="text-sm font-medium">Estado<select value={status} onChange={(event) => { setStatus(event.target.value as ReservationFilters['status']); setPage(0) }} className="mt-2 min-h-12 w-full border border-line bg-surface px-3">
                <option value="all">Todos</option><option value="confirmed">Confirmadas</option><option value="cancelled">Canceladas</option>
              </select></label>
            </div>
            <Button disabled={Boolean(validation) || query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'A atualizar…' : 'Atualizar reservas'}</Button>
            {validation ? <Message error>{validation}</Message> : query.isFetching || query.isPending ? <Message>A carregar reservas…</Message>
              : query.isError ? <Message error>{query.error.message}</Message>
                : query.data.reservations.length === 0 ? <Message>Não existem reservas para este período e estado.</Message>
                  : <ul aria-label="Reservas" className="grid items-start gap-4 lg:grid-cols-2">{query.data.reservations.map((booking) => <li key={booking.id} className="space-y-3 rounded-sm border border-line bg-surface p-4">
                    <div className="flex flex-wrap justify-between gap-3"><h2 className="font-display text-2xl">{booking.service_name}</h2><span className="text-sm font-medium">{booking.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}</span></div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div><dt className="text-muted">Início</dt><dd className="font-medium">{format(booking.starts_at)}</dd></div>
                      <div><dt className="text-muted">Fim</dt><dd>{format(booking.ends_at)}</dd></div>
                      {!employee && <div><dt className="text-muted">Profissional</dt><dd>{booking.employee_name}</dd></div>}
                      <div><dt className="text-muted">Duração</dt><dd>{booking.duration_minutes} min</dd></div>
                      {booking.customer ? <>
                        <div><dt className="text-muted">Cliente</dt><dd>{booking.customer.name}</dd></div>
                        <div><dt className="text-muted">Email</dt><dd className="break-all">{booking.customer.email}</dd></div>
                        {booking.customer.phone && <div><dt className="text-muted">Telefone</dt><dd>{booking.customer.phone}</dd></div>}
                      </> : <div><dt>Cliente</dt><dd>Contactos indisponíveis.</dd></div>}
                    </dl>
                    <div className="flex items-end justify-between gap-4 border-t border-line pt-3">
                      <details className="min-w-0 text-xs text-muted"><summary className="cursor-pointer">Referência</summary><p className="mt-2 break-all">{booking.id}</p></details>
                      <p className="shrink-0 text-2xl font-semibold text-brand"><span className="sr-only">Preço: </span>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: booking.currency }).format(booking.price_cents / 100)}</p>
                    </div>
                  </li>)}</ul>}
            {!validation && !query.isError && <nav aria-label="Páginas de reservas" className="flex flex-wrap items-center gap-4">
              <Button disabled={page === 0 || query.isFetching} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
              <span>Página {page + 1}</span>
              <Button disabled={!query.data?.hasMore || query.isFetching} onClick={() => setPage((current) => current + 1)}>Seguinte</Button>
            </nav>}
          </>}
  </div>
}
