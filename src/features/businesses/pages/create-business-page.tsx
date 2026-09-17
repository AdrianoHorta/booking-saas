import { Link } from 'react-router'
import { PageHeading } from '../../../components/ui/page-heading'
import { CreateBusinessForm } from '../components/create-business-form'

export function CreateBusinessPage() {
  return (
    <div className="space-y-9">
      <Link to="/dashboard" className="text-sm text-brand underline underline-offset-4">Voltar às minhas empresas</Link>
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-24">
        <div>
          <PageHeading eyebrow="Uma nova empresa" title="Dê espaço ao seu negócio." description="Comece pelo essencial. Escolha o nome, o identificador e o fuso horário da sua empresa." />
          <p className="mt-8 max-w-md border-t border-line pt-6 font-display text-2xl italic text-muted">Cada negócio com o seu espaço.<br />Cada equipa com o seu ritmo.</p>
        </div>
        <div className="w-full max-w-md border-t border-line pt-8 lg:ml-auto"><CreateBusinessForm /></div>
      </div>
    </div>
  )
}
