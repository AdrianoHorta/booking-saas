import { Avatar } from '../../components/ui/avatar'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { Message } from '../../components/feedback/message'
import { getPublicAvailability } from '../availability/api/public-availability-api'
import { contactsSchema, type BookingCatalog, type BookingContacts, type BookingRequest } from './booking-api'
import { BookingCalendar } from './booking-calendar'

const price = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const stages = ['Serviço', 'Profissional', 'Dia', 'Hora', 'Contactos', 'Confirmar']
const titles = ['Escolha o seu cuidado.', 'Com quem vai ser?', 'Qual é o melhor dia?', 'Reserve o seu momento.', 'Vamos conhecer-nos.', 'Está quase marcado.']

export function BookingForm({ catalog, onSubmit }: { catalog: BookingCatalog; onSubmit: (request: BookingRequest) => void }) {
  const [step, setStep] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const [serviceId, setServiceId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState<number | null>(null)
  const [review, setReview] = useState<BookingRequest | null>(null)
  const form = useForm<BookingContacts>({ resolver: zodResolver(contactsSchema), defaultValues: { name: '', email: '', phone: '' } })
  const service = catalog.services.find((item) => item.id === serviceId)
  const employee = service?.employees.find((item) => item.id === employeeId)
  const timezone = catalog.business.timezone
  const time = (instant: number) => new Intl.DateTimeFormat('pt-PT', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(instant)
  const fullDate = (instant: string | number) => new Intl.DateTimeFormat('pt-PT', { timeZone: timezone, dateStyle: 'long', timeStyle: 'short' }).format(new Date(instant))
  const availability = useQuery({ queryKey: ['public-booking-slots', catalog.business.slug, serviceId, employeeId, date],
    queryFn: ({ signal }) => getPublicAvailability({ businessSlug: catalog.business.slug, serviceId, employeeId, date }, signal),
    enabled: Boolean(service && employee && date) && step >= 3 && step < 5, retry: false, staleTime: 0 })
  const selectedSlot = availability.data?.slots.find((slot) => slot.start === start)
  const canContinue = Boolean(selectedSlot) && !availability.isFetching && !availability.isError
  useEffect(() => { heading.current?.focus() }, [step])
  function goBack() { setReview(null); setStep((current) => Math.max(0, current - 1)) }

  return <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_16px_60px_-32px_#35291f55]" aria-label="Nova marcação">
    <div className="border-b border-line px-5 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        {step > 0 ? <button type="button" onClick={goBack} aria-label="Voltar ao passo anterior" className="booking-icon-button">←</button>
          : <span className="editorial-label text-brand">Nova marcação</span>}
        <span className="text-xs text-muted">Passo {step + 1} de {stages.length}</span>
      </div>
      <h2 ref={heading} tabIndex={-1} className="font-display text-3xl tracking-tight focus:outline-none sm:text-4xl">{titles[step]}</h2>
      <ol aria-label="Passos da reserva" className="mt-6 grid grid-cols-6 gap-2">
        {stages.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}>
          <span className={`block h-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-line'}`} />
          <span className={`mt-2 hidden text-[10px] sm:block ${step === index ? 'font-semibold text-brand' : 'text-muted'}`}>{label}</span>
          <span className="sr-only sm:hidden">{label}</span>
        </li>)}
      </ol>
    </div>
    {service && step > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-brand-soft/40 px-5 py-3 text-xs sm:px-8">
      <span>{service.name}{employee && step > 1 ? ` · ${employee.name}` : ''}</span>
      <span className="font-medium">{service.duration_minutes} min · {price(service.price_cents)}</span>
    </div>}
    <div className="p-5 sm:p-8">
      {step === 0 && <div className="space-y-3">
        <p className="mb-5 text-sm text-muted">Encontre o serviço certo para si.</p>
        {!catalog.services.length && <Message>Não existem serviços disponíveis para reservar neste momento.</Message>}
        {catalog.services.map((item) => <button key={item.id} type="button" className="booking-choice" onClick={() => {
          setServiceId(item.id); setEmployeeId(''); setDate(''); setStart(null); setStep(1)
        }}>
          <span className="min-w-0 flex-1"><span className="block font-medium">{item.name}</span><span className="mt-1 block text-xs text-muted">{item.duration_minutes} minutos</span></span>
          <span className="shrink-0 text-sm font-medium text-brand">{price(item.price_cents)}</span><span aria-hidden="true" className="text-brand">↗</span>
        </button>)}
      </div>}
      {step === 1 && <div className="space-y-3">
        <p className="mb-5 text-sm text-muted">Escolha quem vai cuidar de si.</p>
        {service?.employees.map((item) => <button key={item.id} type="button" className="booking-choice" onClick={() => {
          setEmployeeId(item.id); setDate(''); setStart(null); setStep(2)
        }}>
          <Avatar name={item.name} path={item.avatar_path} className="size-11 text-xl" />
          <span className="flex-1 font-medium">{item.name}</span><span aria-hidden="true" className="text-brand">→</span>
        </button>)}
      </div>}
      {step === 2 && <BookingCalendar value={date} timezone={timezone} onSelect={(value) => { setDate(value); setStart(null); setStep(3) }} />}
      {step === 3 && <section className="space-y-5" aria-label="Horários disponíveis">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="font-medium">{new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</p>
          <button type="button" onClick={() => setStep(2)} className="min-h-11 text-brand underline underline-offset-4">Alterar dia</button>
        </div>
        {availability.isFetching ? <Message>A consultar vagas…</Message> : availability.isError ? <>
          <Message error>Não foi possível consultar os horários. A seleção pode ter deixado de estar disponível.</Message><Button onClick={() => void availability.refetch()}>Atualizar horários</Button>
        </> : availability.data?.slots.length ? <fieldset className="space-y-5"><legend className="sr-only">Escolha um horário</legend>
          {['Manhã', 'Tarde', 'Noite'].map((period, index) => {
            const slots = availability.data.slots.filter((slot) => { const hour = Number(time(slot.start).split(':')[0]); return (hour < 12 ? 0 : hour < 18 ? 1 : 2) === index })
            if (!slots.length) return null
            return <div key={period}><h3 className="mb-3 text-xs font-medium text-muted">{period}</h3><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => <label key={slot.start} className={`relative flex min-h-12 cursor-pointer items-center justify-center rounded-md border text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${start === slot.start ? 'border-brand bg-brand text-white' : 'border-line hover:border-brand hover:bg-brand-soft'}`}>
                <input className="absolute inset-0 size-full cursor-pointer opacity-0" type="radio" name="slot" value={slot.start} checked={start === slot.start} onChange={() => setStart(slot.start)} />
                {time(slot.start)}
              </label>)}
            </div></div>
          })}
        </fieldset> : <Message>Não existem vagas nesta data. Experimente outro dia.</Message>}
        <p className="text-xs text-muted">Hora local do estabelecimento · {timezone}</p>
        <Button className="w-full" disabled={!canContinue} onClick={() => setStep(4)}>Continuar</Button>
      </section>}
      {step === 4 && <form className="space-y-5" onSubmit={form.handleSubmit((contacts) => {
        if (!selectedSlot || !canContinue) return
        setReview({ slug: catalog.business.slug, timezone, serviceId, employeeId, startsAt: new Date(selectedSlot.start).toISOString(), requestKey: crypto.randomUUID(), contacts }); setStep(5)
      })}>
        {start !== null && <p className="text-sm text-muted">{fullDate(start)}</p>}
        <FormField label="Nome" autoComplete="name" maxLength={120} {...form.register('name')} error={form.formState.errors.name?.message} />
        <FormField label="Email" type="email" autoComplete="email" maxLength={254} {...form.register('email')} error={form.formState.errors.email?.message} />
        <FormField label="Telefone (opcional)" type="tel" autoComplete="tel" maxLength={40} {...form.register('phone')} error={form.formState.errors.phone?.message} />
        <p className="text-xs text-muted">Os seus contactos serão partilhados com a empresa para gerir a marcação.</p>
        {availability.isError && <Message error>Não foi possível atualizar os horários. Volte ao passo anterior e tente novamente.</Message>}
        {!availability.isFetching && !availability.isError && !selectedSlot && <Message error>Este horário deixou de estar disponível. Volte atrás e escolha outra hora.</Message>}
        <Button type="submit" className="w-full" disabled={!canContinue}>Rever reserva</Button>
      </form>}
      {step === 5 && review && service && employee && <section className="space-y-5" aria-label="Revisão da reserva">
        <h3 className="font-display text-2xl">Reveja a sua reserva</h3>
        <dl className="divide-y divide-line text-sm">
          {[['Serviço', service.name], ['Profissional', employee.name], ['Horário', fullDate(review.startsAt)], ['Duração', `${service.duration_minutes} minutos`], ['Nome', review.contacts.name], ['Email', review.contacts.email], ...(review.contacts.phone ? [['Telefone', review.contacts.phone]] : [])].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-5 gap-y-1 py-3"><dt className="text-muted">{label}</dt><dd className="break-words font-medium [overflow-wrap:anywhere]">{value}</dd></div>)}
          <div className="flex items-center justify-between py-4"><dt>Total</dt><dd className="font-display text-3xl text-brand">{price(service.price_cents)}</dd></div>
        </dl>
        <p className="text-xs text-muted">A vaga só fica reservada após a confirmação. Pode cancelar pela ligação privada até {catalog.business.cancellation_notice_hours} horas antes da marcação.</p>
        <Button className="w-full" onClick={() => onSubmit(review)}>Confirmar reserva</Button>
        <button type="button" onClick={() => { setReview(null); setStep(4) }} className="min-h-11 w-full text-sm text-brand underline underline-offset-4">Editar dados</button>
      </section>}
    </div>
  </section>
}
