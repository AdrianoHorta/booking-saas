-- SECURITY INVOKER: as operações continuam sujeitas a grants e RLS.
create function public.save_employee(
  target_business_id uuid,
  employee_name text,
  service_ids uuid[],
  target_employee_id uuid default null,
  linked_user_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if not private.has_business_role(target_business_id, array['owner', 'admin']::public.business_role[]) then
    raise exception 'Employee management not allowed' using errcode = '42501';
  end if;
  if service_ids is null or array_position(service_ids, null) is not null then
    raise exception 'Service selection must be an array of identifiers' using errcode = '22023';
  end if;

  if target_employee_id is null then
    insert into public.employees (business_id, name, user_id)
    values (target_business_id, btrim(employee_name), linked_user_id)
    returning id into saved_id;
  else
    -- O UPDATE obtém o lock do perfil antes de substituir as associações.
    update public.employees set name = btrim(employee_name), user_id = linked_user_id
    where id = target_employee_id and business_id = target_business_id
    returning id into saved_id;
    if saved_id is null then
      raise exception 'Employee unavailable' using errcode = '42501';
    end if;
  end if;

  delete from public.employee_services
  where business_id = target_business_id and employee_id = saved_id
    and not (service_id = any(service_ids));
  insert into public.employee_services (business_id, employee_id, service_id)
  select target_business_id, saved_id, selected.id
  from (select distinct unnest(service_ids) as id) as selected
  where not exists (
    select 1 from public.employee_services as existing
    where existing.business_id = target_business_id
      and existing.employee_id = saved_id and existing.service_id = selected.id
  );
  -- Qualquer FK inválida reverte também o perfil e as remoções anteriores.
  return saved_id;
end;
$$;

revoke all on function public.save_employee(uuid, text, uuid[], uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_employee(uuid, text, uuid[], uuid, uuid) to authenticated;
