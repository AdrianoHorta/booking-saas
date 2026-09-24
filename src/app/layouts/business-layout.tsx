import { Outlet, useParams } from 'react-router'
import { useAuth } from '../../features/auth/auth-context'
import { useBusiness } from '../../features/businesses/hooks/use-businesses'
import { useBookingRealtime } from '../../features/reservations/use-booking-realtime'

export function BusinessLayout() {
  const { businessId = '' } = useParams()
  const { session } = useAuth()
  const business = useBusiness(businessId)
  useBookingRealtime(businessId, session?.user.id ?? '', Boolean(business.data) && !business.isError)
  return <Outlet />
}
