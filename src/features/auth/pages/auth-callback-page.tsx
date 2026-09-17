import { Navigate } from 'react-router'
import { useAuth } from '../auth-context'
import { hasAuthLinkError } from '../../../lib/supabase/client'
import { AuthFrame } from '../components/auth-frame'
import { Message } from '../../../components/feedback/message'
import { ActionLink } from '../../../components/ui/action-link'

export function AuthCallbackPage() {
  const { session, isLoading } = useAuth()
  if (!isLoading && session && !hasAuthLinkError) return <Navigate to="/dashboard" replace />
  return (
    <AuthFrame title="Confirmar o acesso." description="Estamos a verificar o resultado da confirmação do seu email.">
      {isLoading ? <Message>A verificar a sessão…</Message> : <>
        <Message error>Não foi possível concluir a confirmação. O link pode ter expirado ou já ter sido utilizado. Se já confirmou o email, tente entrar.</Message>
        <ActionLink to="/login">Ir para o login</ActionLink>
      </>}
    </AuthFrame>
  )
}
