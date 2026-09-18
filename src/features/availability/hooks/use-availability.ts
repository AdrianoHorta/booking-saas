import { useQuery } from '@tanstack/react-query'
import { availabilityRequestSchema, getAvailability, type AvailabilityRequest } from '../api/availability-api'

export function useAvailability(request: AvailabilityRequest) {
  return useQuery({
    queryKey: ['availability', request.businessId, request.employeeId, request.serviceId, request.date],
    enabled: availabilityRequestSchema.safeParse(request).success,
    queryFn: ({ signal }) => getAvailability(request, signal),
    staleTime: 0,
    refetchInterval: 30_000,
    retry: false,
  })
}
