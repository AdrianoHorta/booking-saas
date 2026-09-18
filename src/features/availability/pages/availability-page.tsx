import { useEffect, useState } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { Link, useParams } from 'react-router'
import { PageHeading } from '../../../components/ui/page-heading'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'
import { useBusiness } from '../../businesses/hooks/use-businesses'
import { businessIdSchema } from '../../businesses/schemas/business-schema'
import { useServices } from '../../services/hooks/use-services'
import { useEmployees } from '../../employees/hooks/use-employees'
import { useAvailability } from '../hooks/use-availability'
import { availabilityRequestSchema, type getAvailability } from '../api/availability-api'

export function AvailabilityPage() {
  const { businessId = '' } = useParams()
  return <AvailabilityBusiness key={businessId} businessId={businessId} />
}
function AvailabilityBusiness({ businessId }: { businessId: string }) {
  const business = useBusiness(businessId)
  if (!businessIdSchema.safeParse(businessId).success) return <Message>Empresa indisponível.</Message>
  if (business.isPending) return <Message>A carregar a empresa…</Message>
  if (business.isError) return <div className="space-y-4"><Message error>Não foi possível carregar a empresa.</Message><Button onClick={() => void business.refetch()}>Tentar novamente</Button></div>
  if (!business.data) return <Message>Esta empresa não está disponível para a sua conta.</Message>
  return <AvailabilityContent businessId={businessId} timezone={business.data.timezone} active={business.data.is_active} />
}
function AvailabilityContent({ businessId, timezone, active }: { businessId: string; timezone: string; active: boolean }) {
  const services = useServices(businessId)
  const employees = useEmployees(businessId)
  const [serviceId, setServiceId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState(() => Temporal.Now.plainDateISO(timezone).toString())
  const request = { businessId, serviceId, employeeId, date }
  const availability = useAvailability(request)
  const valid = availabilityRequestSchema.safeParse(request).success
  const activeServices = services.data?.filter((service) => service.is_active) ?? []
  const eligible = employees.data?.filter((employee) => employee.is_active && employee.employee_services.some((link) => link.service_id === serviceId)) ?? []
  const selectedAvailable = active && activeServices.some((service) => service.id === serviceId) && eligible.some((employee) => employee.id === employeeId)
  return <div className="space-y-10">
    <Link to={`/dashboard/${businessId}`} className="text-sm text-brand underline underline-offset-4">Voltar à empresa</Link>
    <PageHeading eyebrow="Agenda" title="Disponibilidade." description="Consulte os horários disponíveis para cada serviço e profissional." />
    {!active ? <Message>A empresa está inativa.</Message>
      : services.isPending || employees.isPending ? <Message>A carregar serviços e colaboradores…</Message>
        : services.isError || employees.isError ? <div className="space-y-4"><Message error>Não foi possível carregar as opções.</Message><Button onClick={() => { void services.refetch(); void employees.refetch() }}>Tentar novamente</Button></div>
          : <>
            <div className="grid gap-5 rounded-[3px] border border-line bg-white p-6 md:grid-cols-3">
              <label className="text-sm font-medium">Serviço
                <select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setEmployeeId('') }} className="mt-2 w-full border border-line bg-white p-3">
                  <option value="">Selecione um serviço</option>{activeServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Colaborador
                <select value={employeeId} disabled={!serviceId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-2 w-full border border-line bg-white p-3 disabled:opacity-50">
                  <option value="">Selecione um colaborador</option>{eligible.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Data
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 w-full border border-line bg-white p-3" />
              </label>
            </div>
            {activeServices.length === 0 ? <Message>Não existem serviços ativos.</Message>
              : serviceId && eligible.length === 0 ? <Message>Não existem colaboradores ativos associados a este serviço.</Message>
                : !serviceId || !employeeId ? <Message>Selecione um serviço, um colaborador e uma data.</Message>
                  : !valid ? <Message>Indique uma data válida.</Message>
                    : !selectedAvailable ? <Message>A seleção deixou de estar disponível. Escolha novamente.</Message>
                      : availability.isPending ? <Message>A calcular vagas…</Message>
                        : availability.isError ? <div className="space-y-4"><Message error>{availability.error instanceof RangeError ? availability.error.message : 'Não foi possível consultar a disponibilidade. Tente novamente.'}</Message><Button disabled={availability.isFetching} onClick={() => void availability.refetch()}>Tentar novamente</Button></div>
                          : <>
                            <div className="flex items-center justify-between gap-4"><h2 className="font-display text-3xl">Vagas para esta data</h2><Button disabled={availability.isFetching} onClick={() => void availability.refetch()}>{availability.isFetching ? 'A atualizar…' : 'Atualizar'}</Button></div>
                            <AvailabilitySlots key={`${availability.data.serverNow}:${availability.dataUpdatedAt}`} data={availability.data} updatedAt={availability.dataUpdatedAt} />
                          </>}
          </>}
  </div>
}

function AvailabilitySlots({ data, updatedAt }: { data: Awaited<ReturnType<typeof getAvailability>>; updatedAt: number }) {
  const [started] = useState(() => performance.now())
  const [cachedAge] = useState(() => Math.max(0, Date.now() - updatedAt))
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(performance.now() - started), 1000)
    return () => window.clearInterval(timer)
  }, [started])
  const messages = { business_inactive: 'A empresa está inativa.', employee_inactive: 'O colaborador está inativo.', service_inactive: 'O serviço está inativo.', unassigned: 'O colaborador não realiza este serviço.' }
  if (data.reason) return <Message>{messages[data.reason]}</Message>
  const slots = data.slots.filter((slot) => slot.start >= Date.parse(data.serverNow) + cachedAge + elapsed)
  if (slots.length === 0) return <Message>Não existem vagas disponíveis nesta data para esta seleção.</Message>
  const formatter = new Intl.DateTimeFormat('pt-PT', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' })
  const dayFormatter = new Intl.DateTimeFormat('pt-PT', { timeZone: data.timezone, day: '2-digit', month: '2-digit' })
  return <ul aria-label="Vagas disponíveis" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{slots.map((slot) => <li key={slot.start} className="rounded-[3px] border border-line bg-white p-5">
    <time dateTime={new Date(slot.start).toISOString()}>{formatter.format(slot.start)}</time>
    <span className="text-muted"> — </span><time dateTime={new Date(slot.end).toISOString()}>{formatter.format(slot.end)}{dayFormatter.format(slot.start) !== dayFormatter.format(slot.end) ? ` (${dayFormatter.format(slot.end)})` : ''}</time>
  </li>)}</ul>
}
