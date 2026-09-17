import { Link, useParams } from "react-router";
import { PageHeading } from "../../../components/ui/page-heading";
import { Message } from "../../../components/feedback/message";
import { Button } from "../../../components/ui/button";
import { useState } from "react";
import { ServiceForm } from "../components/service-form";
import { useServices, useUpdateService } from "../hooks/use-services";

export function ServicesPage() {
  const { businessId = "" } = useParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(
    null,
  );
  type Service = {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number;
    is_active: boolean;
  };

  const [editingService, setEditingService] = useState<Service | null>(null);
  const servicesQuery = useServices(businessId);
  const updateService = useUpdateService(businessId);

  const backLink = (
    <Link
      to={`/dashboard/${businessId}`}
      className="text-sm text-brand underline underline-offset-4"
    >
      Voltar à empresa
    </Link>
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-5">
        {backLink}

        <span className="editorial-label text-brand">Catálogo</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <PageHeading
          eyebrow="Gestão"
          title="Serviços."
          description="Defina os serviços disponíveis, a duração de cada marcação e o respetivo preço."
        />

        <Button onClick={() => setIsCreateOpen(true)}>Adicionar serviço</Button>
      </div>

      <section className="space-y-6">
        <div>
          <h2 className="font-display text-3xl">Catálogo atual</h2>

          <p className="mt-3 text-muted">
            Serviços atualmente associados a esta empresa.
          </p>
        </div>

        {servicesQuery.isPending ? (
          <Message>A carregar os serviços…</Message>
        ) : servicesQuery.isError ? (
          <div className="space-y-4">
            <Message error>Não foi possível carregar os serviços.</Message>

            <Button
              disabled={servicesQuery.isFetching}
              onClick={() => void servicesQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : servicesQuery.data.length === 0 ? (
          <div className="border-y border-line py-10">
            <p className="text-muted">Ainda não existem serviços.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {servicesQuery.data.map((service) => (
              <article
                key={service.id}
                className="flex min-h-64 flex-col justify-between rounded-[3px] border border-line bg-white p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-2xl">{service.name}</h3>

                    <span className="editorial-label text-brand">
                      {service.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  {service.description && (
                    <p className="mt-4 leading-relaxed text-muted">
                      {service.description}
                    </p>
                  )}

                  <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-muted">
                        Duração
                      </dt>

                      <dd className="mt-1 font-medium">
                        {service.duration_minutes} min
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs uppercase tracking-wider text-muted">
                        Preço
                      </dt>

                      <dd className="mt-1 font-medium">
                        {(service.price_cents / 100).toFixed(2)} €
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5">
                  <Button onClick={() => setEditingService(service)}>
                    Editar
                  </Button>

                  <Button
                    disabled={updatingServiceId === service.id}
                    onClick={() => {
                      setUpdatingServiceId(service.id);

                      updateService.mutate(
                        {
                          id: service.id,
                          isActive: !service.is_active,
                        },
                        {
                          onSettled: () => {
                            setUpdatingServiceId(null);
                          },
                        },
                      );
                    }}
                  >
                    {service.is_active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-[3px] border border-line bg-white p-8 shadow-[0_24px_80px_rgba(60,35,20,0.18)] sm:p-10">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="absolute right-6 top-6 text-2xl text-muted transition hover:text-foreground"
              aria-label="Fechar"
            >
              ×
            </button>

            <div className="max-w-md">
              <span className="editorial-label text-brand">Novo serviço</span>

              <h2 className="mt-3 font-display text-4xl">
                Adicionar ao catálogo.
              </h2>

              <p className="mt-4 leading-relaxed text-muted">
                Defina o nome, a duração e o preço do serviço.
              </p>
            </div>

            <ServiceForm
              businessId={businessId}
              onClose={() => setIsCreateOpen(false)}
              onSuccess={() => setIsCreateOpen(false)}
            />
          </div>
        </div>
      )}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-xl rounded-[3px] border border-line bg-white p-8 shadow-[0_24px_80px_rgba(60,35,20,0.18)] sm:p-10">
            <button
              type="button"
              onClick={() => setEditingService(null)}
              className="absolute right-6 top-6 text-2xl text-muted transition hover:text-foreground"
              aria-label="Fechar"
            >
              ×
            </button>

            <div className="max-w-md">
              <span className="editorial-label text-brand">Editar serviço</span>

              <h2 className="mt-3 font-display text-4xl">Ajustar serviço.</h2>

              <p className="mt-4 leading-relaxed text-muted">
                Atualize os detalhes deste serviço.
              </p>
            </div>

            <div className="mt-10">
              <ServiceForm
                businessId={businessId}
                service={editingService}
                onClose={() => setEditingService(null)}
                onSuccess={() => setEditingService(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
