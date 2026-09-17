import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'

function AccountQueryScope({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
      mutations: { retry: false },
    },
  }))
  useEffect(() => () => client.clear(), [client])
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  // Uma mudança de identidade desmonta todo o cache e os consumidores anteriores.
  return <AccountQueryScope key={session?.user.id ?? 'guest'}>{children}</AccountQueryScope>
}
