import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'
import { blockSchema, type BlockValues } from '../schemas/schedule-schema'
import { instantToLocal, localToInstant } from '../schedule-time'
import { useSaveBlockedPeriod } from '../hooks/use-schedule'
import type { BlockedPeriod, ScheduleScope } from '../api/schedules-api'

export function BlockForm({ scope, timezone, block, onClose }: {
  scope: ScheduleScope; timezone: string; block?: BlockedPeriod; onClose: () => void
}) {
  const save = useSaveBlockedPeriod(scope)
  const { register, handleSubmit, formState: { errors } } = useForm<BlockValues>({
    resolver: zodResolver(blockSchema(timezone)),
    defaultValues: { label: block?.label ?? '', start: block ? instantToLocal(block.starts_at, timezone) : '', end: block ? instantToLocal(block.ends_at, timezone) : '' },
  })
  async function submit(values: BlockValues) {
    try {
      await save.mutateAsync({ id: block?.id, label: values.label,
        starts_at: localToInstant(values.start, timezone), ends_at: localToInstant(values.end, timezone) })
      onClose()
    } catch { /* mutation apresenta erro; validação das datas ocorre antes do submit */ }
  }
  return <form noValidate onSubmit={handleSubmit(submit)} className="mt-7 space-y-5">
    {save.isError && <Message error>Não foi possível guardar o bloqueio. Tente novamente.</Message>}
    <p className="text-sm text-muted">Para um dia inteiro, indique 00:00 até 00:00 do dia seguinte.</p>
    <fieldset disabled={save.isPending} className="space-y-5">
      <label className="block text-sm">Descrição
        <input {...register('label')} placeholder="Ex.: Férias" className="mt-2 w-full border border-line p-3" />
      </label>
      {errors.label && <p role="alert" className="text-sm text-red-600">{errors.label.message}</p>}
      <label className="block text-sm">Início
        <input type="datetime-local" step="60" {...register('start')} className="mt-2 w-full border border-line bg-white p-3" />
      </label>
      {errors.start && <p role="alert" className="text-sm text-red-600">{errors.start.message}</p>}
      <label className="block text-sm">Fim
        <input type="datetime-local" step="60" {...register('end')} className="mt-2 w-full border border-line bg-white p-3" />
      </label>
      {errors.end && <p role="alert" className="text-sm text-red-600">{errors.end.message}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit">{save.isPending ? 'A guardar…' : 'Guardar bloqueio'}</Button>
      </div>
    </fieldset>
  </form>
}
