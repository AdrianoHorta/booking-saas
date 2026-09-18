import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../auth/auth-context'
import { Button } from '../../../components/ui/button'
import { FormField } from '../../../components/ui/form-field'
import { Message } from '../../../components/feedback/message'
import { businessRoleLabels, type BusinessSummary } from '../business.types'
import { listBusinessMembers, memberInputSchema, removeBusinessMember, saveBusinessMember, type MemberInput } from '../api/members-api'

export function BusinessMembers({ business }: { business: BusinessSummary }) {
  const { session } = useAuth()
  const client = useQueryClient()
  const canManage = business.role === 'owner' || business.role === 'admin'
  const [removing, setRemoving] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const form = useForm<MemberInput>({ resolver: zodResolver(memberInputSchema), defaultValues: { email: '', role: 'employee' } })
  const members = useQuery({ queryKey: ['business-members', session?.user.id, business.id], enabled: canManage,
    queryFn: ({ signal }) => listBusinessMembers(business.id, signal), retry: false })
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['business-members'] }),
      client.invalidateQueries({ queryKey: ['employee-members', business.id] }),
      client.invalidateQueries({ queryKey: ['employees', business.id] }),
    ])
  }
  const mutation = useMutation({
    mutationFn: async (operation: { values: MemberInput } | { userId: string }) => {
      setNotice('')
      if ('values' in operation) await saveBusinessMember(business.id, operation.values)
      else await removeBusinessMember(business.id, operation.userId)
    },
    onSuccess: async (_, operation) => {
      setRemoving(null); form.reset()
      setNotice('values' in operation ? 'Acesso guardado. Pode agora associar esta conta a um colaborador em Gerir colaboradores.' : 'Acesso retirado. O profissional e as reservas foram mantidos.')
      await refresh()
    },
  })
  if (!canManage) return null
  return <section className="space-y-5" aria-labelledby="members-heading">
    <h2 id="members-heading" className="font-display text-3xl">Acesso à empresa</h2>
    <p className="max-w-2xl text-muted">Adicione uma conta já registada pelo email. O acesso à empresa é separado do perfil de profissional e da sua agenda. Não é enviado convite por email.</p>
    {members.isPending ? <Message>A carregar membros…</Message> : members.isError ? <><Message error>Não foi possível carregar os membros.</Message><Button onClick={() => void members.refetch()}>Atualizar membros</Button></>
      : <ul className="divide-y divide-line">{members.data.map((member) => {
        const editable = member.user_id !== session?.user.id && member.role !== 'owner' && (business.role === 'owner' || member.role === 'employee')
        return <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div><p className="break-all font-medium">{member.email ?? 'Conta sem email'}</p><p className="text-sm text-muted">{businessRoleLabels[member.role]}</p></div>
          {editable && <div className="flex flex-wrap gap-2">
            {business.role === 'owner' && member.email && <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ values: { email: member.email!, role: member.role === 'admin' ? 'employee' : 'admin' } })}>
              {member.role === 'admin' ? 'Tornar colaborador' : 'Tornar administrador'}
            </Button>}
            <Button disabled={mutation.isPending} onClick={() => { mutation.reset(); setNotice(''); setRemoving(member.user_id) }}>Retirar acesso</Button>
            {removing === member.user_id && <div className="w-full space-y-3 rounded-sm border border-line p-4">
              <p>Retirar o acesso de {member.email}? A ligação à conta será removida do profissional. Os serviços, horários e reservas serão mantidos.</p>
              <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ userId: member.user_id })}>Confirmar retirada de acesso</Button>{' '}
              <Button disabled={mutation.isPending} onClick={() => setRemoving(null)}>Cancelar</Button>
            </div>}
          </div>}
        </li>
      })}</ul>}
    <form noValidate className="max-w-xl space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate({ values }))}>
      <fieldset disabled={mutation.isPending || members.isError || members.isPending} className="space-y-4">
        <legend className="mb-3 font-medium">Adicionar conta existente</legend>
        <FormField label="Email da conta" type="email" autoComplete="off" {...form.register('email')} error={form.formState.errors.email?.message} />
        <label className="block text-sm font-medium">Permissão<select {...form.register('role')} className="mt-2 min-h-12 w-full border border-line bg-surface px-3">
          <option value="employee">Colaborador</option>{business.role === 'owner' && <option value="admin">Administrador</option>}
        </select></label>
        <Button type="submit">{mutation.isPending ? 'A guardar…' : 'Guardar acesso'}</Button>
      </fieldset>
    </form>
    {mutation.isError && <Message error>{mutation.error.message}</Message>}
    {notice && <Message>{notice}</Message>}
  </section>
}
