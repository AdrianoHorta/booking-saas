import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'
import { useServices } from '../../services/hooks/use-services'
import { businessRoleLabels } from '../../businesses/business.types'
import { useEmployeeMembers, useSaveEmployee } from '../hooks/use-employees'
import { employeeSchema, type EmployeeFormValues } from '../schemas/employee-schema'
import type { Employee } from '../api/employees-api'

export function EmployeeForm({ businessId, employee, onClose }: {
  businessId: string; employee?: Employee; onClose: () => void
}) {
  const services = useServices(businessId)
  const members = useEmployeeMembers(businessId)
  const save = useSaveEmployee(businessId)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: employee?.name ?? '', userId: employee?.user_id ?? '',
      serviceIds: employee?.employee_services.map((item) => item.service_id) ?? [],
    },
  })
  async function submit(values: EmployeeFormValues) {
    setError(null)
    try {
      await save.mutateAsync({ values, id: employee?.id })
      onClose()
    } catch (cause) {
      setError(typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505'
        ? 'Esta conta já está associada a outro colaborador desta empresa.'
        : 'Não foi possível guardar o colaborador. Verifique a seleção e tente novamente.')
    }
  }
  if (services.isPending || members.isPending) return <Message>A carregar serviços e contas…</Message>
  if (services.isError || members.isError) return <div className="space-y-4">
    <Message error>Não foi possível carregar as opções do formulário.</Message>
    <Button onClick={() => { void services.refetch(); void members.refetch() }}>Tentar novamente</Button>
  </div>

  return <form noValidate onSubmit={handleSubmit(submit)} className="mt-8 space-y-7">
    {error && <Message error>{error}</Message>}
    <fieldset disabled={save.isPending} className="space-y-7">
      <div>
        <label htmlFor="employee-name" className="mb-2 block text-sm font-medium">Nome</label>
        <input id="employee-name" {...register('name')} aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'employee-name-error' : undefined}
          className="w-full border border-line bg-transparent px-4 py-3 outline-none focus:border-brand" placeholder="Ex.: Ana Silva" />
        {errors.name && <p id="employee-name-error" className="mt-2 text-sm text-red-600">{errors.name.message}</p>}
      </div>
      <div>
        <label htmlFor="employee-user" className="mb-2 block text-sm font-medium">Conta associada (opcional)</label>
        <select id="employee-user" {...register('userId')} className="w-full border border-line bg-white px-4 py-3">
          <option value="">Sem conta associada</option>
          {members.data.map((member) => <option key={member.user_id} value={member.user_id}>
            {member.email ?? member.user_id} — {businessRoleLabels[member.role]}
          </option>)}
        </select>
        <p className="mt-2 text-sm text-muted">Pode criar um profissional sem login. Para associar uma conta, adicione-a primeiro em Acesso à empresa na página da empresa.</p>
        {errors.userId && <p className="mt-2 text-sm text-red-600">{errors.userId.message}</p>}
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">Serviços realizados</legend>
        {services.data.length === 0 && <p className="text-sm text-muted">Ainda não existem serviços. Pode associá-los mais tarde.</p>}
        {services.data.map((service) => <label key={service.id} className="flex items-center gap-3 border-b border-line py-3">
          <input type="checkbox" value={service.id} {...register('serviceIds')} className="accent-brand" />
          <span>{service.name}{!service.is_active && <span className="text-muted"> — Inativo</span>}</span>
        </label>)}
        {errors.serviceIds && <p className="text-sm text-red-600">{errors.serviceIds.message}</p>}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-6">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit">{save.isPending ? 'A guardar…' : employee ? 'Guardar alterações' : 'Criar colaborador'}</Button>
      </div>
    </fieldset>
  </form>
}
