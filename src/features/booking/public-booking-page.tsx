import { useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { Message } from '../../components/feedback/message'
import { PageHeading } from '../../components/ui/page-heading'
import { getPublicAvailability } from '../availability/api/public-availability-api'
import { BookingError, clearPendingBooking, confirmBooking, contactsSchema, getBookingCatalog, loadPendingBooking, savePendingBooking,
  type BookingCatalog, type BookingContacts, type BookingReceipt, type BookingRequest } from './booking-api'

const price = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const dateTime = (instant: string | number, timezone: string) => new Intl.DateTimeFormat('pt-PT', {
  timeZone: timezone, dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(instant))
const selectClass = 'mt-2 min-h-12 w-full rounded-sm border border-line bg-surface px-3 py-3 text-ink'

export function PublicBookingPage() {
  const { slug = '' } = useParams()
  return <BookingFlow key={slug} slug={slug} />
}
function BookingFlow({ slug }: { slug: string }) {
  const [pending, setPending] = useState<BookingRequest | null>(() => loadPendingBooking(slug))
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null)
  const [receiptTimezone, setReceiptTimezone] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState<BookingError | null>(null)
  const catalog = useQuery({ queryKey: ['public-booking-catalog', slug], queryFn: ({ signal }) => getBookingCatalog(slug, signal), retry: false,
    enabled: !pending && !receipt })

  async function submit(request: BookingRequest) {
    if (inFlight.current) return
    try { savePendingBooking(request) } catch {
      setError(new BookingError('invalid', 'Permita o armazenamento nesta aba para podermos recuperar o pedido se a ligação falhar.'))
      return
    }
    inFlight.current = true
    setSending(true); setPending(request); setError(null)
    try {
      const result = await confirmBooking(request)
      setReceipt(result)
      setReceiptTimezone(request.timezone ?? catalog.data?.business.timezone)
      setPending(null)
      try { clearPendingBooking(slug) } catch { /* O mesmo UUID continua seguro para repetição. */ }
    } catch (cause) {
      const failure = cause instanceof BookingError ? cause : new BookingError('uncertain', 'Resultado desconhecido. Verifique novamente o pedido.')
      setError(failure)
      if (failure.kind !== 'uncertain') {
        try { clearPendingBooking(slug) } catch { /* A próxima submissão substituirá este pedido. */ }
        setPending(null)
        void catalog.refetch()
      }
    } finally { inFlight.current = false; setSending(false) }
  }
  if (receipt) return <div className="max-w-2xl space-y-6">
    <PageHeading eyebrow="A sua marcação" title={receipt.status === 'confirmed' ? 'Reserva confirmada.' : 'Reserva cancelada.'}
      description={receipt.status === 'confirmed' ? 'A sua reserva foi guardada. Guarde a referência abaixo.' : 'Este pedido corresponde a uma reserva que entretanto foi cancelada.'} />
    <dl className="space-y-3 rounded-sm border border-line p-6">
      <div><dt>Serviço</dt><dd className="font-medium">{receipt.service_name}</dd></div>
      <div><dt>Profissional</dt><dd className="font-medium">{receipt.employee_name}</dd></div>
      {receiptTimezone ? <><div><dt>Início</dt><dd>{dateTime(receipt.starts_at, receiptTimezone)}</dd></div>
        <div><dt>Fim</dt><dd>{dateTime(receipt.ends_at, receiptTimezone)}</dd></div></>
        : <div><dt>Horário</dt><dd>Consulte o horário com a empresa usando a referência abaixo.</dd></div>}
      <div><dt>Preço</dt><dd>{price(receipt.price_cents)}</dd></div>
      <div><dt>Referência</dt><dd className="break-all">{receipt.id}</dd></div>
    </dl>
    <p className="text-sm text-muted">Não foi enviado email de confirmação. Guarde os dados apresentados nesta página.</p>
    {receipt.cancellation_token && <div className="space-y-3">
      <p>Guarde a ligação privada abaixo para consultar ou cancelar a reserva. O prazo é de {receipt.cancellation_notice_hours} horas antes da marcação.</p>
      <a className="block break-all text-sm text-brand underline" href={`/booking/manage/${receipt.id}#token=${receipt.cancellation_token}`}>
        {`${window.location.origin}/booking/manage/${receipt.id}#token=${receipt.cancellation_token}`}
      </a>
    </div>}
  </div>
  if (pending) return <div className="max-w-2xl space-y-6">
    <PageHeading eyebrow="A sua marcação" title={sending ? 'A confirmar a reserva…' : 'Verificar o pedido anterior.'}
      description="Estamos a usar o mesmo pedido. Não é necessário criar uma nova reserva." />
    {pending.timezone && <p>Horário pedido: {dateTime(pending.startsAt, pending.timezone)}</p>}
    {error && <Message error>{error.message}</Message>}
    <Button disabled={sending} onClick={() => void submit(pending)}>{sending ? 'A confirmar…' : 'Verificar reserva'}</Button>
  </div>
  if (catalog.isPending) return <Message>A carregar os serviços…</Message>
  if (catalog.isError) return <div className="max-w-xl space-y-4"><Message error>{catalog.error.message}</Message>
    <Button disabled={catalog.isFetching} onClick={() => void catalog.refetch()}>Tentar novamente</Button></div>
  return <div className="max-w-3xl space-y-8">
    <PageHeading eyebrow="Reservas online" title={catalog.data.business.name} description="Escolha o serviço e o horário. Depois, reveja os dados e confirme a sua reserva." />
    {error && <Message error>{error.message}</Message>}
    <BookingForm key={`${error?.kind ?? ''}`} catalog={catalog.data} onSubmit={(request) => void submit(request)} />
  </div>
}

function BookingForm({ catalog, onSubmit }: { catalog: BookingCatalog; onSubmit: (request: BookingRequest) => void }) {
  const [serviceId, setServiceId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState<number | null>(null)
  const [review, setReview] = useState<BookingRequest | null>(null)
  const form = useForm<BookingContacts>({ resolver: zodResolver(contactsSchema), defaultValues: { name: '', email: '', phone: '' } })
  const service = catalog.services.find((item) => item.id === serviceId)
  const employee = service?.employees.find((item) => item.id === employeeId)
  const availability = useQuery({ queryKey: ['public-booking-slots', catalog.business.slug, serviceId, employeeId, date],
    queryFn: ({ signal }) => getPublicAvailability({ businessSlug: catalog.business.slug, serviceId, employeeId, date }, signal),
    enabled: Boolean(service && employee && date) && !review, retry: false, staleTime: 0 })
  const selectedSlot = availability.data?.slots.find((slot) => slot.start === start)
  if (!catalog.services.length) return <Message>Não existem serviços disponíveis para reservar neste momento.</Message>
  if (review && service && employee) return <section className="space-y-5" aria-label="Revisão da reserva">
    <h2 className="font-display text-3xl">Reveja a sua reserva</h2>
    <dl className="space-y-3 border-y border-line py-5">
      <div><dt>Serviço</dt><dd>{service.name} · {service.duration_minutes} min · {price(service.price_cents)}</dd></div>
      <div><dt>Profissional</dt><dd>{employee.name}</dd></div>
      <div><dt>Horário</dt><dd>{dateTime(review.startsAt, catalog.business.timezone)}</dd></div>
      <div><dt>Nome</dt><dd>{review.contacts.name}</dd></div>
      <div><dt>Email</dt><dd className="break-all">{review.contacts.email}</dd></div>
      {review.contacts.phone && <div><dt>Telefone</dt><dd>{review.contacts.phone}</dd></div>}
    </dl>
    <p className="text-sm text-muted">A vaga só fica reservada após a confirmação. Os contactos serão partilhados com a empresa para gerir a marcação.</p>
    <p className="text-sm">Pode cancelar pela ligação privada até {catalog.business.cancellation_notice_hours} horas antes da marcação.</p>
    <div className="flex flex-wrap gap-3"><Button onClick={() => onSubmit(review)}>Confirmar reserva</Button>
      <Button onClick={() => setReview(null)}>Editar dados</Button></div>
  </section>
  return <form className="space-y-6" onSubmit={form.handleSubmit((contacts) => {
    if (!selectedSlot || availability.isFetching || availability.isError) return
    setReview({ slug: catalog.business.slug, timezone: catalog.business.timezone, serviceId, employeeId, startsAt: new Date(selectedSlot.start).toISOString(), requestKey: crypto.randomUUID(), contacts })
  })}>
    <label className="block font-medium">Serviço<select className={selectClass} value={serviceId} required onChange={(event) => { setServiceId(event.target.value); setEmployeeId(''); setStart(null) }}>
      <option value="">Escolha um serviço</option>{catalog.services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.duration_minutes} min · {price(item.price_cents)}</option>)}
    </select></label>
    <label className="block font-medium">Profissional<select className={selectClass} value={employeeId} required disabled={!service} onChange={(event) => { setEmployeeId(event.target.value); setStart(null) }}>
      <option value="">Escolha um profissional</option>{service?.employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <FormField label="Data" type="date" required value={date} onChange={(event) => { setDate(event.target.value); setStart(null) }} />
    {service && employee && date && <section className="space-y-3" aria-label="Horários disponíveis">
      {availability.isFetching ? <Message>A consultar vagas…</Message> : availability.isError ? <><Message error>Não foi possível consultar os horários. A seleção pode ter deixado de estar disponível.</Message><Button onClick={() => void availability.refetch()}>Atualizar horários</Button></>
        : availability.data?.slots.length ? <fieldset><legend className="mb-3 font-medium">Escolha um horário</legend><div className="grid gap-3 sm:grid-cols-2">
          {availability.data.slots.map((slot) => <label key={slot.start} className="flex cursor-pointer items-center gap-3 rounded-sm border border-line p-3">
            <input type="radio" name="slot" value={slot.start} checked={start === slot.start} onChange={() => setStart(slot.start)} />
            <span>{dateTime(slot.start, catalog.business.timezone)}</span>
          </label>)}
        </div></fieldset> : <Message>Não existem vagas nesta data. Experimente outro dia.</Message>}
    </section>}
    <fieldset className="space-y-4"><legend className="mb-4 font-display text-2xl">Os seus contactos</legend>
      <FormField label="Nome" autoComplete="name" maxLength={120} {...form.register('name')} error={form.formState.errors.name?.message} />
      <FormField label="Email" type="email" autoComplete="email" maxLength={254} {...form.register('email')} error={form.formState.errors.email?.message} />
      <FormField label="Telefone (opcional)" type="tel" autoComplete="tel" maxLength={40} {...form.register('phone')} error={form.formState.errors.phone?.message} />
    </fieldset>
    <Button type="submit" disabled={!selectedSlot || availability.isFetching || availability.isError}>Rever reserva</Button>
  </form>
}
