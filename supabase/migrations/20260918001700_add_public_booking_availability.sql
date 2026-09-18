create function public.get_public_booking_availability(
  target_business_slug text, target_employee_id uuid, target_service_id uuid, target_date date
)
returns jsonb language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' as $$
declare
  business public.businesses%rowtype;
  service public.services%rowtype;
  periods tstzmultirange;
  day_end timestamptz;
  duration_value interval;
  slots jsonb;
begin
  if target_date is null or not isfinite(target_date)
    or target_date < date '0001-01-01' or target_date > date '9998-12-31' then
    raise exception 'Invalid availability date' using errcode = '22023';
  end if;
  select * into business from public.businesses
    where slug = target_business_slug and is_active and public_booking_enabled;
  if business.id is null then
    raise exception 'Public booking unavailable' using errcode = '42501';
  end if;
  select * into service from public.services
    where business_id = business.id and id = target_service_id and is_active;
  if service.id is null or not exists (
    select 1 from public.employee_services assignment
    join public.employees employee on employee.business_id = assignment.business_id and employee.id = assignment.employee_id
    where assignment.business_id = business.id and assignment.service_id = service.id
      and employee.id = target_employee_id and employee.is_active
  ) then
    raise exception 'Public booking unavailable' using errcode = '42501';
  end if;
  if service.duration_minutes > 44640 then
    raise exception 'Invalid service duration' using errcode = '22023';
  end if;
  duration_value := service.duration_minutes * interval '1 minute';
  day_end := (target_date + 1)::timestamp at time zone business.timezone;
  periods := private.booking_working_periods(business.id,target_employee_id,target_date,business.timezone,service.duration_minutes);

  select coalesce(jsonb_agg(jsonb_build_object('starts_at', candidate, 'ends_at', candidate + duration_value) order by candidate), '[]'::jsonb)
    into slots
    from unnest(periods) period
    cross join lateral generate_series(lower(period), least(upper(period) - duration_value, day_end),
      business.slot_interval_minutes * interval '1 minute') candidate
    where candidate < day_end and candidate >= statement_timestamp()
      and not exists (
        select 1 from public.employee_blocked_periods blocked
        where blocked.business_id = business.id and blocked.employee_id = target_employee_id
          and blocked.starts_at < candidate + duration_value and blocked.ends_at > candidate
      )
      and not exists (
        select 1 from public.bookings booking
        where booking.business_id = business.id and booking.employee_id = target_employee_id
          and booking.status = 'confirmed'
          and booking.starts_at < candidate + duration_value and booking.ends_at > candidate
      );
  return jsonb_build_object('server_now',statement_timestamp(),'timezone',business.timezone,
    'duration_minutes',service.duration_minutes,'slots',slots);
end;
$$;
revoke all on function public.get_public_booking_availability(text,uuid,uuid,date) from public, anon, authenticated;
grant execute on function public.get_public_booking_availability(text,uuid,uuid,date) to anon, authenticated;
