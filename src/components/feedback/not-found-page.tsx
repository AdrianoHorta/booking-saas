import { ActionLink } from '../ui/action-link'
import { PageHeading } from '../ui/page-heading'

export function NotFoundPage() {
  return (
    <>
      <PageHeading
        eyebrow="404 · Página não encontrada"
        title="Este caminho não leva a uma página."
        description="O endereço pode estar incorreto ou a página pode já não existir. Podes regressar à página inicial para continuar."
      />
      <div className="mt-8"><ActionLink to="/">Voltar ao início</ActionLink></div>
    </>
  )
}
