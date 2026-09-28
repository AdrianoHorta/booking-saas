import { useRef, useState } from 'react'
import { useParams } from 'react-router'
import { BookingForm } from './booking-form'
import { BusinessIdentity } from './business-identity'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/button'
import { Message } from '../../components/feedback/message'
import { PageHeading } from '../../components/ui/page-heading'
import { BookingError, clearPendingBooking, confirmBooking, getBookingCatalog, loadPendingBooking, savePendingBooking,
  type BookingReceipt, type BookingRequest } from './booking-api'

const price = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const dateTime = (instant: string | number, timezone: string) => new Intl.DateTimeFormat('pt-PT', {
  timeZone: timezone, dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(instant))


export function PublicBookingPage() {
  const { slug = '' } = useParams()
  return <div className="mx-auto w-full max-w-xl"><BookingFlow key={slug} slug={slug} /></div>
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
  if (receipt) return <div className="space-y-6 rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
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
    <p className="text-sm text-muted">Guarde os dados e a ligação privada apresentados nesta página. Se a empresa tiver emails ativos, a confirmação será também processada por email.</p>
    {receipt.cancellation_token && <div className="space-y-3">
      <p>Guarde a ligação privada abaixo para consultar ou cancelar a reserva. O prazo é de {receipt.cancellation_notice_hours} horas antes da marcação.</p>
      <a className="block break-all text-sm text-brand underline" href={`/booking/manage/${receipt.id}#token=${receipt.cancellation_token}`}>
        {`${window.location.origin}/booking/manage/${receipt.id}#token=${receipt.cancellation_token}`}
      </a>
    </div>}
  </div>
  if (pending) return <div className="space-y-6 rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
    <PageHeading eyebrow="A sua marcação" title={sending ? 'A confirmar a reserva…' : 'Verificar o pedido anterior.'}
      description="Estamos a usar o mesmo pedido. Não é necessário criar uma nova reserva." />
    {pending.timezone && <p>Horário pedido: {dateTime(pending.startsAt, pending.timezone)}</p>}
    {error && <Message error>{error.message}</Message>}
    <Button disabled={sending} onClick={() => void submit(pending)}>{sending ? 'A confirmar…' : 'Verificar reserva'}</Button>
  </div>
  if (catalog.isPending) return <Message>A carregar os serviços…</Message>
  if (catalog.isError) return <div className="max-w-xl space-y-4"><Message error>{catalog.error.message}</Message>
    <Button disabled={catalog.isFetching} onClick={() => void catalog.refetch()}>Tentar novamente</Button></div>
  return <div className="space-y-6">
    <BusinessIdentity key={catalog.data.business.logo_path} name={catalog.data.business.name} logo={catalog.data.business.logo_path} />
    {error && <Message error>{error.message}</Message>}
    <BookingForm key={`${error?.kind ?? ''}`} catalog={catalog.data} onSubmit={(request) => void submit(request)} />
  </div>
}
