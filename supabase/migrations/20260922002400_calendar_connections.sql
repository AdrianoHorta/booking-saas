-- Tokens are encrypted by the Edge Function; no browser role can read this table.
create table public.employee_calendar_credentials (
  employee_id uuid primary key,
  business_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  credentials text,
  calendar_id text,
  calendar_name text,
  state_hash text,
  state_expires_at timestamptz,
  version uuid not null default gen_random_uuid(),
  foreign key (business_id, employee_id) references public.employees(business_id,id) on delete cascade
);
alter table public.employee_calendar_credentials enable row level security;
revoke all on public.employee_calendar_credentials from public, anon, authenticated;
grant all on public.employee_calendar_credentials to service_role;

create function public.calendar_connection_status(target_business_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('employee_id',e.id,'employee_name',e.name,
    'connected',c.credentials is not null,'calendar_id',c.calendar_id,'calendar_name',c.calendar_name)
  from public.employees e left join public.employee_calendar_credentials c
    on c.employee_id=e.id and c.user_id=e.user_id
  where e.business_id=target_business_id and e.user_id=auth.uid() and e.is_active
    and private.has_business_role(e.business_id,array['owner','admin','employee']::public.business_role[]);
$$;
revoke all on function public.calendar_connection_status(uuid) from public, anon;
grant execute on function public.calendar_connection_status(uuid) to authenticated;

-- Called only by the server after getUser verifies the bearer token. The locks
-- serialize start/finish/disconnect and guard against a reassignment mid-request.
create function public.calendar_connection_backend(action text, target_business_id uuid, target_user_id uuid, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.employees; c public.employee_calendar_credentials;
begin
  select * into e from public.employees where business_id=target_business_id
    and user_id=target_user_id and is_active for update;
  if not found then raise exception 'No associated professional' using errcode='42501'; end if;
  insert into public.employee_calendar_credentials(employee_id,business_id,user_id)
    values(e.id,e.business_id,e.user_id) on conflict do nothing;
  select * into c from public.employee_calendar_credentials where employee_id=e.id for update;
  if c.user_id<>e.user_id then raise exception 'Connection owner changed' using errcode='42501'; end if;
  if action='read' then return to_jsonb(c);
  elsif action='start' then
    if payload->>'state_hash' is null or payload->>'state_hash' !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid state' using errcode='22023'; end if;
    update public.employee_calendar_credentials set state_hash=payload->>'state_hash',
      state_expires_at=now()+interval '10 minutes',version=gen_random_uuid() where employee_id=e.id returning * into c;
  elsif action='consume' then
    if c.state_hash is null or payload->>'state_hash' is null or c.state_hash<>payload->>'state_hash' or c.state_expires_at<=now() then
      raise exception 'Invalid or expired authorization' using errcode='22023';
    end if;
    update public.employee_calendar_credentials set state_hash=null,state_expires_at=null where employee_id=e.id;
  elsif action in ('save','select','disconnect') then
    if c.version<>(payload->>'version')::uuid or payload->>'version' is null then
      raise exception 'Connection changed; retry' using errcode='40001';
    end if;
    if action='save' then
      update public.employee_calendar_credentials set credentials=payload->>'credentials',
        calendar_id=null,calendar_name=null,version=gen_random_uuid() where employee_id=e.id returning * into c;
    elsif action='select' then
      if c.credentials is null then raise exception 'Not connected' using errcode='22023'; end if;
      update public.employee_calendar_credentials set calendar_id=payload->>'calendar_id',
        calendar_name=payload->>'calendar_name',version=gen_random_uuid() where employee_id=e.id returning * into c;
    else
      update public.employee_calendar_credentials set credentials=null,calendar_id=null,calendar_name=null,
        state_hash=null,state_expires_at=null,version=gen_random_uuid() where employee_id=e.id returning * into c;
    end if;
  else raise exception 'Unknown operation' using errcode='22023'; end if;
  return to_jsonb(c);
end;
$$;
revoke all on function public.calendar_connection_backend(text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.calendar_connection_backend(text,uuid,uuid,jsonb) to service_role;

-- Reassignment must never grant the new professional access to old credentials.
create function private.clear_reassigned_calendar() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.user_id is distinct from old.user_id or not new.is_active then
    delete from public.employee_calendar_credentials where employee_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.clear_reassigned_calendar() from public,anon,authenticated;
create trigger clear_reassigned_calendar after update of user_id,is_active on public.employees
  for each row execute function private.clear_reassigned_calendar();
