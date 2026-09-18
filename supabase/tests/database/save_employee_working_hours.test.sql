begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email) values
  ('72000000-0000-0000-0000-000000000001','schedules-1@example.test'),
  ('72000000-0000-0000-0000-000000000002','schedules-2@example.test'),
  ('72000000-0000-0000-0000-000000000003','schedules-3@example.test'),
  ('72000000-0000-0000-0000-000000000004','schedules-4@example.test'),
  ('72000000-0000-0000-0000-000000000005','schedules-5@example.test');
insert into businesses(id,name,slug) values ('71000000-0000-0000-0000-000000000001','Schedules A','schedules-test-a'),('71000000-0000-0000-0000-000000000002','Schedules B','schedules-test-b');
insert into business_members(business_id,user_id,role) values
  ('71000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','owner'),('71000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000002','admin'),('71000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000003','employee'),('71000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000004','owner');
insert into employees(id,business_id,name) values ('73000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','Ana'),('73000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','Bruno'),('73000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000001','Carla');
insert into employee_working_hours(id,business_id,employee_id,weekday,start_minute,end_minute,updated_at) values
  ('74000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',1,540,720,'2000-01-01'),
  ('74000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002',1,540,720,'2000-01-01');
insert into employee_blocked_periods(id,business_id,employee_id,starts_at,ends_at,updated_at) values
  ('74000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','2026-12-01 09:00Z','2026-12-01 12:00Z','2000-01-01'),
  ('74000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002','2026-12-01 09:00Z','2026-12-01 12:00Z','2000-01-01');

set local role authenticated;
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000001';
select lives_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[ {"weekday":1,"start_minute":540,"end_minute":720}, {"weekday":1,"start_minute":840,"end_minute":1080} ]')$$,'Owner replaces week with split day');
select is((select count(*) from employee_working_hours),2::bigint,'Both periods saved');
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',null)$$,'22023',null,'Null payload rejected');
select is((select count(*) from employee_working_hours),2::bigint,'Failed replacement restores previous periods');
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','{}')$$,'22023',null,'Object payload rejected');
select is((select count(*) from employee_working_hours),2::bigint,'Failed replacement restores previous periods');
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[{}]')$$,'23502',null,'Missing fields rejected');
select is((select count(*) from employee_working_hours),2::bigint,'Failed replacement restores previous periods');
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[{"weekday":1,"start_minute":720,"end_minute":540}]')$$,'23514',null,'Invalid range rejected');
select is((select count(*) from employee_working_hours),2::bigint,'Failed replacement restores previous periods');
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[{"weekday":1,"start_minute":540,"end_minute":720},{"weekday":1,"start_minute":600,"end_minute":780}]')$$,'23P01',null,'Overlap rejected');
select is((select count(*) from employee_working_hours),2::bigint,'Failed replacement restores previous periods');
select is((select sum(end_minute-start_minute) from employee_working_hours),420::bigint,'Previous durations unchanged after failed replacements');
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000002','[]')$$,'42501',null,'Cannot edit foreign employee');
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002','[]')$$,'42501',null,'Cannot edit foreign business');
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000099','[]')$$,'42501',null,'Missing employee rejected');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000003';
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[]')$$,'42501',null,'Employee cannot replace week');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000005';
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[]')$$,'42501',null,'Outsider cannot replace week');
set local "request.jwt.claim.sub" = '';
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[]')$$,'42501',null,'Missing identity rejected');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000002';
select lives_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[]')$$,'Admin can clear the week');
select is((select count(*) from employee_working_hours),0::bigint,'Empty week persisted');
select lives_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[{"weekday":7,"start_minute":1320,"end_minute":1440},{"weekday":1,"start_minute":0,"end_minute":120}]')$$,'Admin saves overnight shift split across week boundary');
select is((select count(*) from employee_working_hours),2::bigint,'Both overnight segments saved');
reset role;
set local role anon;
select throws_ok($$select save_employee_working_hours('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','[]')$$,'42501',null,'Anonymous cannot call RPC');
reset role;
select is((select count(*) from employee_working_hours where business_id='71000000-0000-0000-0000-000000000002'),1::bigint,'Other tenant unchanged');
select ok(not (select prosecdef from pg_proc where oid='public.save_employee_working_hours(uuid,uuid,jsonb)'::regprocedure),'RPC respects caller RLS');
select * from finish();
rollback;
