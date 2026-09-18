import { useState } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { PageHeading } from '../../../components/ui/page-heading'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Message } from '../../../components/feedback/message'
import { businessIdSchema } from '../../businesses/schemas/business-schema'
import { useBusiness } from '../../businesses/hooks/use-businesses'
import { scheduleKey, useDeleteBlockedPeriod, useSchedule } from '../hooks/use-schedule'
import { formatInstant, minuteLabel, weekdays } from '../schedule-time'
import { WeekForm } from '../components/week-form'
import { BlockForm } from '../components/block-form'
import type { BlockedPeriod, ScheduleScope } from '../api/schedules-api'

type Editor = { kind: 'week' } | { kind: 'block'; block?: BlockedPeriod } | { kind: 'delete'; block: BlockedPeriod }
export function SchedulePage() {
  const { businessId = '', employeeId = '' } = useParams()
  return <ScheduleContent key={`${businessId}:${employeeId}`} scope={{ businessId, employeeId }} />
}
function ScheduleContent({ scope }: { scope: ScheduleScope }) {
  const business = useBusiness(scope.businessId)
  const schedule = useSchedule(scope)
  const remove = useDeleteBlockedPeriod(scope)
  const busy = useIsMutating({ mutationKey: scheduleKey(scope) }) > 0
  const [editor, setEditor] = useState<Editor | null>(null)
  const close = () => setEditor(null)
  const back = <Link to={`/dashboard/${scope.businessId}/employees`} className="text-sm text-brand underline underline-offset-4">Voltar aos colaboradores</Link>
  if (![scope.businessId, scope.employeeId].every((id) => businessIdSchema.safeParse(id).success)) {
    return <Message>Colaborador indisponível.</Message>
  }
  if (business.isPending || schedule.isPending) return <Message>A carregar o horário…</Message>
  if (business.isError || schedule.isError) return <div className="space-y-4"><Message error>Não foi possível carregar o horário.</Message>
    <Button onClick={() => { void business.refetch(); void schedule.refetch() }}>Tentar novamente</Button>{back}</div>
  if (!business.data || !schedule.data.employee) return <div className="space-y-4"><Message>Este colaborador não está disponível para a sua conta.</Message>{back}</div>
  const { employee, hours, blocks } = schedule.data
  const { timezone, role } = business.data
  const canManage = role === 'owner' || role === 'admin'
  return <div className="space-y-10">
    <div className="flex flex-wrap items-center justify-between gap-4">{back}</div>
    <PageHeading eyebrow="Agenda da equipa" title={`Horário de ${employee.name}.`} description="Defina a semana de trabalho e os períodos em que este profissional está indisponível." />
    {!employee.is_active && <Message>Colaborador inativo. Pode preparar o horário para quando voltar a estar ativo.</Message>}
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-display text-3xl">Semana habitual</h2>
        {canManage && <Button onClick={() => setEditor({ kind: 'week' })}>Editar semana</Button>}</div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{weekdays.map((day, index) => {
        const periods = hours.filter((hour) => hour.weekday === index + 1)
        return <article key={day} className="rounded-[3px] border border-line bg-white p-6"><h3 className="font-display text-xl">{day}</h3>
          {periods.length === 0 ? <p className="mt-4 text-sm text-muted">Sem horário</p>
            : <ul className="mt-4 space-y-2">{periods.map((period) => <li key={period.id}>{minuteLabel(period.start_minute)} — {minuteLabel(period.end_minute)}</li>)}</ul>}
        </article>
      })}</div>
    </section>
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-display text-3xl">Bloqueios e ausências</h2>
        {canManage && <Button onClick={() => setEditor({ kind: 'block' })}>Adicionar bloqueio</Button>}</div>
      {blocks.length === 0 ? <p className="border-y border-line py-8 text-muted">Sem bloqueios registados.</p>
        : <div className="grid gap-4 md:grid-cols-2">{blocks.map((block) => <article key={block.id} className="rounded-[3px] border border-line bg-white p-6">
          <h3 className="font-display text-2xl">{block.label}</h3>
          <p className="mt-4 text-sm text-muted">{formatInstant(block.starts_at, timezone)} — {formatInstant(block.ends_at, timezone)}</p>
          {canManage && <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => setEditor({ kind: 'block', block })}>Editar bloqueio</Button>
            <Button onClick={() => { remove.reset(); setEditor({ kind: 'delete', block }) }}>Remover bloqueio</Button>
          </div>}
        </article>)}</div>}
    </section>
    {canManage && editor && <Dialog label={editor.kind === 'week' ? 'Editar semana' : editor.kind === 'delete' ? 'Remover bloqueio' : 'Editar bloqueio'} onClose={close} preventClose={busy}>
      <button type="button" aria-label="Fechar" disabled={busy} onClick={close} className="absolute right-6 top-6 text-2xl text-muted disabled:opacity-50">×</button>
      <h2 className="pr-6 font-display text-3xl">{editor.kind === 'week' ? 'A semana de trabalho.' : editor.kind === 'delete' ? 'Remover este bloqueio?' : 'Um período de pausa.'}</h2>
      {editor.kind === 'week' ? <WeekForm scope={scope} hours={hours} onClose={close} />
        : editor.kind === 'block' ? <BlockForm scope={scope} timezone={timezone} block={editor.block} onClose={close} />
        : <div className="mt-7 space-y-5">
          <p>O período «{editor.block.label}» deixará de bloquear o horário.</p>
          {remove.isError && <Message error>Não foi possível remover o bloqueio. Tente novamente.</Message>}
          <div className="flex flex-wrap justify-end gap-3"><Button disabled={remove.isPending} onClick={close}>Cancelar</Button>
            <Button disabled={remove.isPending} onClick={async () => { try { await remove.mutateAsync(editor.block.id); close() } catch { /* mutation apresenta erro */ } }}>{remove.isPending ? 'A remover…' : 'Confirmar remoção'}</Button></div>
        </div>}
    </Dialog>}
  </div>
}
