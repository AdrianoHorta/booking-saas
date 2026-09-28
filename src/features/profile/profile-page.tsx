import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/auth-context'
import { getAuthErrorMessage } from '../auth/auth-errors'
import { emailSchema, passwordSchema, type EmailValues } from '../auth/schemas/auth-schemas'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { Message } from '../../components/feedback/message'
import { useProfile } from './use-profile'
import { changeEmail, changePassword, profileNameSchema, saveMyProfile, sendPasswordCode, setMyAvatar, type Profile } from './profile-api'
import { removeOldBrandImage, uploadBrandImage } from './brand-images'
import { ImageEditor } from './image-editor'

const changePasswordSchema = passwordSchema.safeExtend({ currentPassword: z.string().min(1, 'Indique a password atual.'), nonce: z.string().trim() })
type PasswordFields = z.infer<typeof changePasswordSchema>
const card = 'rounded-xl border border-line bg-surface p-5 sm:p-7'

export function ProfilePage() {
  const { session } = useAuth()
  const profile = useProfile()
  if (!session) return null
  return <div className="mx-auto max-w-4xl space-y-7">
    <Link to="/dashboard" className="inline-flex min-h-11 items-center text-sm text-brand underline underline-offset-4">← Os meus negócios</Link>
    <header><p className="editorial-label mb-2 text-brand">A sua conta</p><h1 className="font-display text-4xl sm:text-5xl">O meu perfil.</h1>
      <p className="mt-3 text-sm text-muted">A sua imagem, os seus dados e o acesso à conta.</p></header>
    {profile.isPending ? <Message>A carregar o perfil…</Message> : profile.isError ? <div className="space-y-3"><Message error>{profile.error.message}</Message><Button onClick={() => void profile.refetch()}>Tentar novamente</Button></div>
      : <PersonalDetails key={session.user.id} profile={profile.data} userId={session.user.id} />}
    <div className="grid items-start gap-5 md:grid-cols-2">
      <EmailSettings key={session.user.id} email={session.user.email ?? ''} pendingEmail={session.user.new_email} />
      <PasswordSettings />
    </div>
  </div>
}

function PersonalDetails({ profile, userId }: { profile: Profile; userId: string }) {
  const client = useQueryClient()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const form = useForm<{ name: string }>({ resolver: zodResolver(profileNameSchema), defaultValues: { name: profile.full_name } })
  async function refresh() { await client.invalidateQueries({ queryKey: ['profile', userId] }); await client.invalidateQueries({ queryKey: ['public-booking-catalog'] }) }
  async function saveImage(image: Blob | null) {
    const path = image ? await uploadBrandImage('users', userId, image) : null
    await setMyAvatar(path)
    await refresh()
    await removeOldBrandImage(profile.avatar_path)
  }
  return <section className={card} aria-labelledby="personal-heading">
    <h2 id="personal-heading" className="mb-6 font-display text-2xl">Informações pessoais</h2>
    <div className="grid items-start gap-8 md:grid-cols-2">
      <ImageEditor name={profile.full_name || 'Perfil'} path={profile.avatar_path} onSave={saveImage} />
      <form noValidate className="space-y-4" onSubmit={form.handleSubmit(async ({ name }) => {
        setError(''); setSaved(false)
        try { await saveMyProfile(name); await refresh(); form.reset({ name: name.trim() }); setSaved(true) }
        catch (cause) { setError((cause as Error).message) }
      })}>
        <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
          <FormField label="Nome" autoComplete="name" maxLength={120} {...form.register('name')} error={form.formState.errors.name?.message} />
          <p className="text-xs text-muted">Este é o seu nome de conta. O nome profissional de cada empresa é gerido na equipa.</p>
          <Button type="submit">{form.formState.isSubmitting ? 'A guardar…' : 'Guardar nome'}</Button>
        </fieldset>
        {error && <Message error>{error}</Message>}{saved && <Message>Nome atualizado.</Message>}
      </form>
    </div>
  </section>
}

