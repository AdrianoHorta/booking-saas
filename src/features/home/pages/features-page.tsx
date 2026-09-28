import { ActionLink } from '../../../components/ui/action-link'
import { PageHeading } from '../../../components/ui/page-heading'
import { useAuth } from '../../auth/auth-context'

const features = [
  { title: 'Reservas online', description: 'Uma página com a identidade do seu negócio, onde os clientes escolhem o serviço, o profissional e um horário disponível, sem precisar de criar conta.' },
  { title: 'Agenda sempre à mão', description: 'Consulte as marcações, filtre por data e profissional e acompanhe as alterações da sua equipa em tempo real.' },
  { title: 'Serviços à sua medida', description: 'Organize o catálogo com preços, duração e profissionais associados. Escolha os serviços que ficam disponíveis para reserva.' },
  { title: 'Uma equipa organizada', description: 'Defina os horários de cada profissional, bloqueie períodos de ausência e atribua os acessos adequados a cada pessoa.' },
  { title: 'Flexibilidade em cada marcação', description: 'Reagende a partir da agenda e defina o prazo de cancelamento. Os clientes podem consultar e cancelar a reserva através de uma ligação privada.' },
  { title: 'Uma visão clara do negócio', description: 'Acompanhe reservas confirmadas, cancelamentos, horas e valor marcado. Consulte a atividade por dia e por serviço.' },
]

export function FeaturesPage() {
  const { session } = useAuth()
  return (
    <>
      <PageHeading
        eyebrow="Funcionalidades"
        title="Tudo no seu lugar. Mais tempo para si."
        description="Da primeira reserva à organização da equipa, Booking SaaS acompanha o dia a dia dos negócios que trabalham por marcação."
      />
      <section aria-labelledby="features-title" className="mt-12">
        <h2 id="features-title" className="mb-8 font-display text-3xl">Um espaço para cuidar de cada detalhe.</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {features.map((feature, index) => (
            <article key={feature.title} className="rounded-xl border border-line bg-surface p-6 sm:p-8">
              <span aria-hidden="true" className="font-display text-2xl italic text-brand">0{index + 1}</span>
              <h3 className="mt-5 font-display text-2xl">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="workspace-title" className="mt-12 flex flex-wrap items-center justify-between gap-6 border-y border-line py-10">
        <div>
          <h2 id="workspace-title" className="font-display text-3xl">O seu negócio merece este cuidado.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted">Gira uma ou várias empresas na mesma conta, cada uma com a sua equipa, os seus serviços e a sua página de reservas.</p>
        </div>
        <ActionLink to={session ? '/dashboard' : '/register'}>{session ? 'Ir para os meus negócios' : 'Criar conta'} <span aria-hidden="true">↗</span></ActionLink>
      </section>
    </>
  )
}
