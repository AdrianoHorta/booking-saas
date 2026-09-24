import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase/client'

export function isBookingQuery(key: QueryKey, businessId: string, userId: string) {
  if (key[0] === 'reservations') {
    const filters = key[2]
    return key[1] === userId && typeof filters === 'object' && filters !== null &&
      'businessId' in filters && filters.businessId === businessId
  }
  if (key[0] === 'reservation-summary') return key[1] === userId && key[2] === businessId
  return (key[0] === 'availability' || key[0] === 'reschedule-slots') && key[1] === businessId
}

export function useBookingRealtime(businessId: string, userId: string, enabled: boolean) {
  const client = useQueryClient()
  useEffect(() => {
    if (!enabled || !businessId || !userId) return
    const supabase = getSupabase()
    let disposed = false
    let debounce: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      if (disposed) return
      void client.invalidateQueries({ predicate: (query) => isBookingQuery(query.queryKey, businessId, userId) })
    }
    const scheduleRefresh = () => {
      if (disposed || debounce !== undefined) return
      debounce = setTimeout(() => { debounce = undefined; refresh() }, 200)
    }
    const channel = supabase.channel(`booking-revisions:${userId}:${businessId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_revisions', filter: `business_id=eq.${businessId}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'booking_revisions', filter: `business_id=eq.${businessId}` }, scheduleRefresh)
      .subscribe((status) => {
        // Re-read on every connection: events missed while offline are not replayed.
        if (status === 'SUBSCRIBED') scheduleRefresh()
      })
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refresh() }
    // Also covers channel failures and time passing (today/upcoming/deadlines).
    const fallback = setInterval(refreshWhenVisible, 60_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('online', refreshWhenVisible)
    return () => {
      disposed = true
      clearTimeout(debounce)
      clearInterval(fallback)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('online', refreshWhenVisible)
      void supabase.removeChannel(channel)
    }
  }, [businessId, userId, enabled, client])
}
