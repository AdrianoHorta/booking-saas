import { Link, useParams, useSearchParams } from "react-router";
import { PageHeading } from "../../../components/ui/page-heading";
import { Button } from "../../../components/ui/button";
import { Message } from "../../../components/feedback/message";
import { SignOutButton } from "../../auth/components/sign-out-button";
import { useBusiness } from "../hooks/use-businesses";
import { businessIdSchema } from "../schemas/business-schema";
import { businessRoleLabels } from "../business.types";
import { PublicBookingSettings } from "../components/public-booking-settings";
import { BusinessMembers } from "../components/business-members";
import { ReservationSummary } from "../../reservations/reservation-summary";
import { WorkspaceIcon } from '../components/workspace-icon';
import { BusinessProfileEditor } from '../components/business-profile-editor';
import { Avatar } from '../../../components/ui/avatar';
// Google Calendar temporariamente desativado para o lançamento.
// import { CalendarSettings } from '../../calendar/calendar-settings';

export function BusinessPage() {
  const { businessId = "" } = useParams();
  const query = useBusiness(businessId);
  const [searchParams] = useSearchParams();
  const settings = searchParams.get('view') === 'settings';
  const validId = businessIdSchema.safeParse(businessId).success;
  const backLink = (
    <Link
      to="/dashboard"
      className="text-sm text-brand underline underline-offset-4"
    >
      Voltar às minhas empresas
    </Link>
  );
  if (!validId || (!query.isPending && !query.isError && !query.data)) {
    return (
      <div className="space-y-6">
        <PageHeading
          eyebrow="Área privada"
          title="Empresa indisponível."
          description="Esta empresa não está disponível para a sua conta. Confirme o endereço ou escolha outra empresa."
        />
        {backLink}
      </div>
    );
  }
  if (query.isPending) return <Message>A carregar a empresa…</Message>;
  if (query.isError)
    return (
      <div className="space-y-5">
        <Message error>
          Não foi possível carregar a empresa. Verifique a ligação e tente
          novamente.
        </Message>
        <Button
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </Button>
        <div>{backLink}</div>
      </div>
    );
  const business = query.data;
  if (!business) return null;

  const base = `/dashboard/${business.id}`;
  const canManage = business.role !== 'employee';
  const links = [
    { path: 'reservations', title: 'Agenda e reservas', description: 'Consulte marcações, reagende e acompanhe o dia.', label: 'Abrir agenda' },
    { path: 'services', title: 'Serviços', description: 'O catálogo, os preços e a duração de cada cuidado.', label: 'Gerir serviços' },
    { path: 'employees', title: 'Equipa e horários', description: 'Profissionais, serviços e horários de trabalho.', label: 'Gerir colaboradores' },
    { path: 'availability', title: 'Disponibilidade', description: 'Encontre uma vaga por serviço e profissional.', label: 'Consultar disponibilidade' },
    ...(canManage ? [{ path: 'insights', title: 'Indicadores e notificações', description: 'Acompanhe a atividade e configure os emails.', label: 'Ver indicadores' }] : []),
  ];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <Link to="/dashboard" className="text-brand underline underline-offset-4">← Trocar empresa</Link>
        <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">{businessRoleLabels[business.role]}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <PageHeading eyebrow="O seu negócio" title={business.name}
          description={settings ? 'Os detalhes e os acessos, num só lugar.' : 'Tudo o que precisa para cuidar do seu negócio.'} />
        {business.public_booking_enabled && business.is_active && <a href={`/book/${encodeURIComponent(business.slug)}`}
          className="inline-flex min-h-12 items-center gap-3 rounded-md border border-brand px-5 py-3 text-sm font-medium text-brand hover:bg-brand-soft">Ver página de reservas <span aria-hidden="true">↗</span></a>}
      </div>
      <nav aria-label="Secções da empresa" className="flex gap-6 border-b border-line text-sm">
        <Link to={base} aria-current={!settings ? 'page' : undefined} className={`border-b-2 px-1 py-4 ${!settings ? 'border-brand font-semibold text-brand' : 'border-transparent text-muted hover:text-brand'}`}>Visão geral</Link>
        <Link to={`${base}?view=settings`} aria-current={settings ? 'page' : undefined} className={`border-b-2 px-1 py-4 ${settings ? 'border-brand font-semibold text-brand' : 'border-transparent text-muted hover:text-brand'}`}>Definições</Link>
      </nav>
      {settings ? <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="rounded-xl border border-line bg-surface p-6" aria-labelledby="business-details-heading">
          <p className="editorial-label mb-2 text-brand">Estabelecimento</p>
          <h2 id="business-details-heading" className="font-display text-2xl">A sua empresa</h2>
          <div className="mt-5"><Avatar logo name={business.name} path={business.logo_path} className="size-20 text-2xl" /></div>
          <dl className="mt-5 space-y-5 text-sm">
            <div><dt className="text-muted">Nome</dt><dd className="mt-1 break-words font-medium">{business.name}</dd></div>
            <div><dt className="text-muted">Identificador</dt><dd className="mt-1 break-all font-medium">{business.slug}</dd></div>
            <div><dt className="text-muted">Fuso horário</dt><dd className="mt-1 font-medium">{business.timezone}</dd></div>
            <div><dt className="text-muted">Estado</dt><dd className="mt-1 font-medium">{business.is_active ? 'Ativa' : 'Inativa'}</dd></div>
          </dl>
        </section>
        <div className="min-w-0 space-y-6">
          {business.role === 'owner' && <BusinessProfileEditor key={business.id} business={business} />}
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-7"><PublicBookingSettings key={business.id} business={business} /></div>
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-7"><BusinessMembers key={`members-${business.id}`} business={business} /></div>
        </div>
      </div> : <>
        <section aria-labelledby="quick-access-heading">
          <h2 id="quick-access-heading" className="editorial-label mb-4 text-muted">O seu espaço de trabalho</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((item) => <Link key={item.path} to={`${base}/${item.path}`} className="group flex flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-brand hover:bg-brand-soft/40">
              <span className="mb-5 flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand"><WorkspaceIcon name={item.path} /></span>
              <h3 className="font-display text-2xl">{item.title}</h3>
              <p className="mb-6 mt-2 flex-1 text-sm leading-relaxed text-muted">{item.description}</p>
              <span className="flex items-center justify-between gap-3 text-sm font-medium text-brand">{item.label}<span aria-hidden="true">→</span></span>
            </Link>)}
            <Link to={`${base}?view=settings`} className="group flex flex-col rounded-xl border border-dashed border-line p-6 hover:border-brand hover:bg-brand-soft/40">
              <span className="mb-5 flex size-11 items-center justify-center rounded-full border border-line text-muted"><WorkspaceIcon name="settings" /></span>
              <h3 className="font-display text-2xl">Definições da empresa</h3>
              <p className="mb-6 mt-2 flex-1 text-sm text-muted">Publicação, cancelamentos e permissões de acesso.</p>
              <span className="flex items-center justify-between gap-3 text-sm font-medium text-brand">Gerir definições <span aria-hidden="true">→</span></span>
            </Link>
          </div>
        </section>
        <div className="rounded-xl border border-line bg-surface p-5 sm:p-8"><ReservationSummary key={`summary-${business.id}`} business={business} /></div>
      </>}
      {/* Google Calendar temporariamente desativado. Reativar após configurar OAuth.
      <CalendarSettings key={`calendar-${business.id}`} businessId={business.id} />
      */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <p className="text-xs text-muted">{business.name} · {business.timezone}</p>
        <SignOutButton />
      </div>
    </div>
  );
}
