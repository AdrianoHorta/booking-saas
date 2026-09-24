-- Only tenant-level revision signals are published, never booking/customer rows.
create table public.booking_revisions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  revision bigint not null default 1
);
alter table public.booking_revisions enable row level security;
revoke all on public.booking_revisions from public, anon, authenticated;
grant select on public.booking_revisions to authenticated;
create policy booking_revisions_members on public.booking_revisions
  for select to authenticated using (
    private.has_business_role(business_id, array['owner','admin','employee']::public.business_role[])
  );

create function private.notify_booking_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.booking_revisions(business_id) values (new.business_id)
  on conflict (business_id) do update
    set revision = public.booking_revisions.revision + 1;
  return new;
end;
$$;
revoke all on function private.notify_booking_revision() from public, anon, authenticated;
create trigger booking_revision_changed after insert or update on public.bookings
  for each row execute function private.notify_booking_revision();

alter publication supabase_realtime add table public.booking_revisions;
