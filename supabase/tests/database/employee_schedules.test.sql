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

-- employee_working_hours: RLS, grants e identidade imutável.
select ok((select relrowsecurity from pg_class where oid='public.employee_working_hours'::regclass),'employee_working_hours has RLS');
set local role authenticated;
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000001';
select is((select count(*) from employee_working_hours),1::bigint,'owner reads only own employee_working_hours');
select lives_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',5,540,720)$$,'owner inserts employee_working_hours');
with removed as (delete from employee_working_hours where weekday=5 returning id)
select is((select count(*) from removed),1::bigint,'owner deletes own employee_working_hours');
select lives_ok($$update employee_working_hours set end_minute=780 where id='74000000-0000-0000-0000-000000000001'$$,'owner edits employee_working_hours');
select ok((select end_minute=780 and updated_at>'2000-01-01'::timestamptz from employee_working_hours where id='74000000-0000-0000-0000-000000000001'),'owner edit and timestamp persist');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002',5,540,720)$$,'42501',null,'owner cannot insert in other tenant');
with changed as (update employee_working_hours set end_minute=780 where id='74000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from changed),0::bigint,'owner cannot edit other tenant');
with removed as (delete from employee_working_hours where id='74000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from removed),0::bigint,'owner cannot delete other tenant');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000002';
select is((select count(*) from employee_working_hours),1::bigint,'admin reads only own employee_working_hours');
select lives_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',5,540,720)$$,'admin inserts employee_working_hours');
with removed as (delete from employee_working_hours where weekday=5 returning id)
select is((select count(*) from removed),1::bigint,'admin deletes own employee_working_hours');
select lives_ok($$update employee_working_hours set end_minute=780 where id='74000000-0000-0000-0000-000000000001'$$,'admin edits employee_working_hours');
select ok((select end_minute=780 and updated_at>'2000-01-01'::timestamptz from employee_working_hours where id='74000000-0000-0000-0000-000000000001'),'admin edit and timestamp persist');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002',5,540,720)$$,'42501',null,'admin cannot insert in other tenant');
with changed as (update employee_working_hours set end_minute=780 where id='74000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from changed),0::bigint,'admin cannot edit other tenant');
with removed as (delete from employee_working_hours where id='74000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from removed),0::bigint,'admin cannot delete other tenant');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000002',5,540,720)$$,'23503',null,'Foreign employee rejected by composite FK');
select throws_ok($$update employee_working_hours set business_id='71000000-0000-0000-0000-000000000002' where id='74000000-0000-0000-0000-000000000001'$$,'42501',null,'Tenant cannot be changed');
select throws_ok($$update employee_working_hours set employee_id='73000000-0000-0000-0000-000000000003' where id='74000000-0000-0000-0000-000000000001'$$,'42501',null,'Employee cannot be reassigned');
select throws_ok($$update employee_working_hours set updated_at='2000-01-01' where id='74000000-0000-0000-0000-000000000001'$$,'42501',null,'Timestamp cannot be forged');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000003';
select is((select count(*) from employee_working_hours),1::bigint,'Employee reads own tenant');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',5,540,720)$$,'42501',null,'Employee cannot insert');
with changed as (update employee_working_hours set end_minute=780 where id='74000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from changed),0::bigint,'Employee cannot edit');
with removed as (delete from employee_working_hours where id='74000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from removed),0::bigint,'Employee cannot delete');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000004';
select is((select count(*) from employee_working_hours where id='74000000-0000-0000-0000-000000000001'),0::bigint,'B owner cannot read A by ID');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000005';
select is((select count(*) from employee_working_hours),0::bigint,'Outsider sees no rows');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',5,540,720)$$,'42501',null,'Outsider cannot insert');
set local "request.jwt.claim.sub" = '';
select is((select count(*) from employee_working_hours),0::bigint,'Missing identity sees no rows');
reset role;
set local role anon;
select throws_ok($$select * from employee_working_hours$$,'42501',null,'Anonymous cannot read');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',5,540,720)$$,'42501',null,'Anonymous cannot insert');
select throws_ok($$update employee_working_hours set end_minute=780$$,'42501',null,'Anonymous cannot update');
select throws_ok($$delete from employee_working_hours$$,'42501',null,'Anonymous cannot delete');
reset role;

-- employee_blocked_periods: RLS, grants e identidade imutável.
select ok((select relrowsecurity from pg_class where oid='public.employee_blocked_periods'::regclass),'employee_blocked_periods has RLS');
set local role authenticated;
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000001';
select is((select count(*) from employee_blocked_periods),1::bigint,'owner reads only own employee_blocked_periods');
select lives_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','2026-12-02 09:00Z','2026-12-02 12:00Z','Temporary')$$,'owner inserts employee_blocked_periods');
with removed as (delete from employee_blocked_periods where label='Temporary' returning id)
select is((select count(*) from removed),1::bigint,'owner deletes own employee_blocked_periods');
select lives_ok($$update employee_blocked_periods set label='Edited' where id='74000000-0000-0000-0000-000000000001'$$,'owner edits employee_blocked_periods');
select ok((select label='Edited' and updated_at>'2000-01-01'::timestamptz from employee_blocked_periods where id='74000000-0000-0000-0000-000000000001'),'owner edit and timestamp persist');
select throws_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002','2026-12-02 09:00Z','2026-12-02 12:00Z','Temporary')$$,'42501',null,'owner cannot insert in other tenant');
with changed as (update employee_blocked_periods set label='Edited' where id='74000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from changed),0::bigint,'owner cannot edit other tenant');
with removed as (delete from employee_blocked_periods where id='74000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from removed),0::bigint,'owner cannot delete other tenant');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000002';
select is((select count(*) from employee_blocked_periods),1::bigint,'admin reads only own employee_blocked_periods');
select lives_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','2026-12-02 09:00Z','2026-12-02 12:00Z','Temporary')$$,'admin inserts employee_blocked_periods');
with removed as (delete from employee_blocked_periods where label='Temporary' returning id)
select is((select count(*) from removed),1::bigint,'admin deletes own employee_blocked_periods');
select lives_ok($$update employee_blocked_periods set label='Edited' where id='74000000-0000-0000-0000-000000000001'$$,'admin edits employee_blocked_periods');
select ok((select label='Edited' and updated_at>'2000-01-01'::timestamptz from employee_blocked_periods where id='74000000-0000-0000-0000-000000000001'),'admin edit and timestamp persist');
select throws_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002','2026-12-02 09:00Z','2026-12-02 12:00Z','Temporary')$$,'42501',null,'admin cannot insert in other tenant');
with changed as (update employee_blocked_periods set label='Edited' where id='74000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from changed),0::bigint,'admin cannot edit other tenant');
with removed as (delete from employee_blocked_periods where id='74000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from removed),0::bigint,'admin cannot delete other tenant');
select throws_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000002','2026-12-02 09:00Z','2026-12-02 12:00Z','Temporary')$$,'23503',null,'Foreign employee rejected by composite FK');
select throws_ok($$update employee_blocked_periods set business_id='71000000-0000-0000-0000-000000000002' where id='74000000-0000-0000-0000-000000000001'$$,'42501',null,'Tenant cannot be changed');
select throws_ok($$update employee_blocked_periods set employee_id='73000000-0000-0000-0000-000000000003' where id='74000000-0000-0000-0000-000000000001'$$,'42501',null,'Employee cannot be reassigned');
select throws_ok($$update employee_blocked_periods set updated_at='2000-01-01' where id='74000000-0000-0000-0000-000000000001'$$,'42501',null,'Timestamp cannot be forged');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000003';
select is((select count(*) from employee_blocked_periods),1::bigint,'Employee reads own tenant');
select throws_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','2026-12-02 09:00Z','2026-12-02 12:00Z','Temporary')$$,'42501',null,'Employee cannot insert');
with changed as (update employee_blocked_periods set label='Edited' where id='74000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from changed),0::bigint,'Employee cannot edit');
with removed as (delete from employee_blocked_periods where id='74000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from removed),0::bigint,'Employee cannot delete');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000004';
select is((select count(*) from employee_blocked_periods where id='74000000-0000-0000-0000-000000000001'),0::bigint,'B owner cannot read A by ID');
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000005';
select is((select count(*) from employee_blocked_periods),0::bigint,'Outsider sees no rows');
select throws_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','2026-12-02 09:00Z','2026-12-02 12:00Z','Temporary')$$,'42501',null,'Outsider cannot insert');
set local "request.jwt.claim.sub" = '';
select is((select count(*) from employee_blocked_periods),0::bigint,'Missing identity sees no rows');
reset role;
set local role anon;
select throws_ok($$select * from employee_blocked_periods$$,'42501',null,'Anonymous cannot read');
select throws_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','2026-12-02 09:00Z','2026-12-02 12:00Z','Temporary')$$,'42501',null,'Anonymous cannot insert');
select throws_ok($$update employee_blocked_periods set label='Edited'$$,'42501',null,'Anonymous cannot update');
select throws_ok($$delete from employee_blocked_periods$$,'42501',null,'Anonymous cannot delete');
reset role;

-- Validação temporal e semântica [início, fim).
set local role authenticated;
set local "request.jwt.claim.sub" = '72000000-0000-0000-0000-000000000001';
update employee_working_hours set end_minute=720 where id='74000000-0000-0000-0000-000000000001';
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',0,540,720)$$,'23514',null,'Day zero rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',8,540,720)$$,'23514',null,'Day eight rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',2,-1,720)$$,'23514',null,'Negative start rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',2,1440,1440)$$,'23514',null,'Start at day end rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',2,540,1441)$$,'23514',null,'End beyond day rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',2,540,540)$$,'23514',null,'Empty interval rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',2,720,540)$$,'23514',null,'Reversed interval rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',1,600,800)$$,'23P01',null,'Partial overlap rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',1,550,600)$$,'23P01',null,'Contained overlap rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',1,500,800)$$,'23P01',null,'Enclosing overlap rejected');
select throws_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',1,540,720)$$,'23P01',null,'Duplicate rejected');
select lives_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',1,720,780)$$,'Adjacent interval allowed');
select lives_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',1,840,1080)$$,'Split day allows lunch break');
select lives_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',2,540,720)$$,'Same hours on different day allowed');
select lives_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000003',1,540,720)$$,'Different employee may share hours');
select lives_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',7,0,1440)$$,'Full day and Sunday supported');
select lives_ok($$insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',3,1320,1440); insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001',4,0,120)$$,'Overnight shift split across days');
select throws_ok($$update employee_working_hours set end_minute=750 where id='74000000-0000-0000-0000-000000000001'$$,'23P01',null,'Update cannot overlap adjacent period');
select is((select end_minute from employee_working_hours where id='74000000-0000-0000-0000-000000000001'),720,'Failed update preserves hours');
select throws_ok($$update employee_blocked_periods set ends_at=starts_at where id='74000000-0000-0000-0000-000000000001'$$,'23514',null,'Empty block rejected');
select throws_ok($$update employee_blocked_periods set ends_at=starts_at-interval '1 minute' where id='74000000-0000-0000-0000-000000000001'$$,'23514',null,'Reversed block rejected');
select throws_ok($$update employee_blocked_periods set starts_at='-infinity' where id='74000000-0000-0000-0000-000000000001'$$,'23514',null,'Infinite start rejected');
select throws_ok($$update employee_blocked_periods set ends_at='infinity' where id='74000000-0000-0000-0000-000000000001'$$,'23514',null,'Infinite end rejected');
select throws_ok($$update employee_blocked_periods set label=' ' where id='74000000-0000-0000-0000-000000000001'$$,'23514',null,'Blank label rejected');
select throws_ok($$update employee_blocked_periods set label=repeat('x',201) where id='74000000-0000-0000-0000-000000000001'$$,'23514',null,'Long label rejected');
select lives_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','2026-12-01 10:00Z','2026-12-01 11:00Z')$$,'Overlapping blocks allowed for union in availability engine');
select lives_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','2026-09-20 23:00Z','2026-09-27 23:00Z','Férias')$$,'Multi-day block allowed');
select lives_ok($$insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values ('71000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','2026-10-25 01:30+01','2026-10-25 01:30+00','Mudança de hora')$$,'Repeated local time with distinct offsets is a valid block');
select is((select extract(epoch from (ends_at-starts_at))::integer from employee_blocked_periods where label='Mudança de hora'),3600,'DST block retains elapsed time');
reset role;
select * from finish();
rollback;
