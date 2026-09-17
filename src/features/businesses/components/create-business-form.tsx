import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '../../../components/ui/form-field'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'
import { businessSchema, suggestBusinessSlug, timezoneOptions, type BusinessFormValues } from '../schemas/business-schema'
import { useCreateBusiness } from '../hooks/use-businesses'
import { getBusinessErrorMessage } from '../business-errors'

export function CreateBusinessForm() {
  const navigate = useNavigate()
  const creation = useCreateBusiness()
  const { register, handleSubmit, getValues, setValue, formState: { errors } } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: '', slug: '', timezone: 'Europe/Lisbon' },
  })
  const nameField = register('name')

  return (
    <form noValidate className="space-y-6" onSubmit={handleSubmit((values) => {
      creation.mutate(values, { onSuccess: (id) => navigate(`/dashboard/${id}`, { replace: true }) })
    })}>
      {creation.isError && <Message error>{getBusinessErrorMessage(creation.error)}</Message>}
      <fieldset disabled={creation.isPending} className="space-y-6">
        <FormField label="Nome da empresa" autoComplete="organization" maxLength={120}
          {...nameField} onBlur={(event) => {
            void nameField.onBlur(event)
            if (!getValues('slug')) setValue('slug', suggestBusinessSlug(event.target.value))
          }} error={errors.name?.message} />
        <FormField label="Identificador público" autoComplete="off" autoCapitalize="none" spellCheck={false}
          hint="Letras, números e hífen. Será usado no futuro endereço /b/identificador."
          maxLength={63} {...register('slug')} error={errors.slug?.message} />
        <div>
          <label htmlFor="business-timezone" className="mb-2 block text-sm font-medium">Fuso horário</label>
          <select id="business-timezone" {...register('timezone')} aria-invalid={Boolean(errors.timezone)}
            aria-describedby="business-timezone-hint" className="min-h-12 w-full rounded-sm border border-line bg-surface px-3 py-3 text-base text-ink">
            {timezoneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <p id="business-timezone-hint" className="mt-2 text-sm text-muted">{errors.timezone?.message ?? 'Os horários da empresa serão interpretados neste fuso horário.'}</p>
        </div>
        <Button type="submit" className="w-full">{creation.isPending ? 'A criar empresa…' : 'Criar empresa'}</Button>
      </fieldset>
      <p className="text-sm leading-relaxed text-muted">A sua conta ficará como proprietária desta empresa. Poderá pertencer a mais do que uma empresa.</p>
    </form>
  )
}
