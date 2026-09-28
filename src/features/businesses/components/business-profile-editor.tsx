import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/ui/button'
import { FormField } from '../../../components/ui/form-field'
import { Message } from '../../../components/feedback/message'
import { ImageEditor } from '../../profile/image-editor'
import { removeOldBrandImage, uploadBrandImage } from '../../profile/brand-images'
import { businessDetailsSchema, saveBusinessDetails, setBusinessLogo, type BusinessDetails } from '../api/business-profile-api'
import type { BusinessSummary } from '../business.types'

export function BusinessProfileEditor({ business }: { business: BusinessSummary }) {
  const client = useQueryClient()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const form = useForm<BusinessDetails>({ resolver: zodResolver(businessDetailsSchema), defaultValues: {
    name: business.name, description: business.description ?? '', email: business.email ?? '', phone: business.phone ?? '', address: business.address ?? '',
  } })
  async function refresh() {
    await Promise.all(['business', 'businesses', 'public-booking-catalog'].map((key) => client.invalidateQueries({ queryKey: [key] })))
  }
  if (business.role !== 'owner') return null
  return <section className="rounded-xl border border-line bg-surface p-5 sm:p-7" aria-labelledby="business-profile-heading">
    <h2 id="business-profile-heading" className="mb-2 font-display text-2xl">Identidade da empresa</h2>
    <p className="mb-6 text-sm text-muted">O nome, a imagem e os contactos do seu estabelecimento.</p>
    <ImageEditor logo name={business.name} path={business.logo_path} onSave={async (image) => {
      const path = image ? await uploadBrandImage('businesses', business.id, image) : null
      await setBusinessLogo(business.id, path)
      await refresh()
      await removeOldBrandImage(business.logo_path)
    }} />
    <form noValidate className="mt-6 space-y-4 border-t border-line pt-6" onSubmit={form.handleSubmit(async (values) => {
      setError(''); setSaved(false)
      try { await saveBusinessDetails(business.id, values); await refresh(); form.reset(values); setSaved(true) }
      catch (cause) { setError((cause as Error).message) }
    })}>
      <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
        <FormField label="Nome da empresa" maxLength={120} {...form.register('name')} error={form.formState.errors.name?.message} />
        <FormField label="Descrição (opcional)" maxLength={2000} {...form.register('description')} error={form.formState.errors.description?.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email da empresa (opcional)" type="email" maxLength={254} {...form.register('email')} error={form.formState.errors.email?.message} />
          <FormField label="Telefone da empresa (opcional)" type="tel" maxLength={40} {...form.register('phone')} error={form.formState.errors.phone?.message} />
        </div>
        <FormField label="Morada (opcional)" maxLength={500} {...form.register('address')} error={form.formState.errors.address?.message} />
        <Button type="submit">{form.formState.isSubmitting ? 'A guardar…' : 'Guardar dados da empresa'}</Button>
      </fieldset>
      {error && <Message error>{error}</Message>}{saved && <Message>Dados da empresa atualizados.</Message>}
    </form>
  </section>
}
