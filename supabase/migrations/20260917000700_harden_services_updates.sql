-- Só dados do catálogo são editáveis; a identidade e o tenant são imutáveis.
revoke all on table public.services from public, anon, authenticated;
grant select on table public.services to authenticated;
grant insert (business_id, name, description, duration_minutes, price_cents, is_active)
  on public.services to authenticated;
grant update (name, description, duration_minutes, price_cents, is_active)
  on public.services to authenticated;

create trigger services_updated_at
  before update on public.services
  for each row execute function private.set_updated_at();
