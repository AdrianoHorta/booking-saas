begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-000000000001', 'onboarding-a@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'onboarding-b@example.test');

set local role anon;
select throws_ok($$select create_business('Blocked', 'onboarding-blocked')$$, '42501', null, 'Anonymous cannot call onboarding');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '';
select throws_ok($$select create_business('Blocked', 'onboarding-blocked')$$, '42501', null, 'Missing user identity is rejected');

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
select lives_ok($$select create_business('  Studio A  ', '  ONBOARDING-STUDIO-A  ', 'Europe/Lisbon')$$, 'Authenticated user creates business');
select is((select name from businesses where slug = 'onboarding-studio-a'), 'Studio A', 'Name and slug are normalized');
select is((select count(*) from business_members), 1::bigint, 'Owner membership is created');
select is((select role::text from business_members), 'owner', 'Creator becomes owner');
select is((select user_id from business_members), '20000000-0000-0000-0000-000000000001'::uuid, 'Owner is the current authenticated user');
select lives_ok($$select create_business('Second studio', 'onboarding-second')$$, 'User can create a second business');
select is((select count(*) from businesses), 2::bigint, 'Both businesses are visible to creator');
select throws_ok($$select create_business('Duplicate', 'onboarding-studio-a')$$, '23505', null, 'Duplicate slug is rejected');
select is((select count(*) from business_members), 2::bigint, 'Duplicate attempt adds no membership');
select throws_ok($$select create_business(' ', 'onboarding-empty')$$, '23514', null, 'Invalid name is rejected');
select throws_ok($$select create_business('Studio', 'invalid slug')$$, '23514', null, 'Invalid slug is rejected');
select throws_ok($$select create_business('Studio', 'onboarding-bad-zone', 'Mars/Olympus')$$, '23514', null, 'Invalid timezone is rejected');
select throws_ok($$select create_business(null, 'onboarding-null')$$, '23502', null, 'Null name is rejected');
select is((select count(*) from businesses), 2::bigint, 'Invalid requests leave no extra business');
select throws_ok($$update business_members set role = 'employee'$$, '42501', null, 'Onboarding does not open direct role changes');

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
select is((select count(*) from businesses), 0::bigint, 'Other user cannot see new businesses');
select is((select count(*) from business_members), 0::bigint, 'Other user cannot see owner associations');
select throws_ok($$select create_business('Collision', 'onboarding-studio-a')$$, '23505', null, 'Global slug uniqueness also applies across users');
select lives_ok($$select create_business('Studio B', 'onboarding-studio-b')$$, 'Second user can create own business');
select is((select count(*) from businesses), 1::bigint, 'Second user sees only own business');

reset role;
-- Falha deliberada na segunda inserção para provar atomicidade, não apenas validação.
create function pg_temp.reject_test_membership() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.businesses where id = new.business_id and slug = 'onboarding-rollback') then
    raise exception 'Simulated membership failure';
  end if;
  return new;
end;
$$;
create trigger test_membership_failure before insert on public.business_members
for each row execute function pg_temp.reject_test_membership();
set local role authenticated;
select throws_ok($$select create_business('Rollback', 'onboarding-rollback')$$, 'P0001', null, 'Membership failure rejects whole operation');
reset role;
select is((select count(*) from businesses where slug = 'onboarding-rollback'), 0::bigint, 'Failed second insert leaves no orphan business');

select * from finish();
rollback;
