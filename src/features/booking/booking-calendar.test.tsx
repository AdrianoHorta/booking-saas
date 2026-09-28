// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BookingCalendar } from './booking-calendar'
import { businessToday } from './booking-date'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('uses the business timezone at a day boundary', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2099-01-02T00:30:00Z'))
  expect(businessToday('America/New_York')).toBe('2099-01-01')
  expect(businessToday('Europe/Lisbon')).toBe('2099-01-02')
})

it('blocks past days and emits the chosen local date across a month boundary', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2099-01-31T12:00:00Z'))
  const onSelect = vi.fn()
  render(<BookingCalendar value="" timezone="Europe/Lisbon" onSelect={onSelect} />)
  const yesterday = screen.getByRole('button', { name: /, 30 de janeiro de 2099/ }) as HTMLButtonElement
  expect(yesterday.disabled).toBe(true)
  fireEvent.click(yesterday)
  expect(onSelect).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }))
  fireEvent.click(screen.getByRole('button', { name: /, 1 de fevereiro de 2099/ }))
  expect(onSelect).toHaveBeenCalledWith('2099-02-01')
})
