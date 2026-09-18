-- Uma leitura coerente por consulta, sem abrir acesso público nem conceder escrita.
create function public.get_availability_context(
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
    'blocked_periods', (select coalesce(jsonb_agg(jsonb_build_object('starts_at',starts_at,'ends_at',ends_at)), '[]'::jsonb)
      from public.employee_blocked_periods where business_id = target_business_id and employee_id = target_employee_id
        and starts_at < range_end and ends_at > range_start)
  );
end;
$$;
revoke all on function public.get_availability_context(uuid,uuid,uuid,date) from public, anon, authenticated;
grant execute on function public.get_availability_context(uuid,uuid,uuid,date) to authenticated;
