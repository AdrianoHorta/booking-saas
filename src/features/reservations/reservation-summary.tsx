import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button } from '../../components/ui/button'
import { Message } from '../../components/feedback/message'
import { useAuth } from '../auth/auth-context'
import type { BusinessSummary } from '../businesses/business.types'
import { getOwnProfessional } from './reservations-api'
import { getReservationSummary } from './reservation-summary-api'

export function ReservationSummary({ business }: { business: BusinessSummary }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const employee = business.role === 'employee'
  const profile = useQuery({
    queryKey: ['own-professional', userId, business.id],
    enabled: employee && Boolean(userId), retry: false,
    queryFn: ({ signal }) => getOwnProfessional(business.id, userId!, signal),
  })
  const summary = useQuery({
    queryKey: ['reservation-summary', userId, business.id, business.timezone, business.role, profile.data?.id],
    enabled: Boolean(userId) && (!employee || Boolean(profile.data)), retry: false,
    queryFn: ({ signal }) => getReservationSummary(business.id, business.timezone, signal),
  })
  const format = (value: string) => new Intl.DateTimeFormat('pt-PT', {
    timeZone: business.timezone, dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))

  return <section className="space-y-5" aria-label="Resumo das reservas">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="font-display text-3xl">{employee ? 'A sua agenda.' : 'A agenda da empresa.'}</h2>
      <Link to={`/dashboard/${business.id}/reservations`} className="text-sm font-medium text-brand underline underline-offset-4">
        {employee ? 'As minhas reservas' : 'Ver reservas da empresa'}
      </Link>
    </div>
    <p className="text-sm text-muted">Reservas confirmadas, pela data de início. Hoje e os seis dias seguintes.</p>
    {employee && profile.isPending ? <Message>A carregar a associação ao profissional…</Message>
      : employee && profile.isError ? <div className="space-y-3"><Message error>Não foi possível verificar a associação ao profissional.</Message><Button onClick={() => void profile.refetch()}>Tentar novamente</Button></div>
        : employee && !profile.data ? <Message>A sua conta ainda não está associada a um profissional. Peça a associação ao gestor da empresa.</Message>
          : <>
            <Button disabled={summary.isFetching} onClick={() => void summary.refetch()}>{summary.isFetching ? 'A atualizar…' : 'Atualizar resumo'}</Button>
            {summary.isError ? <Message error>Não foi possível carregar o resumo das reservas. Tente atualizar novamente.</Message>
              : summary.isPending ? <Message>A carregar o resumo…</Message>
                : <>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-sm border border-line bg-surface p-5"><dt className="text-sm text-muted">Hoje</dt><dd className="mt-2 text-3xl font-semibold text-brand">{summary.data.today}</dd></div>
                    <div className="rounded-sm border border-line bg-surface p-5"><dt className="text-sm text-muted">Próximos 7 dias, incluindo hoje</dt><dd className="mt-2 text-3xl font-semibold text-brand">{summary.data.week}</dd></div>
                  </dl>
                  <h3 className="font-display text-2xl">Próximas marcações neste período</h3>
                  {summary.data.upcoming.length === 0 ? <Message>Não há próximas marcações confirmadas neste período.</Message>
                    : <ul className="divide-y divide-line" aria-label="Próximas marcações">{summary.data.upcoming.map((booking) => <li key={booking.id} className="flex flex-wrap justify-between gap-3 py-4">
                      <div><p className="font-medium">{booking.service_name}</p>{!employee && <p className="text-sm text-muted">{booking.employee_name}</p>}</div>
                      <time dateTime={booking.starts_at} className="text-sm">{format(booking.starts_at)}</time>
                    </li>)}</ul>}
                </>}
          </>}
  </section>
}
