create table public.services (
  id uuid primary key default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete cascade,

  name text not null,

  description text,

  duration_minutes integer not null,

  price_cents integer not null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint services_name_not_empty
    check (char_length(trim(name)) > 0),

  constraint services_duration_positive
    check (duration_minutes > 0),

  constraint services_price_non_negative
    check (price_cents >= 0)
);

create index services_business_id_idx
  on public.services (business_id);