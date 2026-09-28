-- Transactional outbox. No customer data or credentials are exposed by the queue.
alter table public.businesses add column booking_emails_enabled boolean not null default false;
alter table public.employee_calendar_credentials add column sync_generation uuid not null default gen_random_uuid();

create table private.booking_deliveries (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel text not null check(channel in ('calendar','email')),
  event text not null check(event in ('confirmed','rescheduled','cancelled')),
  payload jsonb not null,
  employee_id uuid not null,
  calendar_id text,
  generation uuid,
  state text not null default 'pending' check(state in ('pending','processing','done','skipped','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease uuid,
  lease_until timestamptz,
  first_attempt_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
revoke all on private.booking_deliveries from public,anon,authenticated;
create index booking_deliveries_pending on private.booking_deliveries(available_at,id) where state in ('pending','processing');
create index booking_deliveries_order on private.booking_deliveries(booking_id,channel,id);

create function private.enqueue_booking_delivery(b public.bookings, kind text, destination text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.employee_calendar_credentials; snapshot jsonb;
begin
  if destination='calendar' then
    select * into c from public.employee_calendar_credentials where employee_id=b.employee_id
      and business_id=b.business_id and credentials is not null and calendar_id is not null;
    if not found then return; end if;
  elsif not (select booking_emails_enabled from public.businesses where id=b.business_id) then return;
  end if;
  select jsonb_build_object('booking_id',b.id,'business_name',biz.name,'timezone',biz.timezone,
    'service_name',b.service_name,'employee_name',b.employee_name,'starts_at',b.starts_at,'ends_at',b.ends_at,
    'status',b.status,'price_cents',b.price_cents,'currency',b.currency,
    'cancellation_notice_hours',b.cancellation_notice_hours) ||
    case when destination='email' then jsonb_build_object('email',cust.email) else '{}'::jsonb end
    into snapshot from public.businesses biz join public.customers cust on cust.business_id=biz.id
    where biz.id=b.business_id and cust.id=b.customer_id;
  insert into private.booking_deliveries(booking_id,business_id,channel,event,payload,employee_id,calendar_id,generation)
    values(b.id,b.business_id,destination,kind,snapshot,b.employee_id,c.calendar_id,c.sync_generation);
end;
$$;
revoke all on function private.enqueue_booking_delivery(public.bookings,text,text) from public,anon,authenticated;

create function private.enqueue_booking_changes() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text;
begin
  if tg_op='INSERT' then kind:='confirmed';
  elsif new.status is distinct from old.status then kind:='cancelled';
  elsif new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then kind:='rescheduled';
  else return new; end if;
  perform private.enqueue_booking_delivery(new,kind,'calendar');
  perform private.enqueue_booking_delivery(new,kind,'email');
  return new;
end;
$$;
revoke all on function private.enqueue_booking_changes() from public,anon,authenticated;
create trigger bookings_integrations after insert or update on public.bookings for each row execute function private.enqueue_booking_changes();

create function private.calendar_sync_generation() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.credentials is distinct from old.credentials or new.calendar_id is distinct from old.calendar_id then
    new.sync_generation:=gen_random_uuid();
  end if;
  return new;
end;
$$;
revoke all on function private.calendar_sync_generation() from public,anon,authenticated;
create trigger calendar_sync_generation before update on public.employee_calendar_credentials
  for each row execute function private.calendar_sync_generation();

-- Selecting/reselecting a calendar reconciles future bookings and cancellations
-- previously queued for this destination. Switching calendars preserves old events.
create function private.enqueue_calendar_selection() returns trigger
language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
  if new.calendar_id is null or new.credentials is null or new.sync_generation=old.sync_generation then return new; end if;
  for b in select * from public.bookings bk where bk.employee_id=new.employee_id and bk.business_id=new.business_id
    and ((bk.status='confirmed' and bk.ends_at>now()) or (bk.status='cancelled' and exists(
      select 1 from private.booking_deliveries d where d.booking_id=bk.id and d.channel='calendar' and d.calendar_id=new.calendar_id)))
  loop
    perform private.enqueue_booking_delivery(b,case when b.status='cancelled' then 'cancelled' else 'confirmed' end,'calendar');
  end loop;
  return new;
end;
$$;
revoke all on function private.enqueue_calendar_selection() from public,anon,authenticated;
create trigger enqueue_calendar_selection after update on public.employee_calendar_credentials
  for each row execute function private.enqueue_calendar_selection();

create function public.claim_booking_delivery(channels text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.booking_deliveries;
begin
  -- Expired uncertain email attempts are never retried past Resend's 24h window.
  update private.booking_deliveries set state='failed',error_code='retry_window_expired',finished_at=now()
    where state in ('pending','processing') and (lease_until is null or lease_until<now())
      and (attempts>=8 or (channel='email' and first_attempt_at<now()-interval '23 hours'));
  select * into d from private.booking_deliveries q
    where q.channel=any(channels) and q.state in ('pending','processing') and q.available_at<=now()
      and (q.lease_until is null or q.lease_until<now())
      and not exists(select 1 from private.booking_deliveries previous where previous.booking_id=q.booking_id
        and previous.channel=q.channel and previous.id<q.id and previous.state in ('pending','processing'))
    order by q.id for update skip locked limit 1;
  if not found then return null; end if;
  update private.booking_deliveries set state='processing',lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',
    attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()) where id=d.id returning * into d;
  return jsonb_build_object('id',d.id::text,'lease',d.lease,'channel',d.channel);
end;
$$;
revoke all on function public.claim_booking_delivery(text[]) from public,anon,authenticated;
grant execute on function public.claim_booking_delivery(text[]) to service_role;

create function public.prepare_booking_delivery(delivery_id bigint, lease_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.booking_deliveries; c public.employee_calendar_credentials;
begin
  select * into d from private.booking_deliveries where id=delivery_id and lease=lease_id
    and state='processing' and lease_until>now();
  if not found then return null; end if;
  if d.channel='calendar' then
    select cc.* into c from public.employee_calendar_credentials cc join public.employees e on e.id=cc.employee_id
      and e.business_id=cc.business_id and e.user_id=cc.user_id and e.is_active
      join public.business_members m on m.business_id=e.business_id and m.user_id=e.user_id
      where cc.employee_id=d.employee_id and cc.business_id=d.business_id and cc.sync_generation=d.generation
        and cc.calendar_id=d.calendar_id and cc.credentials is not null;
    if not found then return null; end if;
    -- An older intent must not recreate a booking cancelled or moved afterwards.
    if exists(select 1 from private.booking_deliveries newer where newer.booking_id=d.booking_id
      and newer.channel='calendar' and newer.generation=d.generation and newer.id>d.id) then return null; end if;
  elsif not (select booking_emails_enabled from public.businesses where id=d.business_id) then return null;
  end if;
  return jsonb_build_object('id',d.id::text,'channel',d.channel,'event',d.event,'payload',d.payload,
    'calendar_id',d.calendar_id,'credentials',c.credentials,
    'cancellation_token',case when d.channel='email' then private.booking_cancel_token(d.booking_id) else null end);
end;
$$;
revoke all on function public.prepare_booking_delivery(bigint,uuid) from public,anon,authenticated;
grant execute on function public.prepare_booking_delivery(bigint,uuid) to service_role;

create function public.finish_booking_delivery(delivery_id bigint, lease_id uuid, outcome text, failure_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if outcome is null or outcome not in ('done','skipped','retry','failed') then raise exception 'Invalid outcome' using errcode='22023'; end if;
  if failure_code is not null and failure_code not in ('provider_unavailable','reconnect','configuration','provider_rejected','retry_window_expired') then
    raise exception 'Invalid failure code' using errcode='22023'; end if;
  update private.booking_deliveries set state=case when outcome='retry' then case when attempts>=8 then 'failed' else 'pending' end else outcome end,
    available_at=now()+least(3600,30*power(2,least(attempts,7))) * interval '1 second',
    error_code=failure_code,lease=null,lease_until=null,
    finished_at=case when outcome<>'retry' or attempts>=8 then now() else null end
    where id=delivery_id and lease=lease_id and state='processing' and lease_until>now();
  return found;
end;
$$;
revoke all on function public.finish_booking_delivery(bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_booking_delivery(bigint,uuid,text,text) to service_role;

create function public.booking_integration_status(target_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.has_business_role(target_business_id,array['owner','admin']::public.business_role[]) then
    raise exception 'Integration management not allowed' using errcode='42501'; end if;
  return jsonb_build_object('emails_enabled',(select booking_emails_enabled from public.businesses where id=target_business_id),
    'deliveries',(select coalesce(jsonb_agg(to_jsonb(recent) order by recent.id::bigint desc),'[]'::jsonb) from
      (select id::text,channel,event,state,attempts,error_code,created_at,finished_at from private.booking_deliveries
        where business_id=target_business_id order by id desc limit 30) recent));
end;
$$;
revoke all on function public.booking_integration_status(uuid) from public,anon;
grant execute on function public.booking_integration_status(uuid) to authenticated;

create function public.set_booking_emails_enabled(target_business_id uuid, enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not private.has_business_role(target_business_id,array['owner','admin']::public.business_role[]) then
    raise exception 'Integration management not allowed' using errcode='42501'; end if;
  if enabled is null then raise exception 'Missing setting' using errcode='22023'; end if;
  update public.businesses set booking_emails_enabled=enabled where id=target_business_id;
  return enabled;
end;
$$;
revoke all on function public.set_booking_emails_enabled(uuid,boolean) from public,anon;
grant execute on function public.set_booking_emails_enabled(uuid,boolean) to authenticated;
