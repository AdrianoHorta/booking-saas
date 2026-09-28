-- Personal profiles are private. Only the avatar is exposed through the booking catalog.
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_path text,
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from public, anon, authenticated;
grant select on public.user_profiles to authenticated;
create policy profiles_read_self on public.user_profiles for select to authenticated using (user_id = (select auth.uid()));
create trigger profiles_updated_at before update on public.user_profiles for each row execute function private.set_updated_at();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('brand-images', 'brand-images', true, 5242880, array['image/jpeg','image/png','image/webp']);

-- Immutable object names: users/<uid>/<uuid>.webp or businesses/<id>/<uuid>.webp.
create function private.can_manage_brand_image(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and object_name ~ '^(users|businesses)/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' and (
    (split_part(object_name,'/',1)='users' and split_part(object_name,'/',2)=auth.uid()::text)
    or (split_part(object_name,'/',1)='businesses' and exists (
      select 1 from public.business_members where business_id::text=split_part(object_name,'/',2)
        and user_id=auth.uid() and role='owner'
    ))
  );
$$;
revoke all on function private.can_manage_brand_image(text) from public, anon, authenticated;
grant execute on function private.can_manage_brand_image(text) to authenticated;
create policy brand_images_insert on storage.objects for insert to authenticated
  with check (bucket_id='brand-images' and private.can_manage_brand_image(name));
create policy brand_images_read_own on storage.objects for select to authenticated
  using (bucket_id='brand-images' and private.can_manage_brand_image(name));
create policy brand_images_delete on storage.objects for delete to authenticated
  using (bucket_id='brand-images' and private.can_manage_brand_image(name));

create function public.get_my_profile() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return coalesce((select jsonb_build_object('full_name',full_name,'avatar_path',avatar_path)
    from public.user_profiles where user_id=auth.uid()), jsonb_build_object('full_name','','avatar_path',null));
end;
$$;
create function public.save_my_profile(profile_name text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if profile_name is null or char_length(btrim(profile_name)) not between 1 and 120 then
    raise exception 'Invalid name' using errcode='22023'; end if;
  insert into public.user_profiles(user_id,full_name) values(auth.uid(),btrim(profile_name))
    on conflict(user_id) do update set full_name=excluded.full_name;
  return public.get_my_profile();
end;
$$;
create function public.set_my_avatar(image_path text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if image_path is not null and (not private.can_manage_brand_image(image_path)
    or split_part(image_path,'/',1)<>'users' or not exists (
      select 1 from storage.objects where bucket_id='brand-images' and name=image_path)) then
    raise exception 'Invalid avatar' using errcode='42501'; end if;
  insert into public.user_profiles(user_id,avatar_path) values(auth.uid(),image_path)
    on conflict(user_id) do update set avatar_path=excluded.avatar_path;
  return public.get_my_profile();
end;
$$;

create function public.save_business_details(target_business_id uuid, business_name text,
  business_description text, business_phone text, business_email text, business_address text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.has_business_role(target_business_id,array['owner']::public.business_role[]) then
    raise exception 'Owner required' using errcode='42501'; end if;
  if business_name is null or char_length(btrim(business_name)) not between 2 and 120
    or char_length(business_description)>2000 or char_length(business_phone)>40
    or char_length(business_email)>254 or char_length(business_address)>500
    or (nullif(btrim(business_email),'') is not null and btrim(business_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Invalid business details' using errcode='22023'; end if;
  update public.businesses set name=btrim(business_name), description=nullif(btrim(business_description),''),
    phone=nullif(btrim(business_phone),''), email=nullif(btrim(business_email),''), address=nullif(btrim(business_address),'')
    where id=target_business_id;
end;
$$;
create function public.set_business_logo(target_business_id uuid, image_path text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.has_business_role(target_business_id,array['owner']::public.business_role[]) then
    raise exception 'Owner required' using errcode='42501'; end if;
  if image_path is not null and (not private.can_manage_brand_image(image_path)
    or split_part(image_path,'/',1)<>'businesses' or split_part(image_path,'/',2)<>target_business_id::text
    or not exists (select 1 from storage.objects where bucket_id='brand-images' and name=image_path)) then
    raise exception 'Invalid logo' using errcode='42501'; end if;
  update public.businesses set logo_path=image_path where id=target_business_id;
end;
$$;
revoke all on function public.get_my_profile(), public.save_my_profile(text), public.set_my_avatar(text),
  public.save_business_details(uuid,text,text,text,text,text), public.set_business_logo(uuid,text) from public,anon,authenticated;
grant execute on function public.get_my_profile(), public.save_my_profile(text), public.set_my_avatar(text),
  public.save_business_details(uuid,text,text,text,text,text), public.set_business_logo(uuid,text) to authenticated;

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
    'business', jsonb_build_object('name', business.name, 'logo_path', business.logo_path, 'slug', business.slug, 'timezone', business.timezone, 'cancellation_notice_hours', business.cancellation_notice_hours),
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', service.id, 'name', service.name,
        'duration_minutes', service.duration_minutes,
        'price_cents', service.price_cents, 'currency', 'EUR',
        'employees', (
          select jsonb_agg(jsonb_build_object('id', employee.id, 'name', employee.name, 'avatar_path', profile.avatar_path) order by employee.name, employee.id)
          from public.employee_services assignment
          join public.employees employee on employee.business_id = assignment.business_id and employee.id = assignment.employee_id
          left join public.user_profiles profile on profile.user_id = employee.user_id
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

