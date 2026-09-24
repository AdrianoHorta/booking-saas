alter table public.bookings add column cancelled_at timestamptz;
alter table public.bookings add column cancelled_by uuid references auth.users(id) on delete set null;

create function public.cancel_booking(target_business_id uuid, target_booking_id uuid)
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
    if booking.starts_at <= clock_timestamp() then
      raise exception 'Booking already started' using errcode = '22023';
    end if;
    update public.bookings set status = 'cancelled', cancelled_at = clock_timestamp(), cancelled_by = auth.uid()
      where id = booking.id returning * into booking;
  end if;
  return jsonb_build_object('id',booking.id,'status',booking.status,'cancelled_at',booking.cancelled_at);
end;
$$;
revoke all on function public.cancel_booking(uuid,uuid) from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid,uuid) to authenticated;
