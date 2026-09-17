import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginValues } from '../schemas/auth-schemas'
import { signIn } from '../api/auth-api'
import { getAuthErrorMessage } from '../auth-errors'
import { useAuth } from '../auth-context'
import { AuthFrame } from '../components/auth-frame'
import { FormField } from '../../../components/ui/form-field'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'

export function LoginPage() {
  const { session, isLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })
  if (!isLoading && session) return <Navigate to="/dashboard" replace />

  async function submit(values: LoginValues) {
    setError(null)
    try { await signIn(values.email, values.password) }
    catch (cause) { setError(getAuthErrorMessage(cause)) }
  }

  return (
    <AuthFrame title="É bom voltar." description="Entre na sua conta para aceder ao seu espaço de trabalho.">
      <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
        {error && <Message error>{error}</Message>}
        <fieldset disabled={isSubmitting || isLoading} className="space-y-5">
          <FormField label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
          <FormField label="Password" type="password" autoComplete="current-password" {...register('password')} error={errors.password?.message} />
          <Link className="inline-block text-sm text-brand underline underline-offset-4" to="/forgot-password">Esqueceu-se da password?</Link>
          <Button type="submit" className="w-full">{isSubmitting ? 'A entrar…' : isLoading ? 'A verificar sessão…' : 'Entrar'}</Button>
        </fieldset>
      </form>
      <p className="text-sm text-muted">Ainda não tem conta? <Link to="/register" className="text-brand underline underline-offset-4">Criar conta</Link></p>
    </AuthFrame>
  )
}
