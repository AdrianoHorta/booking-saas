import { Link } from 'react-router'
import { businessRoleLabels, type BusinessSummary } from '../business.types'

export function BusinessList({ businesses }: { businesses: BusinessSummary[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {businesses.map((business) => (
        <li key={business.id}>
          <Link to={`/dashboard/${business.id}`} className="group flex flex-wrap items-center justify-between gap-5 py-7 hover:bg-brand-soft/40">
            <div className="min-w-0">
              <p className="editorial-label text-brand">{businessRoleLabels[business.role]}</p>
              <h2 className="mt-2 break-words font-display text-3xl">{business.name}</h2>
              <p className="mt-2 break-all text-sm text-muted">{business.slug}</p>
              {!business.is_active && <p className="mt-2 text-sm text-muted">Empresa inativa</p>}
            </div>
            <span className="shrink-0 text-sm font-medium text-brand group-hover:underline">Abrir empresa <span aria-hidden="true">↗</span></span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
