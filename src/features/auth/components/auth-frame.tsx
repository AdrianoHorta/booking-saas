import type { ReactNode } from 'react'
import { PageHeading } from '../../../components/ui/page-heading'
import { Message } from '../../../components/feedback/message'
import { useAuth } from '../auth-context'

export function AuthFrame({ title, description, children }: {
  title: string; description: string; children: ReactNode
}) {
  const { error } = useAuth()
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-24">
      <div>
        <PageHeading eyebrow="O seu espaço" title={title} description={description} />
        <p className="mt-10 hidden max-w-sm border-t border-line pt-6 font-display text-2xl italic text-muted lg:block">Mais espaço para o seu trabalho.<br />Mais tempo para as pessoas.</p>
      </div>
      <div className="w-full max-w-md space-y-6 border-t border-line pt-8 lg:ml-auto">
        {error ? <Message error>{error}</Message> : children}
      </div>
    </div>
  )
}
