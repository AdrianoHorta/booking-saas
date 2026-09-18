import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeading } from '../../../components/ui/page-heading'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Message } from '../../../components/feedback/message'
import { useBusiness } from '../../businesses/hooks/use-businesses'
import { businessIdSchema } from '../../businesses/schemas/business-schema'
import { useServices } from '../../services/hooks/use-services'
import { useEmployees, useSetEmployeeActive } from '../hooks/use-employees'
import { EmployeeForm } from '../components/employee-form'
import type { Employee } from '../api/employees-api'

export function EmployeesPage() {
  const { businessId = '' } = useParams()
  return <EmployeesCatalog key={businessId} businessId={businessId} />
}

function EmployeesCatalog({ businessId }: { businessId: string }) {
  const business = useBusiness(businessId)
  const employees = useEmployees(businessId)
  const services = useServices(businessId)
  const update = useSetEmployeeActive(businessId)
  const [editor, setEditor] = useState<Employee | 'new' | null>(null)
  const pending = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState(new Set<string>())
  const [error, setError] = useState<string | null>(null)
  const canManage = business.data?.role === 'owner' || business.data?.role === 'admin'
  const back = <Link to={`/dashboard/${businessId}`} className="text-sm text-brand underline underline-offset-4">Voltar à empresa</Link>

  async function toggle(employee: Employee) {
    if (pending.current.has(employee.id)) return
    pending.current.add(employee.id)
    setPendingIds(new Set(pending.current))
    setError(null)
    try {
      await update.mutateAsync({ id: employee.id, isActive: !employee.is_active })
    } catch {
      setError(`Não foi possível alterar o estado de ${employee.name}. Tente novamente.`)
    } finally {
      pending.current.delete(employee.id)
      setPendingIds(new Set(pending.current))
    }
  }

  if (!businessIdSchema.safeParse(businessId).success || (!business.isPending && !business.isError && !business.data)) {
    return <div className="space-y-4"><Message>Esta empresa não está disponível para a sua conta.</Message>{back}</div>
  }
  if (business.isPending) return <Message>A carregar a empresa…</Message>
  if (business.isError) return <div className="space-y-4"><Message error>Não foi possível carregar a empresa.</Message>
    <Button onClick={() => void business.refetch()}>Tentar novamente</Button>{back}</div>

  return <div className="space-y-10">
    <div className="flex items-center justify-between gap-5">{back}<span className="editorial-label text-brand">Equipa</span></div>
    <div className="flex flex-wrap items-end justify-between gap-6">
      <PageHeading eyebrow="Gestão" title="Colaboradores." description="Organize a sua equipa e os serviços que cada profissional realiza." />
      {canManage && <Button onClick={() => setEditor('new')}>Adicionar colaborador</Button>}
    </div>
    {error && <Message error>{error}</Message>}
    {employees.isPending || services.isPending ? <Message>A carregar a equipa…</Message>
      : employees.isError || services.isError ? <div className="space-y-4">
        <Message error>Não foi possível carregar a equipa e os seus serviços.</Message>
        <Button disabled={employees.isFetching || services.isFetching} onClick={() => { void employees.refetch(); void services.refetch() }}>Tentar novamente</Button>
      </div>
      : employees.data.length === 0 ? <p className="border-y border-line py-10 text-muted">Ainda não existem colaboradores.</p>
      : <section aria-label="Equipa atual" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {employees.data.map((employee) => <article key={employee.id} className="flex min-h-64 flex-col justify-between rounded-[3px] border border-line bg-white p-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h2 className="break-words font-display text-2xl">{employee.name}</h2>
              <span className="editorial-label text-brand">{employee.is_active ? 'Ativo' : 'Inativo'}</span>
            </div>
            <p className="mt-4 text-sm text-muted">{employee.user_id ? 'Com conta associada' : 'Sem conta associada'}</p>
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-xs uppercase tracking-wider text-muted">Serviços realizados</h3>
              {employee.employee_services.length === 0 ? <p className="mt-3 text-muted">Sem serviços associados.</p>
                : <ul className="mt-3 space-y-2">{employee.employee_services.map(({ service_id }) => {
                  const service = services.data.find((item) => item.id === service_id)
                  return <li key={service_id}>{service?.name ?? 'Serviço indisponível'}{service && !service.is_active ? ' — Inativo' : ''}</li>
                })}</ul>}
            </div>
          </div>
          <Link to={`/dashboard/${businessId}/employees/${employee.id}/schedule`} className="mt-6 text-sm text-brand underline underline-offset-4">Ver horário</Link>
          {canManage && <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5">
            <Button disabled={pendingIds.has(employee.id)} onClick={() => setEditor(employee)}>Editar</Button>
            <Button disabled={pendingIds.has(employee.id)} onClick={() => void toggle(employee)}>
              {pendingIds.has(employee.id) ? 'A atualizar…' : employee.is_active ? 'Desativar' : 'Ativar'}
            </Button>
          </div>}
        </article>)}
      </section>}
    {canManage && editor && <Dialog label={editor === 'new' ? 'Adicionar colaborador' : 'Editar colaborador'} onClose={() => setEditor(null)}>
      <button type="button" aria-label="Fechar" onClick={() => setEditor(null)} className="absolute right-6 top-6 text-2xl text-muted">×</button>
      <span className="editorial-label text-brand">A sua equipa</span>
      <h2 className="mt-3 pr-5 font-display text-4xl">{editor === 'new' ? 'Um novo profissional.' : 'Ajustar colaborador.'}</h2>
      <EmployeeForm businessId={businessId} employee={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} />
    </Dialog>}
  </div>
}
