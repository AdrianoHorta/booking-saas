alter table public.services enable row level security;

grant select, insert, update
  on table public.services
  to authenticated;


create policy services_read_by_members
  on public.services
  for select
  to authenticated
  using (
    private.has_business_role(
      business_id,
      array['owner', 'admin', 'employee']::public.business_role[]
    )
  );


create policy services_insert_by_managers
  on public.services
  for insert
  to authenticated
  with check (
    private.has_business_role(
      business_id,
      array['owner', 'admin']::public.business_role[]
    )
  );


create policy services_update_by_managers
  on public.services
  for update
  to authenticated
  using (
    private.has_business_role(
      business_id,
      array['owner', 'admin']::public.business_role[]
    )
  )
  with check (
    private.has_business_role(
      business_id,
      array['owner', 'admin']::public.business_role[]
    )
  );