import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { Dialog } from '../../components/ui/dialog'
import { Message } from '../../components/feedback/message'
import { cancel, canCancel, dates, move, professionals, reserve, restore, seed, services, slots, storageKey, type DemoBooking, type DemoState } from './demo-model'

const selectClass = 'mt-2 block min-h-12 w-full rounded-sm border border-line bg-surface px-3'
const format = (start: number) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'medium', timeStyle: 'short' }).format(start)
const money = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
type Edit = { kind: 'cancel' | 'move'; booking: DemoBooking } | { kind: 'reset' }

export default function DemoPage() {
  const [state, setState] = useState(() => { try { return restore(sessionStorage.getItem(storageKey)) } catch { return seed() } })
  const [view, setView] = useState<'client' | 'company' | 'employee'>('client')
  const [professional, setProfessional] = useState<DemoBooking['professional']>('miguel')
  const [edit, setEdit] = useState<Edit | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [temporary, setTemporary] = useState(false)
  const [generation, setGeneration] = useState(0)
  useEffect(() => { document.title = 'Demonstração · Booking SaaS' }, [])
  function commit(operation: (value: DemoState) => DemoState, message: string) {
    try {
      const next = operation(state)
      setState(next); setNotice(message); setError(''); setEdit(null)
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); setTemporary(false) } catch { setTemporary(true) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o exemplo.') }
  }
  const clientBooking = state.bookings.find((booking) => booking.id === state.clientBookingId)
  const selectedProfessional = view === 'employee' ? 'miguel' : professional
  const agenda = state.bookings.filter((booking) => booking.professional === selectedProfessional).sort((a, b) => a.start - b.start)
  const confirmed = agenda.filter((booking) => booking.status === 'confirmed').length
  function card(booking: DemoBooking, showProfessional: boolean, allowMove: boolean) {
    return <article key={booking.id} aria-label={`Reserva de ${booking.client}`} className="space-y-3 rounded-sm border border-line bg-surface p-5">
      <div className="flex flex-wrap justify-between gap-3"><h3 className="font-display text-2xl">{services.find((service) => service.id === booking.service)?.name}</h3><span className="text-sm">{booking.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}</span></div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-muted">Início</dt><dd>{format(booking.start)}</dd></div>
        <div><dt className="text-muted">Duração</dt><dd>{booking.minutes} min</dd></div>
        {showProfessional && <div><dt className="text-muted">Profissional</dt><dd>{professionals.find((person) => person.id === booking.professional)?.name}</dd></div>}
        <div><dt className="text-muted">Cliente</dt><dd className="break-words">{booking.client}</dd></div>
      </dl>
      <p className="border-t border-line pt-3 text-right text-2xl font-semibold text-brand">{money(booking.cents)}</p>
      {booking.status === 'confirmed' && <div className="flex flex-wrap gap-3">
        {allowMove && <Button onClick={() => { setError(''); setEdit({ kind: 'move', booking }) }}>Reagendar reserva</Button>}
        {canCancel(booking) ? <Button onClick={() => { setError(''); setEdit({ kind: 'cancel', booking }) }}>Cancelar reserva</Button>
          : <p className="text-sm text-muted">O prazo de cancelamento terminou.</p>}
      </div>}
    </article>
  }
  return <div className="min-h-svh bg-canvas text-ink">
    <a href="#demo-main" className="sr-only focus:not-sr-only">Saltar para o conteúdo</a>
    <header className="border-b border-line"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
      <span className="font-display text-2xl">booking SaaS</span><a href="/" className="text-sm text-brand underline underline-offset-4">Sair da demonstração</a>
    </div></header>
    <main id="demo-main" className="mx-auto max-w-6xl space-y-7 px-6 py-10 sm:px-12">
      <section aria-label="Modo de demonstração" className="space-y-3 rounded-sm border border-brand bg-brand-soft p-5">
        <p className="font-semibold text-brand">Demonstração · dados fictícios</p>
        <p className="text-sm">Experimente nesta aba, sem criar conta. As alterações ficam apenas neste browser e não afetam reservas reais. Não são enviados emails nem eventos ao Google.</p>
        <Button onClick={() => { setError(''); setEdit({ kind: 'reset' }) }}>Repor exemplos</Button>
      </section>
      <div><p className="editorial-label text-brand">Barbearia Horizonte · exemplo</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Uma reserva, de ambos os lados.</h1>
        <p className="mt-4 text-muted">Faça uma marcação como cliente e veja-a aparecer na agenda da equipa.</p></div>
      <nav aria-label="Perspetiva da demonstração" className="flex flex-wrap gap-3">
        {([['client', 'Cliente'], ['company', 'Empresa'], ['employee', 'Agenda do Miguel']] as const).map(([value, label]) => <button key={value} aria-pressed={view === value}
          className={`min-h-12 rounded-sm border px-5 py-3 text-sm ${view === value ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}
          onClick={() => { setView(value); setNotice(''); setError('') }}>{label}</button>)}
      </nav>
      {temporary && <Message>As alterações serão mantidas apenas até sair desta página, porque o browser não permitiu guardá-las.</Message>}
      {notice && <Message>{notice}</Message>}
      {error && !edit && <Message error>{error}</Message>}
      {view === 'client' ? <section className="max-w-2xl space-y-5">
        <h2 className="font-display text-3xl">{clientBooking ? 'A sua reserva de demonstração' : 'Experimentar uma reserva'}</h2>
        <p className="text-sm text-muted">Nos exemplos, o cancelamento é permitido até 12 horas antes. Na app, cada empresa configura esse prazo.</p>
        {clientBooking ? <>{card(clientBooking, true, false)}<Button onClick={() => commit((current) => ({ ...current, clientBookingId: null }), '')}>Fazer outra reserva</Button></>
          : <BookingForm key={generation} state={state} onSubmit={(input) => commit((current) => reserve(current, input), 'Reserva de demonstração confirmada. Consulte-a também na agenda da equipa.')} />}
      </section> : <section className="space-y-5">
        {view === 'company' && <div className="rounded-sm border border-line p-5"><h2 className="mb-3 font-display text-2xl">Colaboradores</h2><div className="flex flex-wrap gap-3">
          {professionals.map((person) => <Button key={person.id} aria-pressed={professional === person.id} onClick={() => setProfessional(person.id)}>{person.name}</Button>)}
        </div></div>}
        <h2 className="font-display text-3xl">{view === 'employee' ? 'As minhas reservas' : `Reservas da empresa - ${professionals.find((person) => person.id === professional)?.name}`}</h2>
        <p className="text-muted">{confirmed} {confirmed === 1 ? 'reserva confirmada' : 'reservas confirmadas'} nos exemplos desta agenda.</p>
        <div className="grid items-start gap-4 lg:grid-cols-2">{agenda.map((booking) => card(booking, view === 'company', true))}</div>
      </section>}
      {edit && <Dialog label={edit.kind === 'reset' ? 'Repor demonstração' : edit.kind === 'cancel' ? 'Cancelar reserva' : 'Reagendar reserva'} onClose={() => { setEdit(null); setError('') }}>
        {edit.kind === 'move' ? <MoveForm state={state} booking={edit.booking} onSubmit={(date, start) => commit((current) => move(current, edit.booking.id, date, start), 'Reserva de demonstração reagendada.')} />
          : <div className="space-y-4"><h2 className="font-display text-3xl">{edit.kind === 'reset' ? 'Repor os exemplos iniciais?' : 'Cancelar esta reserva?'}</h2>
            <p>{edit.kind === 'reset' ? 'As alterações desta demonstração serão apagadas. As contas e reservas reais mantêm-se.' : 'A vaga ficará novamente disponível na demonstração.'}</p>
            <Button onClick={() => {
              if (edit.kind === 'reset') { commit(() => seed(), 'Exemplos repostos.'); setGeneration((value) => value + 1) }
              else commit((current) => cancel(current, edit.booking.id), 'Reserva de demonstração cancelada.')
            }}>{edit.kind === 'reset' ? 'Confirmar reposição' : 'Confirmar cancelamento'}</Button>
          </div>}
        {error && <div className="mt-4"><Message error>{error}</Message></div>}
        <div className="mt-4"><Button onClick={() => { setEdit(null); setError('') }}>Voltar sem alterar</Button></div>
      </Dialog>}
    </main>
  </div>
}

type BookingInput = Parameters<typeof reserve>[1]
function BookingForm({ state, onSubmit }: { state: DemoState; onSubmit: (input: BookingInput) => void }) {
  const [professional, setProfessional] = useState<DemoBooking['professional']>('miguel')
  const [service, setService] = useState<DemoBooking['service']>('corte')
  const [date, setDate] = useState(dates()[0])
  const [start, setStart] = useState('')
  const [client, setClient] = useState('Cliente de exemplo')
  const [review, setReview] = useState(false)
  const available = slots(state, professional, service, date)
  const selectedService = services.find((item) => item.id === service)!
  const valid = available.includes(Number(start)) && Boolean(client.trim())
  if (review) return <div className="space-y-4 rounded-sm border border-line p-5">
    <h3 className="font-display text-2xl">Rever reserva</h3><p>{selectedService.name} · {selectedService.minutes} min · {money(selectedService.cents)}</p>
    <p>{professionals.find((person) => person.id === professional)?.name} · {format(Number(start))}</p><p className="break-words">{client}</p>
    <div className="flex flex-wrap gap-3"><Button disabled={!valid} onClick={() => onSubmit({ professional, service, date, start: Number(start), client })}>Confirmar reserva de demonstração</Button><Button onClick={() => setReview(false)}>Editar dados</Button></div>
  </div>
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid) setReview(true) }}>
    <label className="block text-sm font-medium">Serviço<select className={selectClass} value={service} onChange={(event) => { setService(event.target.value as DemoBooking['service']); setStart('') }}>
      {services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.minutes} min · {money(item.cents)}</option>)}</select></label>
    <label className="block text-sm font-medium">Profissional<select className={selectClass} value={professional} onChange={(event) => { setProfessional(event.target.value as DemoBooking['professional']); setStart('') }}>
      {professionals.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <DateSelect value={date} onChange={(value) => { setDate(value); setStart('') }} />
    <SlotSelect values={available} value={start} onChange={setStart} />
    <FormField label="Nome fictício" value={client} maxLength={80} required onChange={(event) => setClient(event.target.value)} />
    <Button type="submit" disabled={!valid}>Rever reserva</Button>
  </form>
}
function DateSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium">Data<select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
    {dates().map((date) => <option key={date} value={date}>{date.split('-').reverse().join('/')}</option>)}</select></label>
}
function SlotSelect({ values, value, onChange }: { values: number[]; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium">Horário<select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">{values.length ? 'Escolha um horário' : 'Sem vagas nesta data'}</option>{values.map((start) => <option key={start} value={start}>{format(start)}</option>)}</select></label>
}
function MoveForm({ state, booking, onSubmit }: { state: DemoState; booking: DemoBooking; onSubmit: (date: string, start: number) => void }) {
  const [date, setDate] = useState(dates()[0])
  const [start, setStart] = useState('')
  const available = slots(state, booking.professional, booking.service, date, booking.id).filter((slot) => slot !== booking.start)
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (available.includes(Number(start))) onSubmit(date, Number(start)) }}>
    <h2 className="font-display text-3xl">Reagendar reserva</h2><p>Horário atual: {format(booking.start)}. O preço e a duração mantêm-se.</p>
    <DateSelect value={date} onChange={(value) => { setDate(value); setStart('') }} /><SlotSelect values={available} value={start} onChange={setStart} />
    <Button type="submit" disabled={!available.includes(Number(start))}>Confirmar novo horário</Button>
  </form>
}
