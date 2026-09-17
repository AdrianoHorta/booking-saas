import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../auth-context'
import { Message } from '../../../components/feedback/message'

export function ProtectedRoute() {
  const { session, isLoading, error } = useAuth()
  if (isLoading) return <Message>A verificar a sessão…</Message>
  if (error) return <Message error>{error}</Message>
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
