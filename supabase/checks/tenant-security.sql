-- Inspeção estrutural no SQL Editor. Não altera dados nem substitui testes RLS.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('businesses', 'business_members');

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename in ('businesses', 'business_members');

select role_name, table_name,
  has_table_privilege(role_name, 'public.' || table_name, 'SELECT') as can_select,
  has_table_privilege(role_name, 'public.' || table_name, 'INSERT') as can_insert,
  has_table_privilege(role_name, 'public.' || table_name, 'UPDATE') as can_update,
  has_table_privilege(role_name, 'public.' || table_name, 'DELETE') as can_delete
from (values ('anon'), ('authenticated')) as roles(role_name)
cross join (values ('businesses'), ('business_members')) as tables(table_name);
