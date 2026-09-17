import { useState } from 'react'
import { signOut } from '../api/auth-api'
import { getAuthErrorMessage } from '../auth-errors'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'

export function SignOutButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function logout() {
    setError(null)
    setPending(true)
    try { await signOut() }
    catch (cause) { setError(getAuthErrorMessage(cause)) }
    finally { setPending(false) }
  }
  return (
    <div className="space-y-3">
      {error && <Message error>{error}</Message>}
      <Button disabled={pending} onClick={logout}>{pending ? 'A sair…' : 'Terminar sessão'}</Button>
    </div>
  )
}
