import { Link } from 'react-router'
import { Avatar } from '../../../components/ui/avatar'
import { useProfile } from '../../profile/use-profile'
import { useAuth } from '../../auth/auth-context'
import { SignOutButton } from '../../auth/components/sign-out-button'
import { ActionLink } from '../../../components/ui/action-link'
import { Button } from '../../../components/ui/button'
import { Message } from '../../../components/feedback/message'
import { useBusinesses } from '../hooks/use-businesses'
import { BusinessList } from '../components/business-list'

export function BusinessesPage() {
  const { session } = useAuth()
  const businesses = useBusinesses()
  const profile = useProfile()
  const displayName = profile.data?.full_name || session?.user.email || 'A sua conta'
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={displayName} path={profile.data?.avatar_path} className="size-12 text-lg" />
          <div className="min-w-0"><p className="break-words text-sm font-medium">{profile.data?.full_name || 'Bem-vindo ao seu espaço.'}</p><p className="break-all text-xs text-muted">{session?.user.email}</p></div>
        </div>
        <Link to="/account" className="inline-flex min-h-11 items-center gap-3 text-sm font-medium text-brand">Editar perfil <span aria-hidden="true">→</span></Link>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-5 py-2">
        <div><p className="editorial-label mb-2 text-brand">Área privada</p><h1 className="font-display text-4xl sm:text-5xl">Os seus negócios.</h1>
          <p className="mt-3 text-sm text-muted">Escolha o seu espaço e continue de onde ficou.</p></div>
        <ActionLink to="/onboarding" variant="secondary"><span aria-hidden="true">+</span> Criar empresa</ActionLink>
      </header>
      {businesses.isPending ? <Message>A carregar as suas empresas…</Message> :
        businesses.isError ? <div className="space-y-4">
          <Message error>Não foi possível carregar as empresas. Verifique a ligação e tente novamente.</Message>
          <Button disabled={businesses.isFetching} onClick={() => void businesses.refetch()}>Tentar novamente</Button>
        </div> : businesses.data.length === 0 ?
          <section className="rounded-xl border border-dashed border-line p-8 text-center">
            <h2 className="font-display text-3xl">O primeiro passo é seu.</h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted">Ainda não pertence a nenhuma empresa. Crie a sua para começar a organizar o negócio.</p>
            <div className="mt-6"><ActionLink to="/onboarding" variant="secondary">Criar a primeira empresa</ActionLink></div>
          </section> : <BusinessList businesses={businesses.data} />}
      <div className="flex flex-wrap items-center justify-between gap-5 border-t border-line pt-5">
        <p className="break-all text-sm text-muted">O seu tempo, bem organizado.</p>
        <SignOutButton />
      </div>
    </div>
  )
}
