create extension if not exists btree_gist with schema extensions;

create table public.employee_working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  employee_id uuid not null,
  -- ISO: segunda = 1, domingo = 7. Minutos em hora local da empresa.
  weekday integer not null check (weekday between 1 and 7),
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_working_hours_positive check (end_minute > start_minute),
  constraint employee_working_hours_employee_fkey foreign key (business_id, employee_id)
    references public.employees(business_id, id) on delete cascade,
  constraint employee_working_hours_no_overlap exclude using gist (
    employee_id extensions.gist_uuid_ops with =,
    weekday extensions.gist_int4_ops with =,
    int4range(start_minute, end_minute, '[)') with &&
  )
);

create index employee_working_hours_employee_idx
  on public.employee_working_hours (business_id, employee_id, weekday, start_minute);

create table public.employee_blocked_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  employee_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text not null default 'Indisponível' check (char_length(btrim(label)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_blocked_periods_positive check (
    isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at
  ),
  constraint employee_blocked_periods_employee_fkey foreign key (business_id, employee_id)
    references public.employees(business_id, id) on delete cascade
);

create index employee_blocked_periods_employee_idx
  on public.employee_blocked_periods (business_id, employee_id, starts_at);

create trigger employee_working_hours_updated_at before update on public.employee_working_hours
  for each row execute function private.set_updated_at();
create trigger employee_blocked_periods_updated_at before update on public.employee_blocked_periods
  for each row execute function private.set_updated_at();

alter table public.employee_working_hours enable row level security;
alter table public.employee_blocked_periods enable row level security;
revoke all on table public.employee_working_hours, public.employee_blocked_periods from public, anon, authenticated;
grant select, delete on table public.employee_working_hours, public.employee_blocked_periods to authenticated;
grant insert (business_id, employee_id, weekday, start_minute, end_minute)
  on public.employee_working_hours to authenticated;
grant update (weekday, start_minute, end_minute) on public.employee_working_hours to authenticated;
grant insert (business_id, employee_id, starts_at, ends_at, label)
  on public.employee_blocked_periods to authenticated;
grant update (starts_at, ends_at, label) on public.employee_blocked_periods to authenticated;

create policy working_hours_read_by_members on public.employee_working_hours
  for select to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin', 'employee']::public.business_role[])
  );
create policy working_hours_insert_by_managers on public.employee_working_hours
  for insert to authenticated with check (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );
create policy working_hours_update_by_managers on public.employee_working_hours
  for update to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  ) with check (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );
create policy working_hours_delete_by_managers on public.employee_working_hours
  for delete to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );

create policy blocked_periods_read_by_members on public.employee_blocked_periods
  for select to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin', 'employee']::public.business_role[])
  );
create policy blocked_periods_insert_by_managers on public.employee_blocked_periods
  for insert to authenticated with check (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );
create policy blocked_periods_update_by_managers on public.employee_blocked_periods
  for update to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  ) with check (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );
create policy blocked_periods_delete_by_managers on public.employee_blocked_periods
  for delete to authenticated using (
    private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );

comment on table public.employee_working_hours is 'Horário semanal em hora local de businesses.timezone; intervalos [início, fim), sem sobreposições.';
comment on column public.employee_working_hours.end_minute is '1440 representa a meia-noite no fim deste dia; turnos noturnos dividem-se entre dois dias.';
comment on table public.employee_blocked_periods is 'Indisponibilidade datada por profissional, em instantes absolutos; sobreposições são permitidas e serão unidas pelo motor de disponibilidade.';
comment on column public.employee_blocked_periods.label is 'Descrição operacional visível aos membros da empresa; não guardar informação médica ou confidencial.';
