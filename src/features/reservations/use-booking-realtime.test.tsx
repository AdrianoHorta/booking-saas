// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isBookingQuery, useBookingRealtime } from './use-booking-realtime'

const mocks = vi.hoisted(() => ({ channel: vi.fn(), removeChannel: vi.fn() }))
vi.mock('../../lib/supabase/client', () => ({ getSupabase: () => mocks }))
let events: Array<() => void>
let status: (value: string) => void
let client: QueryClient
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  events = []
  const channel = {
    on: vi.fn((_type, _filter, callback) => { events.push(callback); return channel }),
    subscribe: vi.fn((callback) => { status = callback; return channel }),
  }
  mocks.channel.mockReturnValue(channel)
  client = new QueryClient()
})
afterEach(() => { cleanup(); client.clear(); vi.useRealTimers() })
function setup(enabled = true) {
  return renderHook(({ businessId }) => useBookingRealtime(businessId, 'user-a', enabled), {
    initialProps: { businessId: 'business-a' },
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
}
it('refreshes only matching tenant and account queries, coalescing bursts', async () => {
  const own = ['reservations', 'user-a', { businessId: 'business-a' }]
  const otherBusiness = ['reservations', 'user-a', { businessId: 'business-b' }]
  const otherUser = ['reservation-summary', 'user-b', 'business-a']
  const slots = ['reschedule-slots', 'business-a', 'booking-a']
  for (const key of [own, otherBusiness, otherUser, slots]) client.setQueryData(key, [])
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  setup()
  await act(async () => { events[0](); events[1](); events[1](); vi.advanceTimersByTime(200) })
  expect(invalidate).toHaveBeenCalledTimes(1)
  expect(client.getQueryState(own)?.isInvalidated).toBe(true)
  expect(client.getQueryState(slots)?.isInvalidated).toBe(true)
  expect(client.getQueryState(otherBusiness)?.isInvalidated).toBe(false)
  expect(client.getQueryState(otherUser)?.isInvalidated).toBe(false)
})
it('refreshes on connections, fallback, and returning online', async () => {
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  setup()
  await act(async () => { status('SUBSCRIBED'); vi.advanceTimersByTime(200) })
  await act(async () => { status('CHANNEL_ERROR'); vi.advanceTimersByTime(60_000) })
  await act(async () => { status('SUBSCRIBED'); vi.advanceTimersByTime(200) })
  await act(async () => { window.dispatchEvent(new Event('online')) })
  expect(invalidate).toHaveBeenCalledTimes(4)
})
it('removes old channel and ignores late events when changing business or leaving', async () => {
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { rerender, unmount } = setup()
  const oldEvent = events[0]
  act(() => { oldEvent() })
  rerender({ businessId: 'business-b' })
  expect(mocks.removeChannel).toHaveBeenCalledTimes(1)
  unmount()
  await act(async () => { oldEvent(); status('SUBSCRIBED'); vi.advanceTimersByTime(120_000) })
  expect(mocks.removeChannel).toHaveBeenCalledTimes(2)
  expect(invalidate).not.toHaveBeenCalled()
})
it('does not subscribe before business access is confirmed', () => {
  setup(false)
  expect(mocks.channel).not.toHaveBeenCalled()
})
it('matches availability and rejects unrelated or malformed cache keys', () => {
  expect(isBookingQuery(['availability', 'business-a'], 'business-a', 'user-a')).toBe(true)
  expect(isBookingQuery(['business', 'user-a', 'business-a'], 'business-a', 'user-a')).toBe(false)
  expect(isBookingQuery(['reservations', 'user-a', null], 'business-a', 'user-a')).toBe(false)
})
