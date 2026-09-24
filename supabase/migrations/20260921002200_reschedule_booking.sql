alter table public.bookings add column rescheduled_at timestamptz;
alter table public.bookings add column rescheduled_by uuid references auth.users(id) on delete set null;

create function private.can_manage_booking(business_id_arg uuid, employee_id_arg uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_business_role(business_id_arg,array['owner','admin']::public.business_role[])
    or (private.has_business_role(business_id_arg,array['employee']::public.business_role[]) and exists(
      select 1 from public.employees where business_id=business_id_arg and id=employee_id_arg and user_id=auth.uid()));
$$;
revoke all on function private.can_manage_booking(uuid,uuid) from public, anon, authenticated;

create function public.get_reschedule_slots(target_business_id uuid,target_booking_id uuid,target_date date)
returns jsonb language plpgsql stable security definer set search_path = '' set timezone = 'UTC' as $$
declare booking public.bookings%rowtype; business public.businesses%rowtype; periods tstzmultirange; duration_value interval; day_end timestamptz; slots jsonb;
begin
  select * into booking from public.bookings where business_id=target_business_id and id=target_booking_id;
  if booking.id is null or not private.can_manage_booking(target_business_id,booking.employee_id) then
    raise exception 'Rescheduling not allowed' using errcode='42501';
  end if;
  if target_date is null or not isfinite(target_date) or target_date < date '0001-01-01' or target_date > date '9998-12-31'
    or booking.status <> 'confirmed' or booking.starts_at <= statement_timestamp() then
    raise exception 'Invalid rescheduling request' using errcode='22023';
  end if;
  select * into business from public.businesses where id=target_business_id;
  if not business.is_active or not exists(select 1 from public.employees where id=booking.employee_id and is_active)
    or not exists(select 1 from public.services where id=booking.service_id and is_active)
    or not exists(select 1 from public.employee_services where business_id=business.id and employee_id=booking.employee_id and service_id=booking.service_id) then
    raise exception 'Rescheduling not allowed' using errcode='42501';
  end if;
  duration_value := booking.duration_minutes * interval '1 minute';
  day_end := (target_date + 1)::timestamp at time zone business.timezone;
  periods := private.booking_working_periods(business.id,booking.employee_id,target_date,business.timezone,booking.duration_minutes);
  select coalesce(jsonb_agg(jsonb_build_object('starts_at',candidate,'ends_at',candidate+duration_value) order by candidate),'[]'::jsonb) into slots
  from unnest(periods) period cross join lateral generate_series(lower(period),least(upper(period)-duration_value,day_end),business.slot_interval_minutes * interval '1 minute') candidate
  where candidate < day_end and candidate > statement_timestamp()
    and not exists(select 1 from public.employee_blocked_periods where business_id=business.id and employee_id=booking.employee_id and starts_at<candidate+duration_value and ends_at>candidate)
    and not exists(select 1 from public.bookings occupied where occupied.business_id=business.id and occupied.employee_id=booking.employee_id
      and occupied.id<>booking.id and occupied.status='confirmed' and occupied.starts_at<candidate+duration_value and occupied.ends_at>candidate);
  return jsonb_build_object('slots',slots,'expected_start',booking.starts_at);
end;
$$;
revoke all on function public.get_reschedule_slots(uuid,uuid,date) from public, anon, authenticated;
grant execute on function public.get_reschedule_slots(uuid,uuid,date) to authenticated;

create function public.reschedule_booking(target_business_id uuid,target_booking_id uuid,expected_start timestamptz,requested_start timestamptz)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare booking public.bookings%rowtype; business public.businesses%rowtype; periods tstzmultirange; end_value timestamptz;
begin
  if requested_start is null or not isfinite(requested_start) or requested_start < timestamptz '0001-01-01 UTC' or requested_start >= timestamptz '9999-01-01 UTC' or expected_start is null then
    raise exception 'Invalid rescheduling request' using errcode='22023';
  end if;
  select * into business from public.businesses where id=target_business_id for share;
  select * into booking from public.bookings where id=target_booking_id and business_id=target_business_id;
  if booking.id is null or not private.can_manage_booking(target_business_id,booking.employee_id) then
    raise exception 'Rescheduling not allowed' using errcode='42501';
  end if;
  -- Mesmo protocolo de locks da confirmação: empresa, profissional, serviço, horários, reserva.
  perform 1 from public.employees where id=booking.employee_id for update;
  perform 1 from public.services where id=booking.service_id for share;
  lock table public.employee_working_hours,public.employee_blocked_periods,public.employee_services in share mode;
  select * into booking from public.bookings where id=target_booking_id and business_id=target_business_id for update;
  if not private.can_manage_booking(target_business_id,booking.employee_id) then raise exception 'Rescheduling not allowed' using errcode='42501'; end if;
  if booking.status <> 'confirmed' then raise exception 'Invalid rescheduling request' using errcode='22023'; end if;
  if booking.starts_at = requested_start then
    return jsonb_build_object('id',booking.id,'starts_at',booking.starts_at,'ends_at',booking.ends_at);
  end if;
  if booking.starts_at <> expected_start then raise exception 'Booking changed' using errcode='40001'; end if;
  if booking.starts_at <= clock_timestamp() or requested_start <= clock_timestamp() then raise exception 'Invalid rescheduling request' using errcode='22023'; end if;
  if not business.is_active or not exists(select 1 from public.employees where id=booking.employee_id and is_active)
    or not exists(select 1 from public.services where id=booking.service_id and is_active)
    or not exists(select 1 from public.employee_services where business_id=business.id and employee_id=booking.employee_id and service_id=booking.service_id) then
    raise exception 'Rescheduling not allowed' using errcode='42501';
  end if;
  end_value := requested_start + booking.duration_minutes * interval '1 minute';
  periods := private.booking_working_periods(business.id,booking.employee_id,(requested_start at time zone business.timezone)::date,business.timezone,booking.duration_minutes);
  if not exists(select 1 from unnest(periods) p where p @> tstzrange(requested_start,end_value,'[)') and mod(extract(epoch from requested_start-lower(p)),business.slot_interval_minutes*60)=0)
    or exists(select 1 from public.employee_blocked_periods where business_id=business.id and employee_id=booking.employee_id and starts_at<end_value and ends_at>requested_start) then
    raise exception 'Slot unavailable' using errcode='23P01';
  end if;
  -- A exclusão GiST verifica as outras reservas; qualquer falha preserva o horário original.
  update public.bookings set starts_at=requested_start,ends_at=end_value,rescheduled_at=clock_timestamp(),rescheduled_by=auth.uid() where id=booking.id;
  return jsonb_build_object('id',booking.id,'starts_at',requested_start,'ends_at',end_value);
end;
$$;
revoke all on function public.reschedule_booking(uuid,uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.reschedule_booking(uuid,uuid,timestamptz,timestamptz) to authenticated;
