-- Publicação será uma opção explícita no fluxo de gestão; nunca abre tenants existentes.
alter table public.businesses add column public_booking_enabled boolean not null default false;
alter table public.bookings add column request_fingerprint text
  check (request_fingerprint ~ '^[0-9a-f]{64}$');

-- PostgreSQL resolve limites DST silenciosamente; aqui exigimos um instante único.
create function private.strict_local_instant(local_time timestamp, zone text)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare
  candidate timestamptz := local_time at time zone zone;
  alternative timestamptz;
  sample timestamptz;
  offset_value interval;
begin
  if candidate at time zone zone <> local_time then
    raise exception 'Invalid working hours boundary' using errcode = '22023';
  end if;
  for sample in select generate_series(candidate - interval '2 days', candidate + interval '2 days', interval '6 hours') loop
    offset_value := (sample at time zone zone) - (sample at time zone 'UTC');
    alternative := (local_time at time zone 'UTC') - offset_value;
    if alternative <> candidate and alternative at time zone zone = local_time then
      raise exception 'Ambiguous working hours boundary' using errcode = '22023';
    end if;
  end loop;
  return candidate;
end;
$$;
revoke all on function private.strict_local_instant(timestamp,text) from public, anon, authenticated;

-- Mesma grelha do motor: intervalos adjacentes unidos, origem no dia do início,
-- extensão após meia-noite somente enquanto existir continuidade de horário.
create function private.booking_working_periods(business_id_arg uuid, employee_id_arg uuid, day_arg date, zone text, duration_arg integer)
returns tstzmultirange language plpgsql stable set search_path = '' as $$
declare
  result tstzmultirange := '{}'::tstzmultirange;
  local_period int4range;
  local_periods int4multirange;
  last_end integer;
  day_offset integer;
  current_day date;
begin
  for day_offset in 0..((duration_arg + 1439) / 1440 + 1) loop
    current_day := day_arg + day_offset;
    select range_agg(int4range(start_minute,end_minute,'[)')) into local_periods
      from public.employee_working_hours
      where business_id = business_id_arg and employee_id = employee_id_arg
        and weekday = extract(isodow from current_day);
    last_end := null;
    for local_period in select unnest(local_periods) loop
      if day_offset > 0 and lower(local_period) <> 0 then return result; end if;
      result := result + tstzmultirange(tstzrange(
        private.strict_local_instant(current_day::timestamp + lower(local_period) * interval '1 minute',zone),
        private.strict_local_instant(current_day::timestamp + upper(local_period) * interval '1 minute',zone),'[)'));
      last_end := upper(local_period);
      if day_offset > 0 then exit; end if;
    end loop;
    if last_end is distinct from 1440 then exit; end if;
  end loop;
  return result;
end;
$$;
revoke all on function private.booking_working_periods(uuid,uuid,date,text,integer) from public, anon, authenticated;

create function public.confirm_booking(
  business_slug text, target_employee_id uuid, target_service_id uuid,
  requested_start timestamptz, request_key uuid,
  customer_name text, customer_email text, customer_phone text default null
)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  business public.businesses%rowtype;
  employee public.employees%rowtype;
  service public.services%rowtype;
  booking public.bookings%rowtype;
  customer_id_value uuid;
  fingerprint text;
  normalized_name text := btrim(customer_name);
  normalized_email text := lower(btrim(customer_email));
  normalized_phone text := nullif(btrim(customer_phone),'');
  end_value timestamptz;
  day_value date;
  periods tstzmultirange;
