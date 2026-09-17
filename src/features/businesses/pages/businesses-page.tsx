import { useAuth } from '../../auth/auth-context'
import { SignOutButton } from '../../auth/components/sign-out-button'
import { PageHeading } from '../../../components/ui/page-heading'
import { ActionLink } from '../../../components/ui/action-link'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'
import { useBusinesses } from '../hooks/use-businesses'
import { BusinessList } from '../components/business-list'

export function BusinessesPage() {
  const { session } = useAuth()
  const businesses = useBusinesses()
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-7">
        <PageHeading eyebrow="Área privada" title="Os seus negócios." description="Escolha a empresa em que pretende trabalhar ou dê início a um novo projeto." />
        <ActionLink to="/onboarding">Criar empresa <span aria-hidden="true">↗</span></ActionLink>
      </div>
      {businesses.isPending ? <Message>A carregar as suas empresas…</Message> :
        businesses.isError ? <div className="space-y-4">
          <Message error>Não foi possível carregar as empresas. Verifique a ligação e tente novamente.</Message>
          <Button disabled={businesses.isFetching} onClick={() => void businesses.refetch()}>Tentar novamente</Button>
        </div> : businesses.data.length === 0 ?
          <section className="border-y border-line py-12">
            <h2 className="font-display text-3xl">O primeiro passo é seu.</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-muted">Ainda não pertence a nenhuma empresa. Crie a sua para começar a organizar o negócio.</p>
            <div className="mt-6"><ActionLink to="/onboarding" variant="secondary">Criar a primeira empresa</ActionLink></div>
          </section> : <BusinessList businesses={businesses.data} />}
      <div className="flex flex-wrap items-center justify-between gap-5">
        <p className="break-all text-sm text-muted">Sessão iniciada como {session?.user.email}</p>
        <SignOutButton />
      </div>
    </div>
  )
}
