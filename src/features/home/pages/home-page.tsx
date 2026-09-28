import { ActionLink } from '../../../components/ui/action-link'
import { FeatureCard } from '../components/feature-card'
import { AgendaPreview } from '../components/agenda-preview'
import { useAuth } from '../../auth/auth-context'

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
  const { session } = useAuth()
  const startPath = session ? '/dashboard' : '/register'
  const startLabel = session ? 'Ir para os meus negócios' : 'Criar conta'
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
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <ActionLink to={startPath}>{startLabel} <span aria-hidden="true">↗</span></ActionLink>
            <ActionLink to="/features" variant="secondary">Conhecer funcionalidades</ActionLink>
          </div>
          <p className="mt-5 text-xs text-muted">A sua equipa, os seus serviços e as suas reservas. Num só lugar.</p>
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
          <p className="editorial-label mb-5 text-brand">Ao ritmo do seu negócio</p>
          <h2 id="principles-title" className="max-w-sm font-display text-4xl leading-tight tracking-tight sm:text-5xl">Menos ruído.<br /><span className="italic">Mais presença.</span></h2>
          <p className="mt-6 max-w-xs text-sm leading-7 text-muted">Organize o dia com ferramentas que deixam espaço para a parte mais importante do seu negócio: as pessoas.</p>
        </div>
        <div>
          {features.map((feature) => <FeatureCard key={feature.number} {...feature} />)}
        </div>
      </section>
      <section aria-labelledby="start-title" className="mt-16 rounded-xl border border-line bg-surface p-7 sm:mt-24 sm:p-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="editorial-label mb-4 text-brand">Começar é simples</p>
            <h2 id="start-title" className="max-w-xl font-display text-3xl leading-tight sm:text-4xl">O próximo capítulo do seu negócio começa aqui.</h2>
          </div>
          <ActionLink to={startPath}>{startLabel} <span aria-hidden="true">↗</span></ActionLink>
        </div>
        <ol className="mt-10 grid gap-7 border-t border-line pt-8 md:grid-cols-3">
          {[
            ['Crie o seu espaço', 'Adicione a sua empresa e personalize os contactos e a imagem do negócio.'],
            ['Organize a equipa', 'Defina serviços, preços e horários para cada profissional.'],
            ['Receba reservas', 'Ative a página de reservas e partilhe a ligação com os seus clientes.'],
          ].map(([title, description], index) => <li key={title}>
            <span className="font-display text-2xl italic text-brand" aria-hidden="true">0{index + 1}</span>
            <h3 className="mt-3 font-display text-2xl">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted">{description}</p>
          </li>)}
        </ol>
      </section>
    </>
  )
}
