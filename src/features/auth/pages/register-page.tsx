import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterValues } from '../schemas/auth-schemas'
import { signUp } from '../api/auth-api'
import { getAuthErrorMessage } from '../auth-errors'
import { useAuth } from '../auth-context'
import { AuthFrame } from '../components/auth-frame'
import { FormField } from '../../../components/ui/form-field'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'

export function RegisterPage() {
  const { session, isLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })
  if (!isLoading && session) return <Navigate to="/dashboard" replace />

  async function submit(values: RegisterValues) {
    setError(null)
    try {
      const newSession = await signUp(values.email, values.password)
      reset()
      setSent(!newSession)
    } catch (cause) { setError(getAuthErrorMessage(cause)) }
  }

  return (
    <AuthFrame title="Um novo começo." description="Crie a sua conta. A configuração da empresa será o passo seguinte.">
      {sent ? <Message>Se o registo puder ser concluído, receberá um email com as instruções de confirmação. Se já tem conta, pode entrar ou recuperar a password.</Message> :
        <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
          {error && <Message error>{error}</Message>}
          <fieldset disabled={isSubmitting || isLoading} className="space-y-5">
            <FormField label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
            <FormField label="Password" type="password" autoComplete="new-password" hint="Pelo menos 8 caracteres." {...register('password')} error={errors.password?.message} />
            <FormField label="Confirmar password" type="password" autoComplete="new-password" {...register('confirmPassword')} error={errors.confirmPassword?.message} />
            <Button type="submit" className="w-full">{isSubmitting ? 'A criar conta…' : 'Criar conta'}</Button>
          </fieldset>
        </form>}
      <p className="text-sm text-muted">Já tem conta? <Link to="/login" className="text-brand underline underline-offset-4">Entrar</Link></p>
    </AuthFrame>
  )
}
