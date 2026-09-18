-- Contrato público explícito; não concede SELECT nas tabelas privadas.
create function public.get_public_booking_catalog(target_business_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  business public.businesses%rowtype;
begin
  select * into business from public.businesses
    where slug = target_business_slug and is_active and public_booking_enabled;
  if business.id is null then
    raise exception 'Public booking unavailable' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'business', jsonb_build_object('name', business.name, 'slug', business.slug, 'timezone', business.timezone),
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', service.id, 'name', service.name,
        'duration_minutes', service.duration_minutes,
        'price_cents', service.price_cents, 'currency', 'EUR',
        'employees', (
          select jsonb_agg(jsonb_build_object('id', employee.id, 'name', employee.name) order by employee.name, employee.id)
          from public.employee_services assignment
          join public.employees employee on employee.business_id = assignment.business_id and employee.id = assignment.employee_id
          where assignment.business_id = business.id and assignment.service_id = service.id and employee.is_active
        )
      ) order by service.name, service.id), '[]'::jsonb)
      from public.services service
      where service.business_id = business.id and service.is_active and service.duration_minutes <= 44640
        and exists (
          select 1 from public.employee_services assignment
          join public.employees employee on employee.business_id = assignment.business_id and employee.id = assignment.employee_id
          where assignment.business_id = business.id and assignment.service_id = service.id and employee.is_active
        )
    )
  );
end;
$$;
revoke all on function public.get_public_booking_catalog(text) from public, anon, authenticated;
grant execute on function public.get_public_booking_catalog(text) to anon, authenticated;
