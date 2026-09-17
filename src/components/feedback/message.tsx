import type { ReactNode } from 'react'

export function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p role={error ? 'alert' : 'status'} className="border-l-2 border-brand bg-brand-soft p-4 text-sm leading-relaxed text-ink">{children}</p>
}
