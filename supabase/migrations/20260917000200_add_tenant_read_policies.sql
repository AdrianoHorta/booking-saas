-- Executada como proprietário para evitar recursão ao consultar business_members.
-- Não aceita user_id: a identidade vem exclusivamente da sessão autenticada.
create function private.has_business_role(
  target_business_id uuid,
  allowed_roles public.business_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members as member
    where member.business_id = target_business_id
      and member.user_id = (select auth.uid())
      and member.role = any (allowed_roles)
  );
$$;

revoke all on function private.has_business_role(uuid, public.business_role[])
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_business_role(uuid, public.business_role[])
  to authenticated;

grant select on table public.businesses, public.business_members to authenticated;

create policy businesses_read_by_members
  on public.businesses for select to authenticated
  using (
    private.has_business_role(id, array['owner', 'admin', 'employee']::public.business_role[])
  );

create policy members_read_self_or_managers
  on public.business_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_business_role(business_id, array['owner', 'admin']::public.business_role[])
  );

-- Sem grants de escrita e sem policies INSERT/UPDATE/DELETE nesta etapa.
-- Onboarding e gestão de membros receberão operações específicas na fase 4.
