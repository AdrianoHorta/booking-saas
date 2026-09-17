import { ActionLink } from '../../../components/ui/action-link'
import { FeatureCard } from '../components/feature-card'
import { AgendaPreview } from '../components/agenda-preview'

const features = [
  {
    number: '01',
    title: 'Clareza em cada dia.',
    description: 'Serviços, profissionais e horários reunidos numa agenda pensada para acompanhar o ritmo da sua empresa.',
  },
  {
    number: '02',
    title: 'Uma boa primeira impressão.',
    description: 'Uma experiência de reserva simples e cuidada, desde a escolha do serviço até ao momento de receber o cliente.',
  },
  {
    number: '03',
    title: 'O seu negócio, à sua medida.',
    description: 'Cada empresa com os seus serviços, a sua equipa e o seu espaço. Uma base comum, preparada para diferentes formas de trabalhar.',
  },
]

export function HomePage() {
  return (
    <>
      <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div className="pb-2">
          <p className="editorial-label mb-8 flex items-center gap-3 text-brand">
            <span aria-hidden="true" className="h-px w-8 bg-brand" />
            Reservas com atenção ao detalhe
          </p>
          <h1 className="max-w-2xl font-display text-[clamp(3rem,6.4vw,5.5rem)] font-normal leading-[1.04] tracking-[-0.045em]">
            O tempo é seu.<br />
            <span className="italic text-brand">Cuide do que</span><br />
            <span className="italic text-brand">importa.</span>
          </h1>
          <p className="mt-8 max-w-md text-base leading-8 text-muted">
            Uma forma mais serena de organizar marcações.
            Pensada para quem valoriza o seu trabalho — e o tempo de quem chega.
          </p>
          <div className="mt-9">
            <ActionLink to="/register">Criar conta <span aria-hidden="true">↗</span></ActionLink>
          </div>
          <p className="mt-5 text-xs text-muted">Em desenvolvimento. Reservas disponíveis numa próxima etapa.</p>
        </div>
        <AgendaPreview />
      </div>
      <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-line py-5 text-xs text-muted sm:mt-20">
        <p className="editorial-label text-brand">Diferentes negócios. O mesmo cuidado.</p>
        <p>Saúde & bem-estar</p>
        <span aria-hidden="true" className="text-brand">·</span>
        <p>Beleza & estética</p>
        <span aria-hidden="true" className="text-brand">·</span>
        <p>Serviços & consultoria</p>
      </div>
      <section aria-labelledby="principles-title" className="mt-16 grid gap-10 lg:mt-24 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
        <div>
          <p className="editorial-label mb-5 text-brand">A nossa intenção</p>
          <h2 id="principles-title" className="max-w-sm font-display text-4xl leading-tight tracking-tight sm:text-5xl">Menos ruído.<br /><span className="italic">Mais presença.</span></h2>
          <p className="mt-6 max-w-xs text-sm leading-7 text-muted">Estamos a criar ferramentas que deixam espaço para a parte mais importante do seu negócio: as pessoas.</p>
        </div>
        <div>
          {features.map((feature) => <FeatureCard key={feature.number} {...feature} />)}
        </div>
      </section>
    </>
  )
}
