create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.business_role as enum ('owner', 'admin', 'employee');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (
    char_length(slug) between 3 and 63
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  description text check (char_length(description) <= 2000),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 254),
  address text check (char_length(address) <= 500),
  logo_path text,
  timezone text not null default 'Europe/Lisbon',
  currency text not null default 'EUR' check (currency = 'EUR'),
  slot_interval_minutes integer not null default 15 check (
    slot_interval_minutes between 5 and 120 and slot_interval_minutes % 5 = 0
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- Restrict evita que apagar uma conta elimine silenciosamente o proprietário.
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.business_role not null default 'employee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- A chave primária começa por business_id; este índice serve a pesquisa por utilizador.
create index business_members_user_id_idx
  on public.business_members (user_id, business_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create function private.validate_business_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone
  ) then
    raise exception 'Invalid business timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.validate_business_timezone() from public, anon, authenticated;

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function private.set_updated_at();

create trigger business_members_updated_at
  before update on public.business_members
  for each row execute function private.set_updated_at();

create trigger businesses_valid_timezone
  before insert or update of timezone on public.businesses
  for each row execute function private.validate_business_timezone();

-- As tabelas nascem fechadas, mesmo antes da migration de leitura.
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
revoke all on table public.businesses, public.business_members from public, anon, authenticated;

comment on table public.businesses is 'Empresas privadas; o catálogo público será uma API separada.';
comment on table public.business_members is 'Acesso administrativo; não representa profissionais com agenda.';
