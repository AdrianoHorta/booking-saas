begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'bruno@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'outsider@example.test');

insert into public.businesses (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Empresa A', 'empresa-a'),
  ('10000000-0000-0000-0000-000000000002', 'Empresa B', 'empresa-b');

insert into public.business_members (business_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'owner');

select ok((select relrowsecurity from pg_class where oid = 'public.businesses'::regclass), 'Businesses has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.business_members'::regclass), 'Members has RLS enabled');
select throws_ok($$insert into businesses(name, slug) values ('Duplicate', 'empresa-a')$$, '23505', null, 'Slug is unique');
select throws_ok($$insert into businesses(name, slug) values ('Invalid', 'Upper Case')$$, '23514', null, 'Slug must be normalized');
select throws_ok($$insert into businesses(name, slug) values (' ', 'blank-name')$$, '23514', null, 'Blank name is rejected');
select throws_ok($$insert into businesses(name, slug, timezone) values ('Invalid', 'bad-zone', 'Mars/Olympus')$$, '23514', null, 'Invalid timezone is rejected');
select throws_ok($$insert into businesses(name, slug, slot_interval_minutes) values ('Invalid', 'bad-slot', 0)$$, '23514', null, 'Zero slot interval is rejected');
select throws_ok($$insert into business_members(business_id, user_id) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')$$, '23505', null, 'Membership cannot be duplicated');
select throws_ok($$insert into business_members(business_id, user_id) values ('10000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001')$$, '23503', null, 'Membership requires an existing business');
select throws_ok($$delete from auth.users where id = '00000000-0000-0000-0000-000000000001'$$, '23503', null, 'Deleting an account cannot silently remove memberships');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select is((select count(*) from businesses), 1::bigint, 'Alice sees only her business');
select is((select count(*) from businesses where slug = 'empresa-b'), 0::bigint, 'Explicit filter cannot expose business B');
select is((select count(*) from business_members), 1::bigint, 'Alice cannot enumerate other memberships');
select throws_ok($$insert into businesses(name, slug) values ('Attack', 'attack')$$, '42501', null, 'Direct business creation is closed');
select throws_ok($$insert into business_members(business_id, user_id, role) values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'owner')$$, '42501', null, 'Cannot join another business as owner');
select throws_ok($$update business_members set role = 'admin'$$, '42501', null, 'Direct role changes are closed');
select throws_ok($$delete from business_members$$, '42501', null, 'Direct member deletion is closed');
select throws_ok($$update businesses set name = 'Changed'$$, '42501', null, 'Direct business updates are closed');
select throws_ok($$delete from businesses$$, '42501', null, 'Direct business deletion is closed');

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select is((select slug from businesses), 'empresa-b', 'Bruno sees his own business');
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
select is((select count(*) from businesses), 0::bigint, 'Authenticated outsider sees no businesses');
select is((select count(*) from business_members), 0::bigint, 'Authenticated outsider sees no members');

reset role;
insert into business_members(business_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'employee');
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select is((select count(*) from businesses), 2::bigint, 'A user may belong to multiple businesses');
select is((select count(*) from business_members where business_id = '10000000-0000-0000-0000-000000000002'), 1::bigint, 'Employee sees only own membership in business B');
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select is((select count(*) from business_members), 2::bigint, 'Owner sees the members of their business');

reset role;
update business_members set role = 'admin'
where business_id = '10000000-0000-0000-0000-000000000002'
  and user_id = '00000000-0000-0000-0000-000000000001';
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select is((select count(*) from business_members where business_id = '10000000-0000-0000-0000-000000000002'), 2::bigint, 'Admin sees members of their business');

reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';
select throws_ok($$select * from businesses$$, '42501', null, 'Anonymous cannot read private businesses');
select throws_ok($$select * from business_members$$, '42501', null, 'Anonymous cannot read memberships');
select throws_ok($$select private.has_business_role('10000000-0000-0000-0000-000000000001', array['owner']::public.business_role[])$$, '42501', null, 'Anonymous cannot execute the policy helper');
reset role;

select * from finish();
rollback;
