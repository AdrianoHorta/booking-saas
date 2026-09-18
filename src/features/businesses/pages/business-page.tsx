import { Link, useParams } from "react-router";
import { PageHeading } from "../../../components/ui/page-heading";
import { Button } from "../../../components/ui/button";
import { Message } from "../../../components/feedback/message";
import { SignOutButton } from "../../auth/components/sign-out-button";
import { useBusiness } from "../hooks/use-businesses";
import { businessIdSchema } from "../schemas/business-schema";
import { businessRoleLabels } from "../business.types";
import { PublicBookingSettings } from "../components/public-booking-settings";
import { BusinessMembers } from "../components/business-members";

export function BusinessPage() {
  const { businessId = "" } = useParams();
  const query = useBusiness(businessId);
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

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <Link
          to="/dashboard"
          className="text-sm text-brand underline underline-offset-4"
        >
          Trocar empresa
        </Link>
        <span className="editorial-label text-brand">
          {businessRoleLabels[business.role]}
        </span>
      </div>
      <PageHeading
        eyebrow="O seu negócio"
        title={business.name}
        description="Este é o espaço da sua empresa. Aqui reuniremos os serviços, a equipa e a agenda."
      />
      <section className="max-w-xl space-y-4">
        <h2 className="font-display text-3xl">{business.role === 'employee' ? 'As suas marcações.' : 'As marcações da empresa.'}</h2>
        <p className="text-muted">Consulte horários, serviços e contactos dos clientes.</p>
        <Link to={`/dashboard/${business.id}/reservations`} className="inline-flex text-sm font-medium text-brand underline underline-offset-4">
          {business.role === 'employee' ? 'As minhas reservas' : 'Ver reservas da empresa'}
        </Link>
      </section>
      <dl className="grid gap-7 border-y border-line py-7 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Identificador</dt>
          <dd className="mt-2 break-all font-medium">{business.slug}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Estado</dt>
          <dd className="mt-2 font-medium">
            {business.is_active ? "Ativa" : "Inativa"}
          </dd>
        </div>
      </dl>
      <section className="max-w-xl">
        <h2 className="font-display text-3xl">
          Um catálogo com a sua assinatura.
        </h2>

        <p className="mt-4 leading-relaxed text-muted">
          Configure os serviços que os seus clientes poderão reservar. Defina
          duração, preço e disponibilidade.
        </p>

        <div className="mt-6">
          <Link
            to={`/dashboard/${business.id}/services`}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand underline underline-offset-4"
          >
            Gerir serviços
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <section className="max-w-xl">
        <h2 className="font-display text-3xl">As pessoas por trás do seu negócio.</h2>
        <p className="mt-4 leading-relaxed text-muted">Organize os colaboradores e associe os serviços que cada profissional realiza.</p>
        <Link to={`/dashboard/${business.id}/employees`} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand underline underline-offset-4">
          Gerir colaboradores <span aria-hidden="true">↗</span>
        </Link>
      </section>
      <section className="max-w-xl">
        <h2 className="font-display text-3xl">Encontre um lugar na agenda.</h2>
        <p className="mt-4 leading-relaxed text-muted">Consulte as vagas por serviço, profissional e data.</p>
        <Link to={`/dashboard/${business.id}/availability`} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand underline underline-offset-4">Consultar disponibilidade <span aria-hidden="true">↗</span></Link>
      </section>
      <BusinessMembers key={`members-${business.id}`} business={business} />
      <PublicBookingSettings key={business.id} business={business} />
      <SignOutButton />
    </div>
  );
}
