begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
 ('e2000000-0000-4000-8000-000000000001','integration-owner@example.test'),
 ('e2000000-0000-4000-8000-000000000002','integration-worker@example.test'),
 ('e2000000-0000-4000-8000-000000000003','integration-outsider@example.test');
insert into businesses(id,name,slug,timezone) values
 ('e1000000-0000-4000-8000-000000000001','Integration test','integration-test','Europe/Lisbon');
insert into business_members(business_id,user_id,role) values
 ('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','owner'),
 ('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','employee');
insert into employees(id,business_id,name,user_id) values
 ('e3000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Worker','e2000000-0000-4000-8000-000000000002');
insert into services(id,business_id,name,duration_minutes,price_cents) values
 ('e4000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Service',30,1500);
insert into customers(id,business_id,name,email) values
 ('e5000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Client','integration-client@example.test');
create function pg_temp.add_booking(key uuid, start_time timestamptz) returns void language sql as $$
 insert into public.bookings(id,business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents)
 values(key,'e1000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',
 'e4000000-0000-4000-8000-000000000001',gen_random_uuid(),start_time,start_time+interval '30 minutes','Service','Worker',30,1500)
$$;
select pg_temp.add_booking('e6000000-0000-4000-8000-000000000001','2099-07-01 23:30Z');
select is((select count(*) from private.booking_deliveries where business_id='e1000000-0000-4000-8000-000000000001'),0::bigint,'No jobs without selected calendar or email opt-in');
set local role anon;
select throws_ok($$select claim_booking_delivery(array['email'])$$,'42501',null,'Anon cannot claim');
select throws_ok($$select booking_analytics('e1000000-0000-4000-8000-000000000001','2099-07-01','2099-07-03')$$,'42501',null,'Anon cannot read analytics');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub"='e2000000-0000-4000-8000-000000000002';
select throws_ok('select * from private.booking_deliveries','42501',null,'Employee cannot read private queue');
select throws_ok($$select claim_booking_delivery(array['email'])$$,'42501',null,'Browser cannot claim');
select throws_ok($$select prepare_booking_delivery(1,gen_random_uuid())$$,'42501',null,'Browser cannot obtain delivery secrets');
select throws_ok($$select finish_booking_delivery(1,gen_random_uuid(),'done')$$,'42501',null,'Browser cannot acknowledge');
select throws_ok($$select booking_integration_status('e1000000-0000-4000-8000-000000000001')$$,'42501',null,'Employee cannot inspect company deliveries');
select throws_ok($$select set_booking_emails_enabled('e1000000-0000-4000-8000-000000000001',true)$$,'42501',null,'Employee cannot enable emails');
select throws_ok($$select booking_analytics('e1000000-0000-4000-8000-000000000001','2099-07-01','2099-07-03')$$,'42501',null,'Employee cannot read company analytics');
set local "request.jwt.claim.sub"='e2000000-0000-4000-8000-000000000003';
select throws_ok($$select booking_analytics('e1000000-0000-4000-8000-000000000001','2099-07-01','2099-07-03')$$,'42501',null,'Outsider cannot read analytics');
set local "request.jwt.claim.sub"='e2000000-0000-4000-8000-000000000001';
select is(set_booking_emails_enabled('e1000000-0000-4000-8000-000000000001',true),true,'Owner enables emails');
select is(booking_analytics('e1000000-0000-4000-8000-000000000001','2099-07-01','2099-07-01')->>'confirmed','0','Local midnight excludes previous day');
select is(booking_analytics('e1000000-0000-4000-8000-000000000001','2099-07-02','2099-07-02')->>'confirmed','1','Local midnight includes next day');
select throws_ok($$select booking_analytics('e1000000-0000-4000-8000-000000000001','2099-07-03','2099-07-01')$$,'22023',null,'Reversed range rejected');
select throws_ok($$select booking_analytics('e1000000-0000-4000-8000-000000000001','2099-01-01','2101-01-01')$$,'22023',null,'Oversized range rejected');
reset role;
select is((select count(*) from private.booking_deliveries where business_id='e1000000-0000-4000-8000-000000000001'),0::bigint,'Email opt-in does not send historical bookings');
insert into employee_calendar_credentials(employee_id,business_id,user_id,credentials) values
 ('e3000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','encrypted-example');
