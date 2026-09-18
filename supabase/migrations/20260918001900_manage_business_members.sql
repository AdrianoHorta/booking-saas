create function public.list_business_members(target_business_id uuid)
returns table(user_id uuid, email text, role public.business_role)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_business_role(target_business_id, array['owner','admin']::public.business_role[]) then
    raise exception 'Member management not allowed' using errcode = '42501';
  end if;
  return query select m.user_id, u.email::text, m.role from public.business_members m
    join auth.users u on u.id = m.user_id where m.business_id = target_business_id
    order by m.created_at, m.user_id;
end;
$$;

-- Sem transferência de propriedade: owner só pode ser criado pelo onboarding.
create function public.save_business_member(target_business_id uuid, member_email text, member_role public.business_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_role public.business_role;
  existing_role public.business_role;
  target_user uuid;
begin
  if not private.has_business_role(target_business_id, array['owner','admin']::public.business_role[]) then
    raise exception 'Member management not allowed' using errcode = '42501';
  end if;
  -- Serializa gestão de membros da empresa e revalida a autorização após o lock.
  perform 1 from public.businesses where id = target_business_id for update;
  select role into actor_role from public.business_members where business_id = target_business_id and user_id = auth.uid();
  if actor_role is null or actor_role not in ('owner','admin') then
    raise exception 'Member management not allowed' using errcode = '42501';
  end if;
  if member_role is null or member_role not in ('admin','employee')
    or member_email is null or char_length(btrim(member_email)) not between 3 and 254 then
    raise exception 'Invalid member selection' using errcode = '22023';
  end if;
  if actor_role = 'admin' and member_role <> 'employee' then
    raise exception 'Member management not allowed' using errcode = '42501';
  end if;
  select id into target_user from auth.users where lower(email) = lower(btrim(member_email));
  if target_user is null then
    raise exception 'Registered account required' using errcode = 'P0002';
  end if;
  select role into existing_role from public.business_members where business_id = target_business_id and user_id = target_user;
  if target_user = auth.uid() or existing_role = 'owner' or (actor_role = 'admin' and existing_role = 'admin') then
    raise exception 'Member management not allowed' using errcode = '42501';
  end if;
  insert into public.business_members(business_id,user_id,role) values(target_business_id,target_user,member_role)
    on conflict (business_id,user_id) do update set role = excluded.role;
  return target_user;
end;
$$;

create function public.remove_business_member(target_business_id uuid, target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_role public.business_role; target_role public.business_role;
begin
  if not private.has_business_role(target_business_id, array['owner','admin']::public.business_role[]) then
    raise exception 'Member management not allowed' using errcode = '42501';
  end if;
  perform 1 from public.businesses where id = target_business_id for update;
  select role into actor_role from public.business_members where business_id = target_business_id and user_id = auth.uid();
  select role into target_role from public.business_members where business_id = target_business_id and user_id = target_user_id;
  if actor_role is null or actor_role not in ('owner','admin') or target_user_id is null
    or target_user_id = auth.uid() or target_role = 'owner' or (actor_role = 'admin' and target_role = 'admin') then
    raise exception 'Member management not allowed' using errcode = '42501';
  end if;
  -- Preserva o profissional, serviços, horários e reservas, retirando apenas o login.
  update public.employees set user_id = null where business_id = target_business_id and user_id = target_user_id;
  delete from public.business_members where business_id = target_business_id and user_id = target_user_id;
end;
$$;
revoke all on function public.list_business_members(uuid) from public, anon, authenticated;
revoke all on function public.save_business_member(uuid,text,public.business_role) from public, anon, authenticated;
revoke all on function public.remove_business_member(uuid,uuid) from public, anon, authenticated;
grant execute on function public.list_business_members(uuid) to authenticated;
grant execute on function public.save_business_member(uuid,text,public.business_role) to authenticated;
grant execute on function public.remove_business_member(uuid,uuid) to authenticated;