function EmailSettings({ email, pendingEmail }: { email: string; pendingEmail?: string }) {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const form = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } })
  return <section className={card} aria-labelledby="email-heading">
    <h2 id="email-heading" className="font-display text-2xl">Email de acesso</h2>
    <p className="mt-3 break-all text-sm text-muted">Atual: {email}</p>
    {pendingEmail && <p className="mt-3 break-all text-sm text-brand">A aguardar confirmação: {pendingEmail}</p>}
    <form noValidate className="mt-5 space-y-4" onSubmit={form.handleSubmit(async (values) => {
      setError(''); setMessage('')
      if (values.email.toLowerCase() === email.toLowerCase()) { setError('Indique um email diferente do atual.'); return }
      try {
        const user = await changeEmail(values.email)
        setMessage(user.email?.toLowerCase() === values.email.toLowerCase() ? 'Email atualizado.' : 'Pedido enviado. Verifique o email atual e o novo e siga as instruções de confirmação.')
        form.reset()
      } catch (cause) { setError(getAuthErrorMessage(cause)) }
    })}>
      <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
        <FormField label="Novo email" type="email" autoComplete="email" maxLength={254} {...form.register('email')} error={form.formState.errors.email?.message} />
        <p className="text-xs text-muted">Use um endereço a que tenha acesso para confirmar a alteração.</p>
        <Button type="submit">{form.formState.isSubmitting ? 'A enviar…' : 'Alterar email'}</Button>
      </fieldset>
      {error && <Message error>{error}</Message>}{message && <Message>{message}</Message>}
    </form>
  </section>
}

function PasswordSettings() {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const form = useForm<PasswordFields>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', password: '', confirmPassword: '', nonce: '' } })
  return <section className={card} aria-labelledby="password-heading">
    <h2 id="password-heading" className="font-display text-2xl">Password</h2>
    <p className="mt-3 text-sm text-muted">Escolha uma password única, com pelo menos 8 caracteres.</p>
    <form noValidate className="mt-5 space-y-4" onSubmit={form.handleSubmit(async (values) => {
      setError(''); setMessage('')
      try { await changePassword(values.password, values.currentPassword, values.nonce); form.reset(); setNeedsCode(false); setMessage('Password atualizada.') }
      catch (cause) {
        if (typeof cause === 'object' && cause && 'code' in cause && cause.code === 'reauthentication_needed') setNeedsCode(true)
        setError(getAuthErrorMessage(cause))
      }
    })}>
      <fieldset disabled={form.formState.isSubmitting || sendingCode} className="space-y-4">
        <FormField label="Password atual" type="password" autoComplete="current-password" {...form.register('currentPassword')} error={form.formState.errors.currentPassword?.message} />
        <FormField label="Nova password" type="password" autoComplete="new-password" maxLength={128} {...form.register('password')} error={form.formState.errors.password?.message} />
        <FormField label="Confirmar nova password" type="password" autoComplete="new-password" maxLength={128} {...form.register('confirmPassword')} error={form.formState.errors.confirmPassword?.message} />
        {needsCode && <div className="space-y-3">
          <Button onClick={() => { setSendingCode(true); setError(''); void sendPasswordCode().then(() => setMessage('Código enviado. Consulte o seu email.')).catch((cause) => setError(getAuthErrorMessage(cause))).finally(() => setSendingCode(false)) }}>Enviar código de confirmação</Button>
          <FormField label="Código de confirmação" autoComplete="one-time-code" {...form.register('nonce')} />
        </div>}
        <Button type="submit">{form.formState.isSubmitting ? 'A guardar…' : 'Guardar password'}</Button>
      </fieldset>
      <Link to="/forgot-password" className="block text-sm text-brand underline underline-offset-4">Não me lembro da password</Link>
      {error && <Message error>{error}</Message>}{message && <Message>{message}</Message>}
    </form>
  </section>
}
