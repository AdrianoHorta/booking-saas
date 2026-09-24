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
update bookings set id='d6000000-0000-0000-0000-000000000001' where business_id='d1000000-0000-0000-0000-000000000001';
insert into bookings(id,business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents)
select ('d6000000-0000-0000-0000-00000000000' || n)::uuid,business_id,customer_id,employee_id,service_id,gen_random_uuid(),
  case when n=4 then timestamptz '2000-01-05 09:00Z' else starts_at + n * interval '1 day' end,
  case when n=4 then timestamptz '2000-01-05 09:30Z' else ends_at + n * interval '1 day' end,
  service_name,employee_name,duration_minutes,price_cents
from bookings cross join generate_series(2,4) n where id='d6000000-0000-0000-0000-000000000001';
create function pg_temp.cancel_one() returns jsonb language sql as $$
 select cancel_booking('d1000000-0000-0000-0000-000000000001','d6000000-0000-0000-0000-000000000001')
$$;
set local role anon;
select throws_ok($$select pg_temp.cancel_one()$$,'42501',null,'Anon cannot cancel');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000004';
select throws_ok($$select pg_temp.cancel_one()$$,'42501',null,'Outsider cannot cancel');
reset role;
insert into business_members(business_id,user_id,role) values ('d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000004','employee');
set local role authenticated;
select throws_ok($$select pg_temp.cancel_one()$$,'42501',null,'Employee without assigned profile cannot cancel colleague');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000003';
select is(pg_temp.cancel_one()->>'status','cancelled','Assigned employee can cancel');
select is((select cancelled_by from bookings where id='d6000000-0000-0000-0000-000000000001'),'d2000000-0000-0000-0000-000000000003'::uuid,'Actor recorded');
select ok((select cancelled_at is not null from bookings where id='d6000000-0000-0000-0000-000000000001'),'Timestamp recorded');
select is(pg_temp.cancel_one(),pg_temp.cancel_one(),'Retry returns unchanged receipt');
select throws_ok($$update bookings set status='cancelled' where id='d6000000-0000-0000-0000-000000000002'$$,'42501',null,'Direct writes remain closed');
select throws_ok($$select cancel_booking('d1000000-0000-0000-0000-000000000001','d6000000-0000-0000-0000-000000000004')$$,'22023',null,'Past booking cannot be cancelled');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000001';
select throws_ok($$select cancel_booking('d1000000-0000-0000-0000-000000000002','d6000000-0000-0000-0000-000000000002')$$,'42501',null,'Wrong tenant rejected');
select throws_ok($$select cancel_booking('d1000000-0000-0000-0000-000000000001',gen_random_uuid())$$,'42501',null,'Unknown booking rejected');
select is(cancel_booking('d1000000-0000-0000-0000-000000000001','d6000000-0000-0000-0000-000000000002')->>'status','cancelled','Owner can cancel');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000002';
select is(cancel_booking('d1000000-0000-0000-0000-000000000001','d6000000-0000-0000-0000-000000000003')->>'status','cancelled','Admin can cancel');
reset role;
select is((select count(*) from bookings where business_id='d1000000-0000-0000-0000-000000000001'),4::bigint,'History preserved');
select is((select count(*) from customers where business_id='d1000000-0000-0000-0000-000000000001'),1::bigint,'Customer preserved');
update businesses set public_booking_enabled=true, timezone='UTC' where id='d1000000-0000-0000-0000-000000000001';
insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute)
select 'd1000000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001',extract(isodow from date '2099-01-05'),540,570;
set local role anon;
select is(jsonb_array_length(get_public_booking_availability('members-manage-a','d3000000-0000-0000-0000-000000000001','d4000000-0000-0000-0000-000000000001','2099-01-05')->'slots'),1,'Cancellation frees public availability');
reset role;
select * from finish();
rollback;

