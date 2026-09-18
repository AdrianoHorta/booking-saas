-- Profissionais com agenda são distintos dos membros com acesso à aplicação.
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  user_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_business_id_id_key unique (business_id, id),
  -- NULL permite vários profissionais sem login; uma conta tem um perfil por empresa.
  constraint employees_business_id_user_id_key unique (business_id, user_id),
  constraint employees_business_member_fkey foreign key (business_id, user_id)
    references public.business_members(business_id, user_id)
);

-- A chave composta permite que as FKs validem o tenant dos dois lados da relação.
alter table public.services add constraint services_business_id_id_key unique (business_id, id);

create table public.employee_services (
  business_id uuid not null,
  employee_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (business_id, employee_id, service_id),
  constraint employee_services_employee_fkey foreign key (business_id, employee_id)
    references public.employees(business_id, id) on delete cascade,
  constraint employee_services_service_fkey foreign key (business_id, service_id)
    references public.services(business_id, id) on delete cascade
);

create index employee_services_service_idx on public.employee_services(business_id, service_id);

create trigger employees_updated_at
  before update on public.employees
  for each row execute function private.set_updated_at();

alter table public.employees enable row level security;
alter table public.employee_services enable row level security;
revoke all on table public.employees, public.employee_services from public, anon, authenticated;

grant select on table public.employees, public.employee_services to authenticated;
grant insert (business_id, name, user_id, is_active) on public.employees to authenticated;
grant update (name, user_id, is_active) on public.employees to authenticated;
grant insert (business_id, employee_id, service_id) on public.employee_services to authenticated;
-- Remover uma associação não apaga o colaborador nem o serviço.
grant delete on public.employee_services to authenticated;

create policy employees_read_by_members on public.employees
  for select to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin', 'employee']::public.business_role[])
  );
create policy employees_insert_by_managers on public.employees
  for insert to authenticated with check (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );
create policy employees_update_by_managers on public.employees
  for update to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  ) with check (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );

create policy employee_services_read_by_members on public.employee_services
  for select to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin', 'employee']::public.business_role[])
  );
create policy employee_services_insert_by_managers on public.employee_services
  for insert to authenticated with check (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );
create policy employee_services_delete_by_managers on public.employee_services
  for delete to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );

comment on table public.employees is 'Profissionais com agenda; desativar preserva a identidade e o histórico.';
comment on column public.employees.user_id is 'Ligação opcional a um membro da mesma empresa; não concede papéis ou acesso por si só.';
comment on table public.employee_services is 'Serviços realizados por profissional; as duas referências pertencem à mesma empresa.';
