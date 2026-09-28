import { Avatar } from '../../../components/ui/avatar'
import { Link } from 'react-router'
import { businessRoleLabels, type BusinessSummary } from '../business.types'

export function BusinessList({ businesses }: { businesses: BusinessSummary[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {businesses.map((business) => (
        <li key={business.id}>
          <Link to={`/dashboard/${business.id}`} className="group flex h-full flex-col gap-5 rounded-xl border border-line bg-surface p-6 transition-colors hover:border-brand hover:bg-brand-soft/30">
            <div className="flex items-center justify-between gap-3"><Avatar logo name={business.name} path={business.logo_path} className="size-14 text-xl" /><span className="rounded-full bg-brand-soft px-3 py-1 text-xs text-brand">{businessRoleLabels[business.role]}</span></div>
            <div className="min-w-0 flex-1">
              <h2 className="break-words font-display text-2xl">{business.name}</h2>
              <p className="mt-2 break-all text-sm text-muted">{business.slug}</p>
              {!business.is_active && <p className="mt-2 text-sm text-muted">Empresa inativa</p>}
            </div>
            <span className="flex items-center justify-between border-t border-line pt-4 text-sm font-medium text-brand">Abrir empresa <span aria-hidden="true">↗</span></span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
