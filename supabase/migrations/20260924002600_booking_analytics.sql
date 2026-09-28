create function public.booking_analytics(target_business_id uuid, date_from date, date_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare tz text; range_start timestamptz; range_end timestamptz;
begin
  if not private.has_business_role(target_business_id,array['owner','admin']::public.business_role[]) then
    raise exception 'Analytics access not allowed' using errcode='42501'; end if;
  if date_from is null or date_to is null or not isfinite(date_from) or not isfinite(date_to)
    or date_from<date '0001-01-01' or date_to>date '9998-12-31' or date_to<date_from or date_to-date_from>365 then
    raise exception 'Choose a period of 1 to 366 days' using errcode='22023'; end if;
  select timezone into tz from public.businesses where id=target_business_id;
  range_start:=date_from::timestamp at time zone tz;
  range_end:=(date_to+1)::timestamp at time zone tz;
  return (with selected as (
    select * from public.bookings where business_id=target_business_id and starts_at>=range_start and starts_at<range_end
  ) select jsonb_build_object('confirmed',count(*) filter(where status='confirmed'),
    'cancelled',count(*) filter(where status='cancelled'),
    'booked_value_cents',coalesce(sum(price_cents) filter(where status='confirmed'),0),
    'booked_minutes',coalesce(sum(duration_minutes) filter(where status='confirmed'),0),
    'daily',(select coalesce(jsonb_agg(to_jsonb(days) order by days.date),'[]'::jsonb) from (
      select (starts_at at time zone tz)::date as date,count(*) filter(where status='confirmed') as confirmed,
        count(*) filter(where status='cancelled') as cancelled from selected group by 1) days),
    'services',(select coalesce(jsonb_agg(to_jsonb(s) order by s.confirmed desc,s.name),'[]'::jsonb) from (
      select service_name as name,count(*) filter(where status='confirmed') as confirmed,
        coalesce(sum(price_cents) filter(where status='confirmed'),0) as booked_value_cents from selected group by service_name) s))
    from selected);
end;
$$;
revoke all on function public.booking_analytics(uuid,date,date) from public,anon;
grant execute on function public.booking_analytics(uuid,date,date) to authenticated;
