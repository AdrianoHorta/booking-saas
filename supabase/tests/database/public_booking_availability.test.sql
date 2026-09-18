begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into businesses(id,name,slug,timezone,public_booking_enabled) values
 ('b1000000-0000-0000-0000-000000000001','Availability A','public-slots-a','UTC',true),
 ('b1000000-0000-0000-0000-000000000002','Availability B','public-slots-b','UTC',false);
insert into employees(id,business_id,name) values
 ('b3000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','Ana'),
 ('b3000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000002','Other');
insert into services(id,business_id,name,duration_minutes,price_cents) values
 ('b4000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','Corte',30,1500),
 ('b4000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000002','Other',30,1500);
insert into employee_services(business_id,employee_id,service_id) values
 ('b1000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001','b4000000-0000-0000-0000-000000000001');
insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute)
 select 'b1000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001',d,540,600 from generate_series(1,7) d;
-- Helper de teste, invoker: cada chamada mantém o papel que queremos verificar.
create function pg_temp.slots(day date default '2099-01-05') returns jsonb language sql as $$
 select public.get_public_booking_availability('public-slots-a','b3000000-0000-0000-0000-000000000001','b4000000-0000-0000-0000-000000000001',day)
$$;
set local role anon;
select is(pg_temp.slots()->'slots', '[{"starts_at":"2099-01-05T09:00:00+00:00","ends_at":"2099-01-05T09:30:00+00:00"},{"starts_at":"2099-01-05T09:15:00+00:00","ends_at":"2099-01-05T09:45:00+00:00"},{"starts_at":"2099-01-05T09:30:00+00:00","ends_at":"2099-01-05T10:00:00+00:00"}]'::jsonb,'Anonymous gets exact ordered grid, duration fits shift');
select is(pg_temp.slots() - 'slots' - 'server_now','{"timezone":"UTC","duration_minutes":30}'::jsonb,'Response metadata exposes only timezone and duration');
select is((pg_temp.slots()->>'server_now')::timestamptz,statement_timestamp(),'Server supplies reference time');
select is(pg_temp.slots('2000-01-05')->'slots','[]'::jsonb,'Past starts excluded');
select throws_ok($$select pg_temp.slots(null)$$,'22023',null,'Null date rejected');
select throws_ok($$select pg_temp.slots('infinity')$$,'22023',null,'Infinite date rejected');
select throws_ok($$select get_public_booking_availability('public-slots-b','b3000000-0000-0000-0000-000000000002','b4000000-0000-0000-0000-000000000002','2099-01-05')$$,'42501',null,'Unpublished business rejected');
select throws_ok($$select get_public_booking_availability('missing','b3000000-0000-0000-0000-000000000001','b4000000-0000-0000-0000-000000000001','2099-01-05')$$,'42501',null,'Missing business rejected');
select throws_ok($$select get_public_booking_availability('public-slots-a','b3000000-0000-0000-0000-000000000002','b4000000-0000-0000-0000-000000000001','2099-01-05')$$,'42501',null,'Foreign employee rejected');
select throws_ok($$select get_public_booking_availability('public-slots-a','b3000000-0000-0000-0000-000000000001','b4000000-0000-0000-0000-000000000002','2099-01-05')$$,'42501',null,'Foreign service rejected');
reset role;
set local role authenticated;
select lives_ok($$select pg_temp.slots()$$,'Authenticated outsider can consult published business');
reset role;
insert into employee_blocked_periods(business_id,employee_id,starts_at,ends_at,label) values
 ('b1000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001','2099-01-05 09:30Z','2099-01-05 09:45Z','PRIVATE LABEL');
set local role anon;
select is(pg_temp.slots()->'slots','[{"starts_at":"2099-01-05T09:00:00+00:00","ends_at":"2099-01-05T09:30:00+00:00"}]'::jsonb,'Block removes overlaps but allows adjacent end; no block details returned');
select lives_ok($$select confirm_booking('public-slots-a','b3000000-0000-0000-0000-000000000001','b4000000-0000-0000-0000-000000000001','2099-01-05 09:00Z',gen_random_uuid(),'Private Client','private@example.test')$$,'Displayed slot accepted by confirmation');
select is(pg_temp.slots()->'slots','[]'::jsonb,'Confirmed booking removes last slot without exposing customer');
reset role;
update bookings set status='cancelled' where business_id='b1000000-0000-0000-0000-000000000001';
set local role anon;
select is(jsonb_array_length(pg_temp.slots()->'slots'),1,'Cancelled booking frees slot');
reset role;
update employees set is_active=false where id='b3000000-0000-0000-0000-000000000001';
set local role anon;
select throws_ok($$select pg_temp.slots()$$,'42501',null,'Inactive employee rejected');
reset role;
update employees set is_active=true where id='b3000000-0000-0000-0000-000000000001';
update services set is_active=false where id='b4000000-0000-0000-0000-000000000001';
set local role anon;
select throws_ok($$select pg_temp.slots()$$,'42501',null,'Inactive service rejected');
reset role;
update services set is_active=true,duration_minutes=44641 where id='b4000000-0000-0000-0000-000000000001';
set local role anon;
select throws_ok($$select pg_temp.slots()$$,'22023',null,'Oversized duration rejected');
reset role;
update services set duration_minutes=30 where id='b4000000-0000-0000-0000-000000000001';
delete from employee_services where business_id='b1000000-0000-0000-0000-000000000001';
set local role anon;
select throws_ok($$select pg_temp.slots()$$,'42501',null,'Unassigned selection rejected');
reset role;
insert into employee_services(business_id,employee_id,service_id) values ('b1000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001','b4000000-0000-0000-0000-000000000001');
update businesses set public_booking_enabled=false where slug='public-slots-a';
set local role anon;
select throws_ok($$select pg_temp.slots()$$,'42501',null,'Revoked publication blocks next read');
reset role;
update businesses set public_booking_enabled=true,is_active=false where slug='public-slots-a';
set local role anon;
select throws_ok($$select pg_temp.slots()$$,'42501',null,'Inactive business rejected');
reset role;
update businesses set is_active=true where slug='public-slots-a';
delete from employee_working_hours where business_id='b1000000-0000-0000-0000-000000000001';
set local role anon;
select is(pg_temp.slots()->'slots','[]'::jsonb,'No working hours gives no slots');
reset role;
-- Turno contínuo entre dias: só publicar inícios no dia pedido.
insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values
 ('b1000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001',extract(isodow from date '2099-01-05'),1410,1440),
 ('b1000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001',extract(isodow from date '2099-01-06'),0,60);
update services set duration_minutes=60 where id='b4000000-0000-0000-0000-000000000001';
set local role anon;
select is(jsonb_array_length(pg_temp.slots()->'slots'),2,'Cross-midnight duration supported, next-day starts excluded');
select is((pg_temp.slots()->'slots'->1->>'ends_at')::timestamptz,'2099-01-06 00:45Z'::timestamptz,'Cross-midnight end uses real duration');
reset role;
-- Lisboa: limite local inexistente e limite ambíguo são rejeitados.
delete from employee_working_hours where business_id='b1000000-0000-0000-0000-000000000001';
update businesses set timezone='Europe/Lisbon' where slug='public-slots-a';
insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute) values
 ('b1000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001',7,90,180);
set local role anon;
select throws_ok($$select pg_temp.slots('2099-03-29')$$,'22023',null,'Nonexistent DST boundary rejected');
select throws_ok($$select pg_temp.slots('2099-10-25')$$,'22023',null,'Ambiguous DST boundary rejected');
reset role;
select * from finish();
rollback;
