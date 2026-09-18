begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id,email) values
  ('62000000-0000-0000-0000-000000000001', 'employees-0@example.test'),
  ('62000000-0000-0000-0000-000000000002', 'employees-1@example.test'),
  ('62000000-0000-0000-0000-000000000003', 'employees-2@example.test'),
  ('62000000-0000-0000-0000-000000000004', 'employees-3@example.test'),
  ('62000000-0000-0000-0000-000000000005', 'employees-4@example.test');
insert into businesses(id,name,slug) values
  ('61000000-0000-0000-0000-000000000001', 'Employees A', 'employees-test-a'),
  ('61000000-0000-0000-0000-000000000002', 'Employees B', 'employees-test-b');
insert into business_members(business_id,user_id,role) values
  ('61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','owner'),
  ('61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000002','admin'),
  ('61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000003','employee'),
  ('61000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000004','owner');
insert into services(id,business_id,name,duration_minutes,price_cents) values
  ('64000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','Service A',30,1000),
  ('64000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002','Service B',60,2000);
insert into employees(id,business_id,name,updated_at) values
  ('63000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','Employee A','2000-01-01'),
  ('63000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002','Employee B','2000-01-01');
insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002');
insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001');
insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001',1,540,720),('61000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002',1,540,720);
insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values
('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','2026-07-06 09:00Z','2026-07-06 10:00Z','Private detail'),
('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','2026-07-06 23:30Z','2026-07-07 00:00Z','After midnight'),
('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','2026-07-05 20:00Z','2026-07-05 23:00Z','Before window'),
('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','2026-07-08 23:00Z','2026-07-09 00:00Z','After window'),
('61000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','2026-07-06 09:00Z','2026-07-06 10:00Z','Other tenant');
set local role authenticated;
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000001';
select lives_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'owner can consult');
select is((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'timezone'),'Europe/Lisbon','Timezone comes from business');
select is((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'slot_interval_minutes')::integer,15,'Grid comes from business');
select is((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'duration_minutes')::integer,30,'Duration comes from service');
select ok((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'assigned')::boolean,'Assignment verified');
select is(jsonb_array_length(get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->'working_hours'),1,'Only selected employee hours');
select is(jsonb_array_length(get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->'blocked_periods'),2,'Only overlapping blocks, including following day');
select ok(not (get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')::text like '%Private detail%'),'Block labels not exposed by availability');
select ok((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'server_now')::timestamptz=statement_timestamp(),'Reference time comes from server');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002','2026-07-06')$$,'42501',null,'owner cannot consult another tenant');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'42501',null,'Foreign employee rejected');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000002','2026-07-06')$$,'42501',null,'Foreign service rejected');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000002';
select lives_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'admin can consult');
select is((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'timezone'),'Europe/Lisbon','Timezone comes from business');
select is((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'slot_interval_minutes')::integer,15,'Grid comes from business');
select is((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'duration_minutes')::integer,30,'Duration comes from service');
select ok((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'assigned')::boolean,'Assignment verified');
select is(jsonb_array_length(get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->'working_hours'),1,'Only selected employee hours');
select is(jsonb_array_length(get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->'blocked_periods'),2,'Only overlapping blocks, including following day');
select ok(not (get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')::text like '%Private detail%'),'Block labels not exposed by availability');
select ok((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'server_now')::timestamptz=statement_timestamp(),'Reference time comes from server');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002','2026-07-06')$$,'42501',null,'admin cannot consult another tenant');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'42501',null,'Foreign employee rejected');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000002','2026-07-06')$$,'42501',null,'Foreign service rejected');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000003';
select lives_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'employee can consult');
select is((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'timezone'),'Europe/Lisbon','Timezone comes from business');
select is((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'slot_interval_minutes')::integer,15,'Grid comes from business');
select is((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'duration_minutes')::integer,30,'Duration comes from service');
select ok((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'assigned')::boolean,'Assignment verified');
select is(jsonb_array_length(get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->'working_hours'),1,'Only selected employee hours');
select is(jsonb_array_length(get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->'blocked_periods'),2,'Only overlapping blocks, including following day');
select ok(not (get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')::text like '%Private detail%'),'Block labels not exposed by availability');
select ok((get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'server_now')::timestamptz=statement_timestamp(),'Reference time comes from server');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002','2026-07-06')$$,'42501',null,'employee cannot consult another tenant');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'42501',null,'Foreign employee rejected');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000002','2026-07-06')$$,'42501',null,'Foreign service rejected');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000001';
update employees set is_active=false where id='63000000-0000-0000-0000-000000000001';
select ok(not (get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'employee_active')::boolean,'Inactive employee reported');
update employees set is_active=true where id='63000000-0000-0000-0000-000000000001';
update services set is_active=false where id='64000000-0000-0000-0000-000000000001';
select ok(not (get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'service_active')::boolean,'Inactive service reported');
update services set is_active=true where id='64000000-0000-0000-0000-000000000001';
delete from employee_services where business_id='61000000-0000-0000-0000-000000000001' and employee_id='63000000-0000-0000-0000-000000000001';
select ok(not (get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'assigned')::boolean,'Missing assignment reported');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',null)$$,'22023',null,'Null date rejected');
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','infinity')$$,'22023',null,'Infinite date rejected');
update services set duration_minutes=44641 where id='64000000-0000-0000-0000-000000000001';
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'22023',null,'Oversized calculation rejected');
update services set duration_minutes=30 where id='64000000-0000-0000-0000-000000000001';
reset role;
update businesses set is_active=false where id='61000000-0000-0000-0000-000000000001';
set local role authenticated;
select ok(not (get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')->>'business_active')::boolean,'Inactive business reported');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000005';
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'42501',null,'Outsider rejected');
set local "request.jwt.claim.sub" = '';
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'42501',null,'Missing identity rejected');
reset role;
set local role anon;
select throws_ok($$select get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','2026-07-06')$$,'42501',null,'Anonymous cannot execute');
reset role;
select ok(not (select prosecdef from pg_proc where oid='public.get_availability_context(uuid,uuid,uuid,date)'::regprocedure),'Availability respects caller RLS');
select is((select provolatile::text from pg_proc where oid='public.get_availability_context(uuid,uuid,uuid,date)'::regprocedure),'s','Read function uses stable snapshot');
select * from finish();
rollback;
