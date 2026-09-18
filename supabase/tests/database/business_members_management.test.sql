begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email) values
 ('d2000000-0000-0000-0000-000000000001','member-owner@example.test'),
 ('d2000000-0000-0000-0000-000000000002','member-admin@example.test'),
 ('d2000000-0000-0000-0000-000000000003','member-worker@example.test'),
 ('d2000000-0000-0000-0000-000000000004','member-new@example.test');
insert into businesses(id,name,slug) values
 ('d1000000-0000-0000-0000-000000000001','Members A','members-manage-a'),
 ('d1000000-0000-0000-0000-000000000002','Members B','members-manage-b');
insert into business_members(business_id,user_id,role) values
 ('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000001','owner'),
 ('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000002','admin'),
 ('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000003','employee');
insert into employees(id,business_id,name,user_id) values
 ('d3000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Worker','d2000000-0000-0000-0000-000000000003');
insert into services(id,business_id,name,duration_minutes,price_cents) values
 ('d4000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Service',30,1000);
insert into employee_services(business_id,employee_id,service_id) values
 ('d1000000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001','d4000000-0000-0000-0000-000000000001');
insert into customers(id,business_id,name,email) values
 ('d5000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Client','client@example.test');
insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values
 ('d1000000-0000-0000-0000-000000000001','d5000000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001','d4000000-0000-0000-0000-000000000001',gen_random_uuid(),'2099-01-05 09:00Z','2099-01-05 09:30Z','Service','Worker',30,1000);
set local role anon;
select throws_ok($$select * from list_business_members('d1000000-0000-0000-0000-000000000001')$$,'42501',null,'Anonymous cannot list emails');
select throws_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-new@example.test','employee')$$,'42501',null,'Anonymous cannot add');
select throws_ok($$select remove_business_member('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000003')$$,'42501',null,'Anonymous cannot remove');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000003';
select throws_ok($$select * from list_business_members('d1000000-0000-0000-0000-000000000001')$$,'42501',null,'Employee cannot list emails');
select throws_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-new@example.test','employee')$$,'42501',null,'Employee cannot add');
select throws_ok($$select remove_business_member('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000002')$$,'42501',null,'Employee cannot remove');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000004';
select throws_ok($$select * from list_business_members('d1000000-0000-0000-0000-000000000001')$$,'42501',null,'Outsider cannot list emails');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000001';
select is((select count(*) from list_business_members('d1000000-0000-0000-0000-000000000001')),3::bigint,'Owner lists own members');
select is((select email from list_business_members('d1000000-0000-0000-0000-000000000001') where user_id='d2000000-0000-0000-0000-000000000003'),'member-worker@example.test','Manager sees member email');
select throws_ok($$select * from list_business_members('d1000000-0000-0000-0000-000000000002')$$,'42501',null,'Foreign members hidden');
select throws_ok($$select save_business_member('d1000000-0000-0000-0000-000000000002','member-new@example.test','employee')$$,'42501',null,'Cannot add in foreign tenant');
select throws_ok($$select remove_business_member('d1000000-0000-0000-0000-000000000002','d2000000-0000-0000-0000-000000000003')$$,'42501',null,'Cannot remove in foreign tenant');
select throws_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-new@example.test','owner')$$,'22023',null,'Cannot create another owner');
select throws_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-owner@example.test','employee')$$,'42501',null,'Cannot demote owner/self');
select throws_ok($$select remove_business_member('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000001')$$,'42501',null,'Cannot remove owner/self');
select throws_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','missing@example.test','employee')$$,'P0002',null,'Account must exist');
select is(save_business_member('d1000000-0000-0000-0000-000000000001',' MEMBER-NEW@example.test ','employee'),'d2000000-0000-0000-0000-000000000004'::uuid,'Adds existing account with normalized email');
select lives_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-new@example.test','employee')$$,'Adding twice is safe');
select is((select count(*) from list_business_members('d1000000-0000-0000-0000-000000000001')),4::bigint,'No duplicated member');
select lives_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-new@example.test','admin')$$,'Owner can promote');
select is((select role::text from business_members where business_id='d1000000-0000-0000-0000-000000000001' and user_id='d2000000-0000-0000-0000-000000000004'),'admin','Promotion persisted');
select lives_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-new@example.test','employee')$$,'Owner can demote admin');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000002';
select lives_ok($$select * from list_business_members('d1000000-0000-0000-0000-000000000001')$$,'Admin can list');
select throws_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-new@example.test','admin')$$,'42501',null,'Admin cannot promote');
select throws_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-admin@example.test','employee')$$,'42501',null,'Admin cannot change own access');
select throws_ok($$select remove_business_member('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000001')$$,'42501',null,'Admin cannot remove owner');
select lives_ok($$select save_business_member('d1000000-0000-0000-0000-000000000001','member-new@example.test','employee')$$,'Admin can save employee');
select lives_ok($$select remove_business_member('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000003')$$,'Admin can remove employee');
select is((select user_id from employees where id='d3000000-0000-0000-0000-000000000001'),null::uuid,'Removal detaches login');
select is((select count(*) from employees where id='d3000000-0000-0000-0000-000000000001'),1::bigint,'Professional preserved');
select is((select count(*) from bookings where business_id='d1000000-0000-0000-0000-000000000001'),1::bigint,'Booking preserved');
select is((select count(*) from employee_services where employee_id='d3000000-0000-0000-0000-000000000001'),1::bigint,'Services preserved');
select lives_ok($$select remove_business_member('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000003')$$,'Repeated removal is safe');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000003';
select is((select count(*) from businesses where id='d1000000-0000-0000-0000-000000000001'),0::bigint,'Removed member loses company access');
select is((select count(*) from bookings where business_id='d1000000-0000-0000-0000-000000000001'),0::bigint,'Removed member loses reservation access');
reset role;
select is((select count(*) from auth.users where id='d2000000-0000-0000-0000-000000000003'),1::bigint,'Account itself preserved');
select * from finish();
rollback;
