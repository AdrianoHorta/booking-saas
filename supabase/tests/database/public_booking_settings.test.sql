begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email) values
 ('c2000000-0000-0000-0000-000000000001','publication-owner@example.test'),
 ('c2000000-0000-0000-0000-000000000002','publication-admin@example.test'),
 ('c2000000-0000-0000-0000-000000000003','publication-employee@example.test'),
 ('c2000000-0000-0000-0000-000000000004','publication-outsider@example.test');
insert into businesses(id,name,slug) values
 ('c1000000-0000-0000-0000-000000000001','Publication A','publication-test-a'),
 ('c1000000-0000-0000-0000-000000000002','Publication B','publication-test-b');
insert into business_members(business_id,user_id,role) values
 ('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001','owner'),
 ('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000002','admin'),
 ('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000003','employee');
set local role anon;
select throws_ok($$select set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',true)$$,'42501',null,'Anonymous cannot change publication');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c2000000-0000-0000-0000-000000000001';
select is(set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',true),true,'Owner can publish');
select is((select public_booking_enabled from businesses where id='c1000000-0000-0000-0000-000000000001'),true,'Publication persisted');
select is(set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',true),true,'Repeated target state is idempotent');
select throws_ok($$select set_public_booking_enabled('c1000000-0000-0000-0000-000000000002',true)$$,'42501',null,'Owner cannot publish foreign business');
select throws_ok($$select set_public_booking_enabled('c1000000-0000-0000-0000-000000000099',true)$$,'42501',null,'Missing business rejected');
select throws_ok($$select set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',null)$$,'22023',null,'Null state rejected');
select throws_ok($$update businesses set public_booking_enabled=false where id='c1000000-0000-0000-0000-000000000001'$$,'42501',null,'Direct table update stays closed');
reset role;
set local role anon;
select lives_ok($$select get_public_booking_catalog('publication-test-a')$$,'Published catalog available immediately');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c2000000-0000-0000-0000-000000000002';
select is(set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',false),false,'Admin can unpublish');
reset role;
set local role anon;
select throws_ok($$select get_public_booking_catalog('publication-test-a')$$,'42501',null,'Unpublishing closes catalog');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c2000000-0000-0000-0000-000000000003';
select throws_ok($$select set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',true)$$,'42501',null,'Employee cannot publish');
set local "request.jwt.claim.sub" = 'c2000000-0000-0000-0000-000000000004';
select throws_ok($$select set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',true)$$,'42501',null,'Outsider cannot publish');
set local "request.jwt.claim.sub" = '';
select throws_ok($$select set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',true)$$,'42501',null,'Missing identity rejected');
reset role;
update businesses set is_active=false,public_booking_enabled=true where id='c1000000-0000-0000-0000-000000000001';
set local role authenticated;
set local "request.jwt.claim.sub" = 'c2000000-0000-0000-0000-000000000002';
select throws_ok($$select set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',true)$$,'22023',null,'Inactive business cannot be published');
select is(set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',false),false,'Inactive business can be unpublished');
reset role;
update businesses set is_active=true where id='c1000000-0000-0000-0000-000000000001';
set local role authenticated;
set local "request.jwt.claim.sub" = 'c2000000-0000-0000-0000-000000000002';
select is(set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',true),true,'Admin can publish');
set local "request.jwt.claim.sub" = 'c2000000-0000-0000-0000-000000000001';
select is(set_public_booking_enabled('c1000000-0000-0000-0000-000000000001',false),false,'Owner can unpublish');
reset role;
select * from finish();
rollback;
