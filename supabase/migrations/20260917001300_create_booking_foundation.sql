-- A escrita permanece fechada: o fluxo público usará uma função transacional.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (
    char_length(email) between 3 and 254 and email = lower(btrim(email))
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text check (phone is null or char_length(btrim(phone)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_business_id_id_key unique (business_id, id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  employee_id uuid not null,
  service_id uuid not null,
  -- O cliente futuro manterá esta chave ao repetir o mesmo pedido após timeout.
  request_id uuid not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  service_name text not null check (char_length(btrim(service_name)) between 1 and 100),
  employee_name text not null check (char_length(btrim(employee_name)) between 1 and 100),
  duration_minutes integer not null check (duration_minutes between 1 and 44640),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_business_request_key unique (business_id, request_id),
  constraint bookings_customer_fkey foreign key (business_id, customer_id)
    references public.customers(business_id, id),
  constraint bookings_employee_fkey foreign key (business_id, employee_id)
    references public.employees(business_id, id),
  constraint bookings_service_fkey foreign key (business_id, service_id)
    references public.services(business_id, id),
  constraint bookings_valid_period check (
    isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at
    and ends_at = starts_at + duration_minutes * interval '1 minute'
  ),
  constraint bookings_no_overlap exclude using gist (
    employee_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed')
);

create index bookings_employee_date_idx on public.bookings(business_id, employee_id, starts_at);
create index bookings_customer_idx on public.bookings(business_id, customer_id);
create index bookings_service_idx on public.bookings(business_id, service_id);
create index customers_email_idx on public.customers(business_id, email);

create trigger customers_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger bookings_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();

alter table public.customers enable row level security;
alter table public.bookings enable row level security;
revoke all on table public.customers, public.bookings from public, anon, authenticated;
grant select on table public.customers, public.bookings to authenticated;

-- Managers consultam a empresa; colaborador com login só consulta a própria agenda.
create policy bookings_read_by_managers_or_assignee on public.bookings
  for select to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
    or exists (
      select 1 from public.employees as employee
      where employee.business_id = bookings.business_id and employee.id = bookings.employee_id
        and employee.user_id = (select auth.uid())
    )
  );

create policy customers_read_by_managers_or_booking_assignee on public.customers
  for select to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
    or exists (
      -- A policy de bookings limita este EXISTS à agenda autorizada.
      select 1 from public.bookings as booking
      where booking.business_id = customers.business_id and booking.customer_id = customers.id
    )
  );

comment on table public.customers is 'Clientes privados por empresa; email não é uma identidade verificada nem uma chave de deduplicação automática.';
comment on table public.bookings is 'Reservas com snapshots do catálogo e exclusão de sobreposições. Escrita apenas por futuras funções transacionais.';
comment on column public.bookings.request_id is 'Chave idempotente do pedido; unicidade não substitui a verificação do payload na futura função de confirmação.';

-- Esta leitura devolve somente intervalos; não expõe clientes nem snapshots.
create function private.booking_busy_periods(target_business_id uuid, target_employee_id uuid, range_start timestamptz, range_end timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_business_role(target_business_id, array['owner','admin','employee']::public.business_role[]) then
    raise exception 'Availability access not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('starts_at', starts_at, 'ends_at', ends_at)), '[]'::jsonb)
    from public.bookings where business_id = target_business_id and employee_id = target_employee_id
      and status = 'confirmed' and starts_at < range_end and ends_at > range_start);
end;
$$;
revoke all on function private.booking_busy_periods(uuid,uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function private.booking_busy_periods(uuid,uuid,timestamptz,timestamptz) to authenticated;

-- Uma leitura coerente por consulta, sem abrir acesso público nem conceder escrita.
create or replace function public.get_availability_context(
  target_business_id uuid,
  target_employee_id uuid,
  target_service_id uuid,
  target_date date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  business public.businesses%rowtype;
  employee public.employees%rowtype;
  service public.services%rowtype;
  range_start timestamptz;
  range_end timestamptz;
begin
  if not private.has_business_role(target_business_id, array['owner','admin','employee']::public.business_role[]) then
    raise exception 'Availability access not allowed' using errcode = '42501';
  end if;
  if target_date is null or not isfinite(target_date) or target_date < date '0001-01-01' or target_date > date '9998-12-31' then
    raise exception 'Invalid availability date' using errcode = '22023';
  end if;
  select * into business from public.businesses where id = target_business_id;
  select * into employee from public.employees where business_id = target_business_id and id = target_employee_id;
  select * into service from public.services where business_id = target_business_id and id = target_service_id;
  if business.id is null or employee.id is null or service.id is null then
    raise exception 'Availability selection unavailable' using errcode = '42501';
  end if;
  if service.duration_minutes > 44640 then
    raise exception 'Availability supports services up to 31 days' using errcode = '22023';
  end if;
  range_start := target_date::timestamp at time zone business.timezone;
  range_end := (target_date + ((service.duration_minutes + 1439) / 1440) + 2)::timestamp at time zone business.timezone;
  return jsonb_build_object(
    'server_now', statement_timestamp(),
    'timezone', business.timezone,
    'slot_interval_minutes', business.slot_interval_minutes,
    'duration_minutes', service.duration_minutes,
    'business_active', business.is_active,
    'employee_active', employee.is_active,
    'service_active', service.is_active,
    'assigned', exists(select 1 from public.employee_services where business_id = target_business_id and employee_id = target_employee_id and service_id = target_service_id),
    'working_hours', (select coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'start_minute',start_minute,'end_minute',end_minute)), '[]'::jsonb)
      from public.employee_working_hours where business_id = target_business_id and employee_id = target_employee_id),
    'booking_periods', private.booking_busy_periods(target_business_id, target_employee_id, range_start, range_end),
    'blocked_periods', (select coalesce(jsonb_agg(jsonb_build_object('starts_at',starts_at,'ends_at',ends_at)), '[]'::jsonb)
      from public.employee_blocked_periods where business_id = target_business_id and employee_id = target_employee_id
        and starts_at < range_end and ends_at > range_start)
  );
end;
$$;
revoke all on function public.get_availability_context(uuid,uuid,uuid,date) from public, anon, authenticated;
grant execute on function public.get_availability_context(uuid,uuid,uuid,date) to authenticated;
