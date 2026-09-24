alter table public.businesses add column cancellation_notice_hours integer not null default 12
  check (cancellation_notice_hours between 0 and 720);
alter table public.bookings add column cancellation_notice_hours integer not null default 12
  check (cancellation_notice_hours between 0 and 720);
alter table public.bookings add column cancelled_by_customer boolean not null default false;

create function private.capture_cancellation_policy() returns trigger language plpgsql set search_path = '' as $$
begin
  select cancellation_notice_hours into new.cancellation_notice_hours from public.businesses where id = new.business_id;
  return new;
end;
$$;
revoke all on function private.capture_cancellation_policy() from public, anon, authenticated;
create trigger bookings_cancellation_policy before insert on public.bookings
  for each row execute function private.capture_cancellation_policy();

create function public.set_cancellation_policy(target_business_id uuid, notice_hours integer)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_business_role(target_business_id,array['owner','admin']::public.business_role[]) then
    raise exception 'Policy management not allowed' using errcode = '42501';
  end if;
  if notice_hours is null or notice_hours not between 0 and 720 then
    raise exception 'Invalid cancellation notice' using errcode = '22023';
  end if;
  update public.businesses set cancellation_notice_hours = notice_hours where id = target_business_id;
  return notice_hours;
end;
$$;
revoke all on function public.set_cancellation_policy(uuid,integer) from public, anon, authenticated;
grant execute on function public.set_cancellation_policy(uuid,integer) to authenticated;

-- Segredo apenas no schema privado. Tokens determinísticos permitem recuperar o mesmo recibo.
create table private.booking_token_secret (singleton boolean primary key default true check(singleton), secret bytea not null);
insert into private.booking_token_secret(secret) values(extensions.gen_random_bytes(32));
revoke all on private.booking_token_secret from public, anon, authenticated;
create function private.booking_cancel_token(booking_id uuid) returns text language sql stable security definer set search_path = '' as $$
  select encode(extensions.hmac(convert_to('cancel:' || booking_id::text,'UTF8'),secret,'sha256'),'hex') from private.booking_token_secret;
$$;
revoke all on function private.booking_cancel_token(uuid) from public, anon, authenticated;

alter function public.confirm_booking(text,uuid,uuid,timestamptz,uuid,text,text,text) set schema private;
alter function private.confirm_booking(text,uuid,uuid,timestamptz,uuid,text,text,text) rename to confirm_booking_core;
revoke all on function private.confirm_booking_core(text,uuid,uuid,timestamptz,uuid,text,text,text) from public, anon, authenticated;
create function public.confirm_booking(business_slug text,target_employee_id uuid,target_service_id uuid,requested_start timestamptz,request_key uuid,
  customer_name text,customer_email text,customer_phone text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare receipt jsonb; booking public.bookings%rowtype;
begin
  receipt := private.confirm_booking_core(business_slug,target_employee_id,target_service_id,requested_start,request_key,customer_name,customer_email,customer_phone);
  select * into booking from public.bookings where id = (receipt->>'id')::uuid;
  return receipt || jsonb_build_object('cancellation_token',private.booking_cancel_token(booking.id),
    'cancellation_notice_hours',booking.cancellation_notice_hours,
    'cancellation_deadline',booking.starts_at - booking.cancellation_notice_hours * interval '1 hour');
end;
$$;
revoke all on function public.confirm_booking(text,uuid,uuid,timestamptz,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.confirm_booking(text,uuid,uuid,timestamptz,uuid,text,text,text) to anon, authenticated;

create function public.get_customer_booking(target_booking_id uuid, cancellation_token text)
returns jsonb language plpgsql stable security definer set search_path = '' set timezone = 'UTC' as $$
declare booking public.bookings%rowtype; business public.businesses%rowtype;
begin
  if cancellation_token is null or cancellation_token !~ '^[0-9a-f]{64}$'
    or cancellation_token is distinct from private.booking_cancel_token(target_booking_id) then
    raise exception 'Booking link unavailable' using errcode = '42501';
  end if;
  select * into booking from public.bookings where id = target_booking_id;
  if booking.id is null then raise exception 'Booking link unavailable' using errcode = '42501'; end if;
  select * into business from public.businesses where id = booking.business_id;
  return jsonb_build_object('id',booking.id,'status',booking.status,'business_name',business.name,'timezone',business.timezone,
    'service_name',booking.service_name,'employee_name',booking.employee_name,'starts_at',booking.starts_at,'ends_at',booking.ends_at,
    'cancellation_notice_hours',booking.cancellation_notice_hours,'cancellation_deadline',booking.starts_at - booking.cancellation_notice_hours * interval '1 hour',
    'can_cancel',booking.status = 'confirmed' and booking.starts_at > statement_timestamp()
      and statement_timestamp() <= booking.starts_at - booking.cancellation_notice_hours * interval '1 hour');
end;
$$;
revoke all on function public.get_customer_booking(uuid,text) from public, anon, authenticated;
grant execute on function public.get_customer_booking(uuid,text) to anon, authenticated;

create function public.cancel_customer_booking(target_booking_id uuid, cancellation_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking public.bookings%rowtype; now_value timestamptz;
begin
  perform public.get_customer_booking(target_booking_id,cancellation_token);
  select * into booking from public.bookings where id = target_booking_id for update;
  if booking.status <> 'cancelled' then
    now_value := clock_timestamp();
    if booking.starts_at <= now_value or now_value > booking.starts_at - booking.cancellation_notice_hours * interval '1 hour' then
      raise exception 'Cancellation deadline passed' using errcode = '22023';
    end if;
    update public.bookings set status='cancelled',cancelled_at=now_value,cancelled_by=null,cancelled_by_customer=true where id=booking.id;
  end if;
  return public.get_customer_booking(target_booking_id,cancellation_token);
end;
$$;
revoke all on function public.cancel_customer_booking(uuid,text) from public, anon, authenticated;
grant execute on function public.cancel_customer_booking(uuid,text) to anon, authenticated;
-- Contrato público explícito; não concede SELECT nas tabelas privadas.
create or replace function public.get_public_booking_catalog(target_business_slug text)
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
    'business', jsonb_build_object('name', business.name, 'slug', business.slug, 'timezone', business.timezone, 'cancellation_notice_hours', business.cancellation_notice_hours),
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

create or replace function public.cancel_booking(target_business_id uuid, target_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  booking public.bookings%rowtype;
begin
  select * into booking from public.bookings
    where business_id = target_business_id and id = target_booking_id for update;
  if booking.id is null or not (
    private.has_business_role(target_business_id, array['owner','admin']::public.business_role[])
    or (private.has_business_role(target_business_id, array['employee']::public.business_role[])
      and exists(select 1 from public.employees where business_id = target_business_id
        and id = booking.employee_id and user_id = auth.uid()))
  ) then
    raise exception 'Cancellation not allowed' using errcode = '42501';
  end if;
  -- Repetir um cancelamento autorizado devolve o mesmo resultado, mesmo após a hora marcada.
  if booking.status <> 'cancelled' then
    if booking.starts_at <= clock_timestamp() or clock_timestamp() > booking.starts_at - booking.cancellation_notice_hours * interval '1 hour' then
      raise exception 'Cancellation deadline passed' using errcode = '22023';
    end if;
    update public.bookings set status = 'cancelled', cancelled_at = clock_timestamp(), cancelled_by = auth.uid()
      where id = booking.id returning * into booking;
  end if;
  return jsonb_build_object('id',booking.id,'status',booking.status,'cancelled_at',booking.cancelled_at);
end;
$$;
revoke all on function public.cancel_booking(uuid,uuid) from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid,uuid) to authenticated;

