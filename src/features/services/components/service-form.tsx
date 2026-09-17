import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  serviceSchema,
  type ServiceFormValues,
} from "../schemas/service-schema";
import { useCreateService, useUpdateService } from "../hooks/use-services";
import { Button } from "../../../components/ui/button";

type EditableService = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
};

type ServiceFormProps = {
  businessId: string;
  service?: EditableService;
  onClose?: () => void;
  onSuccess?: () => void;
};

export function ServiceForm({
  businessId,
  service,
  onClose,
  onSuccess,
}: ServiceFormProps) {
  const createService = useCreateService(businessId);
  const updateService = useUpdateService(businessId);

  const isPending = createService.isPending || updateService.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      durationMinutes: service?.duration_minutes ?? 30,
      price: service ? service.price_cents / 100 : 0,
    },
  });

  async function onSubmit(values: ServiceFormValues) {
    try {
      if (service) {
        await updateService.mutateAsync({
          id: service.id,
          name: values.name,
          description: values.description || null,
          durationMinutes: values.durationMinutes,
          priceCents: Math.round(values.price * 100),
        });
      } else {
        await createService.mutateAsync({
          businessId,
          name: values.name,
          description: values.description,
          durationMinutes: values.durationMinutes,
          priceCents: Math.round(values.price * 100),
        });
      }

      reset();
      onSuccess?.();
    } catch {
      // Os estados da mutation apresentam o erro e mantêm os dados para repetir.
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium">
          Nome
        </label>

        <input
          id="name"
          type="text"
          {...register("name")}
          className="w-full border border-line bg-transparent px-4 py-3 outline-none transition focus:border-brand"
          placeholder="Ex.: Corte de cabelo"
        />

        {errors.name && (
          <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="mb-2 block text-sm font-medium">
          Descrição
        </label>

        <textarea
          id="description"
          rows={4}
          {...register("description")}
          className="w-full resize-none border border-line bg-transparent px-4 py-3 outline-none transition focus:border-brand"
          placeholder="Descreva brevemente o serviço"
        />

        {errors.description && (
          <p className="mt-2 text-sm text-red-600">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="durationMinutes"
            className="mb-2 block text-sm font-medium"
          >
            Duração
          </label>

          <div className="relative">
            <input
              id="durationMinutes"
              type="number"
              min="1"
              {...register("durationMinutes", {
                valueAsNumber: true,
              })}
              className="w-full border border-line bg-transparent px-4 py-3 pr-14 outline-none transition focus:border-brand"
            />

            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">
              min
            </span>
          </div>

          {errors.durationMinutes && (
            <p className="mt-2 text-sm text-red-600">
              {errors.durationMinutes.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="price" className="mb-2 block text-sm font-medium">
            Preço
          </label>

          <div className="relative">
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              {...register("price", {
                valueAsNumber: true,
              })}
              className="w-full border border-line bg-transparent px-4 py-3 pr-10 outline-none transition focus:border-brand"
            />

            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">
              €
            </span>
          </div>

          {errors.price && (
            <p className="mt-2 text-sm text-red-600">{errors.price.message}</p>
          )}
        </div>
      </div>

      {(createService.isError || updateService.isError) && (
        <p className="text-sm text-red-600">
          Não foi possível guardar o serviço.
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-line pt-6">
        <Button type="button" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>

        <Button type="submit" disabled={isPending}>
          {isPending
            ? "A guardar..."
            : service
              ? "Guardar alterações"
              : "Criar serviço"}
        </Button>
      </div>
    </form>
  );
}
