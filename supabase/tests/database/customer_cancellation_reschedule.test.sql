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
update businesses set public_booking_enabled=true,timezone='UTC' where id='d1000000-0000-0000-0000-000000000001';
insert into employee_working_hours(business_id,employee_id,weekday,start_minute,end_minute)
select 'd1000000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001',d,540,720 from generate_series(1,7) d;
create temporary table secrets(id uuid,token text);
insert into secrets select id,private.booking_cancel_token(id) from bookings where business_id='d1000000-0000-0000-0000-000000000001';
grant select on secrets to anon,authenticated;
create function pg_temp.customer_read() returns jsonb language sql as $$ select get_customer_booking(id,token) from secrets limit 1 $$;
create function pg_temp.customer_cancel() returns jsonb language sql as $$ select cancel_customer_booking(id,token) from secrets limit 1 $$;
create function pg_temp.move_booking(new_start timestamptz,old_start timestamptz default '2099-01-05 09:00Z') returns jsonb language sql as $$
  select reschedule_booking('d1000000-0000-0000-0000-000000000001','d6000000-0000-0000-0000-000000000001',old_start,new_start)
$$;
select is((select cancellation_notice_hours from businesses where id='d1000000-0000-0000-0000-000000000001'),12,'Default policy 12 hours');
set local role anon;
select lives_ok($$select pg_temp.customer_read()$$,'Valid token reads minimal receipt');
select ok(not (pg_temp.customer_read() ?| array['email','phone','customer_id','request_id','cancellation_token']),'Receipt omits private contacts and internal keys');
select throws_ok($$select get_customer_booking('d6000000-0000-0000-0000-000000000001',repeat('0',64))$$,'42501',null,'Forged token rejected');
select throws_ok($$select get_customer_booking('d6000000-0000-0000-0000-000000000002',(select token from secrets limit 1))$$,'42501',null,'Token bound to one booking');
select throws_ok($$select get_customer_booking('d6000000-0000-0000-0000-000000000001',null)$$,'42501',null,'Missing token rejected');
select throws_ok($$select private.booking_cancel_token('d6000000-0000-0000-0000-000000000001')$$,'42501',null,'Cannot generate tokens directly');
select throws_ok($$select * from private.booking_token_secret$$,'42501',null,'Signing key remains private');
select throws_ok($$select set_cancellation_policy('d1000000-0000-0000-0000-000000000001',0)$$,'42501',null,'Anon cannot set policy');
select throws_ok($$select pg_temp.move_booking('2099-01-05 09:15Z')$$,'42501',null,'Anon cannot reschedule');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000004';
select throws_ok($$select pg_temp.move_booking('2099-01-05 09:15Z')$$,'42501',null,'Outsider cannot reschedule');
select throws_ok($$select set_cancellation_policy('d1000000-0000-0000-0000-000000000001',24)$$,'42501',null,'Outsider cannot change policy');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000003';
select throws_ok($$select set_cancellation_policy('d1000000-0000-0000-0000-000000000001',24)$$,'42501',null,'Employee cannot change policy');
select ok((get_reschedule_slots('d1000000-0000-0000-0000-000000000001','d6000000-0000-0000-0000-000000000001','2099-01-05')->'slots') @> '[{"starts_at":"2099-01-05T09:15:00+00:00"}]'::jsonb,'Reschedule availability excludes own booking');
select lives_ok($$select pg_temp.move_booking('2099-01-05 09:15Z')$$,'Employee moves own reservation into overlapping original slot');
select lives_ok($$select pg_temp.move_booking('2099-01-05 09:15Z')$$,'Retry succeeds without changing again');
select throws_ok($$select pg_temp.move_booking('2099-01-05 09:30Z')$$,'40001',null,'Stale edit rejected');
select throws_ok($$select pg_temp.move_booking('2099-01-05 09:17Z','2099-01-05 09:15Z')$$,'23P01',null,'Off-grid move rejected');
select throws_ok($$select pg_temp.move_booking('2000-01-05 09:00Z','2099-01-05 09:15Z')$$,'22023',null,'Cannot move to past');
select is((select starts_at from bookings where id='d6000000-0000-0000-0000-000000000001'),'2099-01-05 09:15Z'::timestamptz,'Failed moves preserve original');
select is((select price_cents from bookings where id='d6000000-0000-0000-0000-000000000001'),1000,'Price snapshot preserved');
select is((select rescheduled_by from bookings where id='d6000000-0000-0000-0000-000000000001'),'d2000000-0000-0000-0000-000000000003'::uuid,'Reschedule actor recorded');
reset role;
insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents)
select business_id,customer_id,employee_id,service_id,gen_random_uuid(),'2099-01-05 10:00Z','2099-01-05 10:30Z',service_name,employee_name,duration_minutes,price_cents from bookings where id='d6000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select pg_temp.move_booking('2099-01-05 10:00Z','2099-01-05 09:15Z')$$,'23P01',null,'Occupied target fails atomically');
select is((select starts_at from bookings where id='d6000000-0000-0000-0000-000000000001'),'2099-01-05 09:15Z'::timestamptz,'Conflict preserves original time');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000001';
select is(set_cancellation_policy('d1000000-0000-0000-0000-000000000001',24),24,'Owner sets policy');
select throws_ok($$select set_cancellation_policy('d1000000-0000-0000-0000-000000000002',24)$$,'42501',null,'Foreign policy rejected');
select throws_ok($$select set_cancellation_policy('d1000000-0000-0000-0000-000000000001',-1)$$,'22023',null,'Negative policy rejected');
select is((select cancellation_notice_hours from bookings where id='d6000000-0000-0000-0000-000000000001'),12,'Existing booking keeps original policy');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000002';
select is(set_cancellation_policy('d1000000-0000-0000-0000-000000000001',36),36,'Admin sets policy');
reset role;
create temporary table new_receipt as select confirm_booking('members-manage-a','d3000000-0000-0000-0000-000000000001','d4000000-0000-0000-0000-000000000001','2099-01-06 09:00Z','d7000000-0000-0000-0000-000000000001','New client','new@example.test') receipt;
select is((select (receipt->>'cancellation_notice_hours')::integer from new_receipt),36,'New booking receives configured policy');
select is((select receipt->>'cancellation_token' from new_receipt),confirm_booking('members-manage-a','d3000000-0000-0000-0000-000000000001','d4000000-0000-0000-0000-000000000001','2099-01-06 09:00Z','d7000000-0000-0000-0000-000000000001','New client','new@example.test')->>'cancellation_token','Confirmation retry returns same token');
-- Casos dos dois lados do limite: relógio do servidor, sem depender do browser.
update bookings set starts_at=statement_timestamp()+interval '11 hours 59 minutes',ends_at=statement_timestamp()+interval '11 hours 59 minutes'+duration_minutes*interval '1 minute' where id='d6000000-0000-0000-0000-000000000001';
set local role anon;
select ok(not (pg_temp.customer_read()->>'can_cancel')::boolean,'Below twelve hours unavailable');
select throws_ok($$select pg_temp.customer_cancel()$$,'22023',null,'Server rejects late customer cancellation');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000001';
select throws_ok($$select cancel_booking('d1000000-0000-0000-0000-000000000001','d6000000-0000-0000-0000-000000000001')$$,'22023',null,'Team also respects cancellation deadline');
reset role;
update bookings set starts_at=statement_timestamp()+interval '12 hours 1 minute',ends_at=statement_timestamp()+interval '12 hours 1 minute'+duration_minutes*interval '1 minute' where id='d6000000-0000-0000-0000-000000000001';
update businesses set public_booking_enabled=false where id='d1000000-0000-0000-0000-000000000001';
set local role anon;
select ok((pg_temp.customer_read()->>'can_cancel')::boolean,'Above twelve hours permitted');
select is(pg_temp.customer_cancel()->>'status','cancelled','Customer can cancel even after publication closed');
select is(pg_temp.customer_cancel()->>'status','cancelled','Cancellation retry succeeds');
reset role;
select ok((select cancelled_by_customer and cancelled_by is null and cancelled_at is not null from bookings where id='d6000000-0000-0000-0000-000000000001'),'Customer cancellation audited separately');
select is((select count(*) from bookings where id='d6000000-0000-0000-0000-000000000001'),1::bigint,'Cancelled history preserved');
set local role authenticated;
select throws_ok($$select pg_temp.move_booking('2099-01-05 11:00Z')$$,'22023',null,'Cannot reschedule cancelled booking');
reset role;
select * from finish();
rollback;

