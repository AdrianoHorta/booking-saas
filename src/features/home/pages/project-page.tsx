import { ActionLink } from '../../../components/ui/action-link'
import { PageHeading } from '../../../components/ui/page-heading'

const stages = [
  { title: 'A base da experiência', description: 'Estrutura inicial, navegação e identidade visual.', status: 'Concluído' },
  { title: 'Empresas e equipas', description: 'Autenticação disponível. Gestão de empresas, serviços e profissionais em desenvolvimento.', status: 'Etapa atual' },
  { title: 'Das disponibilidades às reservas', description: 'Horários, marcações públicas e gestão da agenda.', status: 'Planeado' },
  { title: 'Um produto para explorar', description: 'Indicadores, demonstração e publicação online.', status: 'Planeado' },
]

export function ProjectPage() {
  return (
    <>
      <PageHeading
        eyebrow="Sobre o projeto"
        title="Uma ideia simples. Construída com cuidado."
        description="Booking SaaS é um projeto de portefólio em desenvolvimento: uma plataforma de reservas para negócios que trabalham por marcação."
      />
      <section aria-labelledby="roadmap-title" className="mt-12">
        <h2 id="roadmap-title" className="mb-8 font-display text-3xl">O caminho até à primeira versão</h2>
        <ol className="divide-y divide-line border-y border-line">
          {stages.map((stage, index) => (
            <li key={stage.title} className="flex flex-col gap-4 py-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <span aria-hidden="true" className="pr-3 font-display text-2xl italic text-brand">0{index + 1}</span>
                <div>
                  <h3 className="font-display text-2xl">{stage.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{stage.description}</p>
                </div>
              </div>
              <span className="w-fit shrink-0 border-l-2 border-brand px-3 py-1 text-xs font-medium text-brand">{stage.status}</span>
            </li>
          ))}
        </ol>
      </section>
      <div className="mt-8"><ActionLink to="/" variant="secondary">Voltar ao início</ActionLink></div>
    </>
  )
}
