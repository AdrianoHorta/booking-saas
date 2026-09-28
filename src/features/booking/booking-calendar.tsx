import { useState } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { businessToday } from './booking-date'

export function BookingCalendar({ value, timezone, onSelect }: { value: string; timezone: string; onSelect: (date: string) => void }) {
  const today = businessToday(timezone)
  const [month, setMonth] = useState(() => Temporal.PlainDate.from(value || today).with({ day: 1 }))
  const firstMonth = Temporal.PlainDate.from(today).with({ day: 1 })
  const monthTitle = month.toLocaleString('pt-PT', { month: 'long', year: 'numeric' })
  return <section aria-label="Escolher dia" className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <button type="button" aria-label="Mês anterior" disabled={Temporal.PlainDate.compare(month, firstMonth) <= 0}
        onClick={() => setMonth(month.subtract({ months: 1 }))} className="booking-icon-button disabled:opacity-30">←</button>
      <h3 className="font-medium first-letter:uppercase" aria-live="polite">{monthTitle}</h3>
      <button type="button" aria-label="Mês seguinte" onClick={() => setMonth(month.add({ months: 1 }))} className="booking-icon-button">→</button>
    </div>
    <div className="grid grid-cols-7 gap-y-2 text-center">
      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <span key={day} className="pb-2 text-xs text-muted">{day}</span>)}
      {Array.from({ length: month.dayOfWeek - 1 }, (_, index) => <span key={`empty-${index}`} />)}
      {Array.from({ length: month.daysInMonth }, (_, index) => {
        const day = month.with({ day: index + 1 })
        const iso = day.toString()
        return <button key={iso} type="button" disabled={iso < today} aria-pressed={value === iso}
          aria-current={iso === today ? 'date' : undefined} aria-label={day.toLocaleString('pt-PT', { dateStyle: 'full' })}
          onClick={() => onSelect(iso)} className={`mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-sm transition-colors disabled:cursor-not-allowed disabled:text-muted/45 ${value === iso ? 'bg-brand text-white' : 'hover:enabled:bg-brand-soft aria-[current=date]:border aria-[current=date]:border-brand'}`}>
          {day.day}
        </button>
      })}
    </div>
    <p className="border-t border-line pt-4 text-center text-xs text-muted">Escolha um dia para consultar os horários disponíveis.</p>
  </section>
}
