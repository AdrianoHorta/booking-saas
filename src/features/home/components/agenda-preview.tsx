const appointments = [
  { time: '09:00', title: 'Consulta inicial', detail: '45 min · Sala 01' },
  { time: '10:30', title: 'Sessão de acompanhamento', detail: '30 min · Sala 02' },
]

export function AgendaPreview() {
  return (
    <figure aria-label="Ilustração de uma agenda de marcações" className="relative mx-auto w-full max-w-lg lg:pt-5">
      <div className="agenda-art relative isolate overflow-hidden rounded-t-[12rem] px-5 pb-10 pt-16 sm:px-10 sm:pb-14 sm:pt-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-0 top-6 -z-10 rounded-t-[12rem] border border-white/40" />
        <p className="editorial-label mb-8 text-center text-ink">Cada marcação, no seu lugar.</p>
        <div className="relative -rotate-2 border border-line bg-surface px-5 py-7 shadow-[0_18px_45px_-20px_#74412366] sm:px-7">
          <div className="flex items-start justify-between gap-3 border-b border-line pb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">A sua agenda</p>
              <p className="mt-2 font-display text-3xl">Quinta-feira</p>
            </div>
            <span aria-hidden="true" className="font-display text-5xl italic text-brand">17</span>
          </div>
          <ol className="mt-6 space-y-6">
            {appointments.map((appointment) => (
              <li key={appointment.time} className="flex items-start gap-3 sm:gap-5">
                <span className="pt-1 text-xs tabular-nums text-muted">{appointment.time}</span>
                <div className="border-l-2 border-brand pl-3 sm:pl-4">
                  <p className="text-sm font-medium">{appointment.title}</p>
                  <p className="mt-1 text-xs text-muted">{appointment.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 border-t border-dashed border-line pt-4 text-xs italic text-muted">Tempo para receber bem.</div>
        </div>
        <div aria-hidden="true" className="relative ml-auto -mt-2 w-fit rotate-3 border border-brand/20 bg-brand px-5 py-4 text-surface shadow-sm">
          <p className="font-display text-xl italic">Tudo a seu tempo.</p>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-[11px] tracking-wide text-muted">Uma agenda com espaço para o que importa.</figcaption>
    </figure>
  )
}
