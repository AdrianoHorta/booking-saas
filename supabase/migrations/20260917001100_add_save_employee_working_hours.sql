create function public.save_employee_working_hours(
  target_business_id uuid,
  target_employee_id uuid,
  periods jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.has_business_role(target_business_id, array['owner', 'admin']::public.business_role[]) then
    raise exception 'Schedule management not allowed' using errcode = '42501';
  end if;
  if periods is null or jsonb_typeof(periods) <> 'array' then
    raise exception 'Periods must be an array' using errcode = '22023';
  end if;

  -- Serializa substituições concorrentes da semana deste colaborador.
  perform id from public.employees
  where id = target_employee_id and business_id = target_business_id for update;
  if not found then
    raise exception 'Employee unavailable' using errcode = '42501';
  end if;

  delete from public.employee_working_hours
  where business_id = target_business_id and employee_id = target_employee_id;
  insert into public.employee_working_hours (business_id, employee_id, weekday, start_minute, end_minute)
  select target_business_id, target_employee_id, p.weekday, p.start_minute, p.end_minute
  from jsonb_to_recordset(periods) as p(weekday integer, start_minute integer, end_minute integer);
  -- Constraints de limites e exclusão validam a semana inteira; erro reverte o DELETE.
end;
$$;

revoke all on function public.save_employee_working_hours(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_employee_working_hours(uuid, uuid, jsonb) to authenticated;
