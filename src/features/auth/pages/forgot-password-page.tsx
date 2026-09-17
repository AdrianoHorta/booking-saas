import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { emailSchema, type EmailValues } from '../schemas/auth-schemas'
import { requestPasswordReset } from '../api/auth-api'
import { getAuthErrorMessage } from '../auth-errors'
import { AuthFrame } from '../components/auth-frame'
import { FormField } from '../../../components/ui/form-field'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'

export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EmailValues>({ resolver: zodResolver(emailSchema) })
  async function submit(values: EmailValues) {
    setError(null)
    try {
      await requestPasswordReset(values.email)
      reset()
      setSent(true)
    } catch (cause) { setError(getAuthErrorMessage(cause)) }
  }

  return (
    <AuthFrame title="Recuperar o acesso." description="Vamos enviar-lhe as instruções para escolher uma nova password.">
      {sent ? <Message>Se existir uma conta associada a esse email, receberá um link de recuperação. Verifique também a pasta de spam.</Message> :
        <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
          {error && <Message error>{error}</Message>}
          <fieldset disabled={isSubmitting} className="space-y-5">
            <FormField label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
            <Button type="submit" className="w-full">{isSubmitting ? 'A enviar…' : 'Enviar instruções'}</Button>
          </fieldset>
        </form>}
      <Link to="/login" className="inline-block text-sm text-brand underline underline-offset-4">Voltar ao login</Link>
    </AuthFrame>
  )
}