update employee_calendar_credentials set calendar_id='work@example.test' where employee_id='e3000000-0000-4000-8000-000000000001';
select is((select count(*) from private.booking_deliveries where business_id='e1000000-0000-4000-8000-000000000001' and channel='calendar'),1::bigint,'Calendar selection backfills future reservations');
select pg_temp.add_booking('e6000000-0000-4000-8000-000000000002','2099-07-02 12:00Z');
select is((select count(*) from private.booking_deliveries where booking_id='e6000000-0000-4000-8000-000000000002'),2::bigint,'Creation queues both destinations');
update bookings set price_cents=1500 where id='e6000000-0000-4000-8000-000000000002';
select is((select count(*) from private.booking_deliveries where booking_id='e6000000-0000-4000-8000-000000000002'),2::bigint,'Unchanged update produces no duplicate');
create temporary table claimed(value jsonb);
insert into claimed select claim_booking_delivery(array['email']);
select is((select value->>'channel' from claimed),'email','Worker claims requested channel');
select is(claim_booking_delivery(array['email']),null::jsonb,'Active lease cannot be claimed twice');
select ok((select prepare_booking_delivery((value->>'id')::bigint,(value->>'lease')::uuid)->>'cancellation_token' from claimed) ~ '^[a-f0-9]{64}$','Worker gets private management token');
select is(finish_booking_delivery((select (value->>'id')::bigint from claimed),gen_random_uuid(),'done'),false,'Stale worker cannot acknowledge');
update bookings set starts_at='2099-07-02 13:00Z',ends_at='2099-07-02 13:30Z' where id='e6000000-0000-4000-8000-000000000002';
select is(claim_booking_delivery(array['email']),null::jsonb,'Reschedule email cannot overtake active confirmation');
select is((select prepare_booking_delivery((value->>'id')::bigint,(value->>'lease')::uuid)->'payload'->>'starts_at' from claimed),'2099-07-02T12:00:00+00:00','Retry email keeps immutable payload');
select ok((select finish_booking_delivery((value->>'id')::bigint,(value->>'lease')::uuid,'done') from claimed),'Lease holder acknowledges');
truncate claimed;
insert into claimed select claim_booking_delivery(array['email']);
select is((select prepare_booking_delivery((value->>'id')::bigint,(value->>'lease')::uuid)->>'event' from claimed),'rescheduled','Next email follows confirmation');
update private.booking_deliveries set first_attempt_at=now()-interval '24 hours',lease_until=now()-interval '1 minute'
 where id=(select (value->>'id')::bigint from claimed);
select is(claim_booking_delivery(array['email']),null::jsonb,'Uncertain email outside provider idempotency window is not resent');
select is((select state from private.booking_deliveries where id=(select (value->>'id')::bigint from claimed)),'failed','Expired uncertainty requires review');
update bookings set status='cancelled' where id='e6000000-0000-4000-8000-000000000002';
select is((select count(*) from private.booking_deliveries where booking_id='e6000000-0000-4000-8000-000000000002' and event='cancelled'),2::bigint,'Cancel queues both destinations');
truncate claimed;
insert into claimed select claim_booking_delivery(array['calendar']);
update employee_calendar_credentials set calendar_id=null,credentials=null where employee_id='e3000000-0000-4000-8000-000000000001';
select is((select prepare_booking_delivery((value->>'id')::bigint,(value->>'lease')::uuid) from claimed),null::jsonb,'Disconnect invalidates already claimed work');
set local role authenticated;
set local "request.jwt.claim.sub"='e2000000-0000-4000-8000-000000000001';
select is(booking_analytics('e1000000-0000-4000-8000-000000000001','2099-07-02','2099-07-02')->>'booked_value_cents','1500','Cancelled booking excluded from booked value');
select is(booking_analytics('e1000000-0000-4000-8000-000000000001','2099-07-02','2099-07-02')->>'cancelled','1','Cancelled booking remains counted');
select ok(not((booking_integration_status('e1000000-0000-4000-8000-000000000001')->'deliveries'->0) ?| array['payload','credentials','cancellation_token','email','lease']),'Manager status omits contacts, tokens and leases');
reset role;
savepoint fixture_rollback;
select pg_temp.add_booking('e6000000-0000-4000-8000-000000000003','2099-07-03 12:00Z');
rollback to fixture_rollback;
select is((select count(*) from private.booking_deliveries where booking_id='e6000000-0000-4000-8000-000000000003'),0::bigint,'Booking rollback also rolls back delivery intent');
select * from finish();
rollback;
