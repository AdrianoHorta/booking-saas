import { Avatar } from '../../components/ui/avatar'

export function BusinessIdentity({ name, logo }: { name: string; logo?: string | null }) {
  return <header className="mb-8 text-center sm:mb-10">
    <div className="mb-5"><Avatar logo name={name} path={logo} className="size-20 text-3xl shadow-sm" /></div>
    <p className="editorial-label mb-2 text-brand">Um momento para si</p>
    <h1 className="break-words font-display text-4xl tracking-tight sm:text-5xl">{name}</h1>
    <p className="mt-3 text-sm text-muted">O seu próximo cuidado começa aqui.</p>
  </header>
}
