import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  createService,
  getServices,
  updateService,
} from '../api/services-api'

export function useServices(businessId: string) {
  return useQuery({
    queryKey: ['services', businessId],
    queryFn: () => getServices(businessId),
    enabled: Boolean(businessId),
  })
}

export function useCreateService(businessId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createService,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['services', businessId],
      })
    },
  })
}

export function useUpdateService(businessId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateService,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['services', businessId],
      })
    },
  })
}