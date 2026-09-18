import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'
import { useSaveWorkingHours } from '../hooks/use-schedule'
import { weekSchema, type WeekValues } from '../schemas/schedule-schema'
import { minuteLabel, weekdays } from '../schedule-time'
import type { ScheduleScope, WorkingHours } from '../api/schedules-api'

export function WeekForm({ scope, hours, onClose }: { scope: ScheduleScope; hours: WorkingHours[]; onClose: () => void }) {
  const save = useSaveWorkingHours(scope)
  const { register, control, handleSubmit, formState: { errors } } = useForm<WeekValues>({
    resolver: zodResolver(weekSchema),
    defaultValues: { periods: hours.map((hour) => ({ weekday: hour.weekday, start: minuteLabel(hour.start_minute), end: minuteLabel(hour.end_minute) })) },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'periods' })
  async function submit(values: WeekValues) {
    try { await save.mutateAsync(values); onClose() } catch { /* mutation apresenta erro */ }
  }
  return <form noValidate onSubmit={handleSubmit(submit)} className="mt-7 space-y-5">
    {save.isError && <Message error>Não foi possível guardar a semana. Verifique os períodos e tente novamente.</Message>}
    <p className="text-sm text-muted">Use HH:mm, com 24:00 para o fim do dia. Divida turnos noturnos entre dois dias. Uma semana vazia significa sem horário.</p>
    <fieldset disabled={save.isPending} className="space-y-5">
      {fields.map((field, index) => <div key={field.id} className="space-y-3 border-b border-line pb-5">
        <label className="block text-sm">Dia {index + 1}
          <select {...register(`periods.${index}.weekday`, { valueAsNumber: true })} className="mt-2 w-full border border-line bg-white p-3">
            {weekdays.map((day, dayIndex) => <option key={day} value={dayIndex + 1}>{day}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Início {index + 1}<input {...register(`periods.${index}.start`)} placeholder="09:00" className="mt-2 w-full border border-line p-3" /></label>
          <label className="text-sm">Fim {index + 1}<input {...register(`periods.${index}.end`)} placeholder="18:00" className="mt-2 w-full border border-line p-3" /></label>
        </div>
        {errors.periods?.[index] && <p role="alert" className="text-sm text-red-600">{errors.periods[index]?.start?.message ?? errors.periods[index]?.end?.message ?? errors.periods[index]?.weekday?.message}</p>}
        <button type="button" onClick={() => remove(index)} className="text-sm text-brand underline">Remover período {index + 1}</button>
      </div>)}
      <Button onClick={() => append({ weekday: 1, start: '09:00', end: '18:00' })}>Adicionar período</Button>
      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit">{save.isPending ? 'A guardar…' : 'Guardar semana'}</Button>
      </div>
    </fieldset>
  </form>
}
