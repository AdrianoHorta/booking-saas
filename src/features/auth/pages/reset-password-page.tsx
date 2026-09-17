import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { passwordSchema, type PasswordValues } from '../schemas/auth-schemas'
import { updatePassword } from '../api/auth-api'
import { hasAuthLinkError } from '../../../lib/supabase/client'
import { getAuthErrorMessage } from '../auth-errors'
import { useAuth } from '../auth-context'
import { AuthFrame } from '../components/auth-frame'
import { FormField } from '../../../components/ui/form-field'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'
import { ActionLink } from '../../../components/ui/action-link'

export function ResetPasswordPage() {
  const { session, isLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })

  async function submit(values: PasswordValues) {
    setError(null)
    try {
      await updatePassword(values.password)
      reset()
      setSaved(true)
    } catch (cause) { setError(getAuthErrorMessage(cause)) }
  }

  return (
    <AuthFrame title="Uma nova password." description="Escolha uma password segura para continuar a cuidar do seu negócio.">
      {isLoading ? <Message>A verificar o acesso…</Message> :
        hasAuthLinkError || !session ? <>
          <Message error>O link não é válido, expirou ou já foi utilizado. Peça um novo link para recuperar o acesso.</Message>
          <Link to="/forgot-password" className="inline-block text-sm text-brand underline underline-offset-4">Pedir novo link</Link>
        </> : saved ? <>
          <Message>Password atualizada. A sua sessão neste dispositivo continua ativa.</Message>
          <ActionLink to="/dashboard">Continuar</ActionLink>
        </> :
          <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
            {error && <Message error>{error}</Message>}
            <fieldset disabled={isSubmitting} className="space-y-5">
              <FormField label="Nova password" type="password" autoComplete="new-password" hint="Pelo menos 8 caracteres." {...register('password')} error={errors.password?.message} />
              <FormField label="Confirmar password" type="password" autoComplete="new-password" {...register('confirmPassword')} error={errors.confirmPassword?.message} />
              <Button type="submit" className="w-full">{isSubmitting ? 'A guardar…' : 'Guardar password'}</Button>
            </fieldset>
          </form>}
    </AuthFrame>
  )
}
