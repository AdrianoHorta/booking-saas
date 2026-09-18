-- Operação restrita: não concede UPDATE direto na empresa.
create function public.set_public_booking_enabled(target_business_id uuid, enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  business public.businesses%rowtype;
begin
  if not private.has_business_role(target_business_id, array['owner','admin']::public.business_role[]) then
    raise exception 'Publication management not allowed' using errcode = '42501';
  end if;
  if enabled is null then
    raise exception 'Publication state required' using errcode = '22023';
  end if;
  select * into business from public.businesses where id = target_business_id for update;
  if business.id is null then
    raise exception 'Publication management not allowed' using errcode = '42501';
  end if;
  if enabled and not business.is_active then
    raise exception 'Inactive business cannot be published' using errcode = '22023';
  end if;
  update public.businesses set public_booking_enabled = enabled where id = business.id;
  return enabled;
end;
$$;
revoke all on function public.set_public_booking_enabled(uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_public_booking_enabled(uuid,boolean) to authenticated;