begin
  if request_key is null or target_employee_id is null or target_service_id is null
    or requested_start is null or not isfinite(requested_start)
    or requested_start < timestamptz '0001-01-01 UTC' or requested_start >= timestamptz '9999-01-01 UTC'
    or normalized_name is null or char_length(normalized_name) not between 1 and 120
    or normalized_email is null or char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_phone) > 40 then
    raise exception 'Invalid booking request' using errcode = '22023';
  end if;
  select * into business from public.businesses where slug = business_slug for share;
  if business.id is null then raise exception 'Booking unavailable' using errcode = '42501'; end if;
  fingerprint := encode(sha256(convert_to(jsonb_build_array(target_employee_id,target_service_id,
    extract(epoch from requested_start),normalized_name,normalized_email,normalized_phone)::text,'UTF8')),'hex');
  -- A chave serializa retries, incluindo tentativas que mudam de profissional.
  perform pg_advisory_xact_lock(hashtextextended(business.id::text || request_key::text,0));
  select * into booking from public.bookings where business_id = business.id and request_id = request_key;
  if booking.id is not null then
    if booking.request_fingerprint is distinct from fingerprint then
      raise exception 'Request key already used' using errcode = '22023';
    end if;
  else
    if not business.is_active or not business.public_booking_enabled then
      raise exception 'Booking unavailable' using errcode = '42501';
    end if;
    -- SHARE impede alterações do horário, bloqueios e associação durante validação
    -- e commit, incluindo DML direto permitido pelas policies existentes.
    lock table public.employee_working_hours, public.employee_blocked_periods, public.employee_services in share mode;
    select * into employee from public.employees where business_id = business.id and id = target_employee_id for update;
    select * into service from public.services where business_id = business.id and id = target_service_id for share;
    if employee.id is null or service.id is null or not employee.is_active or not service.is_active
      or not exists(select 1 from public.employee_services where business_id = business.id
        and employee_id = employee.id and service_id = service.id) then
      raise exception 'Booking unavailable' using errcode = '42501';
    end if;
    if service.duration_minutes > 44640 then
      raise exception 'Invalid service duration' using errcode = '22023';
    end if;
    end_value := requested_start + service.duration_minutes * interval '1 minute';
    day_value := (requested_start at time zone business.timezone)::date;
    periods := private.booking_working_periods(business.id,employee.id,day_value,business.timezone,service.duration_minutes);
    if requested_start < clock_timestamp() or not exists (
      select 1 from unnest(periods) as p
      where p @> tstzrange(requested_start,end_value,'[)')
        and mod(extract(epoch from requested_start - lower(p)),business.slot_interval_minutes * 60) = 0
    ) or exists (
      select 1 from public.employee_blocked_periods where business_id = business.id and employee_id = employee.id
        and starts_at < end_value and ends_at > requested_start
    ) then
      raise exception 'Slot unavailable' using errcode = '23P01';
    end if;
    insert into public.customers(business_id,name,email,phone)
      values (business.id,normalized_name,normalized_email,normalized_phone) returning id into customer_id_value;
    -- A exclusão GiST arbitra também escritas privilegiadas e pedidos concorrentes.
    insert into public.bookings(business_id,customer_id,employee_id,service_id,request_id,request_fingerprint,
      starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents,currency)
      values (business.id,customer_id_value,employee.id,service.id,request_key,fingerprint,
        requested_start,end_value,service.name,employee.name,service.duration_minutes,service.price_cents,business.currency)
      returning * into booking;
  end if;
  -- Recibo mínimo: não expõe contactos, customer_id nem dados de outras reservas.
  return jsonb_build_object('id',booking.id,'status',booking.status,'starts_at',booking.starts_at,
    'ends_at',booking.ends_at,'service_name',booking.service_name,'employee_name',booking.employee_name,
    'duration_minutes',booking.duration_minutes,'price_cents',booking.price_cents,'currency',booking.currency);
end;
$$;
revoke all on function public.confirm_booking(text,uuid,uuid,timestamptz,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.confirm_booking(text,uuid,uuid,timestamptz,uuid,text,text,text) to anon, authenticated;
comment on function public.confirm_booking(text,uuid,uuid,timestamptz,uuid,text,text,text) is
  'Confirmação atómica com revalidação e retries idempotentes; exige publicação explícita. Não ativa negócios existentes.';
