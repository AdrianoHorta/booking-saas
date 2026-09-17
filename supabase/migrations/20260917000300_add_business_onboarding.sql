create function public.create_business(
  business_name text,
  business_slug text,
  business_timezone text default 'Europe/Lisbon'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_business_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Constraints e trigger de timezone validam também chamadas fora do frontend.
  insert into public.businesses (name, slug, timezone)
  values (btrim(business_name), lower(btrim(business_slug)), btrim(business_timezone))
  returning id into created_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (created_business_id, current_user_id, 'owner');

  -- Qualquer erro anterior reverte a operação inteira, sem empresas órfãs.
  return created_business_id;
end;
$$;

revoke all on function public.create_business(text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_business(text, text, text) to authenticated;

comment on function public.create_business(text, text, text)
  is 'Cria empresa e owner numa transação, usando exclusivamente a identidade autenticada.';
