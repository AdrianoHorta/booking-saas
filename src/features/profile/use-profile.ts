import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context'
import { getMyProfile } from './profile-api'

export function useProfile() {
  const { session } = useAuth()
  return useQuery({ queryKey: ['profile', session?.user.id], enabled: Boolean(session), retry: false,
    queryFn: ({ signal }) => getMyProfile(signal) })
}
