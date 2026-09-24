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
select is((select revision from booking_revisions where business_id='d1000000-0000-0000-0000-000000000001'),5::bigint,'Inserts and updates produce one revision each');
update bookings set status='cancelled' where id='d6000000-0000-0000-0000-000000000001';
select is((select revision from booking_revisions where business_id='d1000000-0000-0000-0000-000000000001'),6::bigint,'Cancellation increments revision');
savepoint before_change;
update bookings set starts_at=starts_at+interval '1 hour', ends_at=ends_at+interval '1 hour' where id='d6000000-0000-0000-0000-000000000002';
rollback to before_change;
select is((select revision from booking_revisions where business_id='d1000000-0000-0000-0000-000000000001'),6::bigint,'Rolled back change leaves revision unchanged');
select is((select count(*) from information_schema.columns where table_schema='public' and table_name='booking_revisions'),2::bigint,'Signal contains only tenant and revision');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='booking_revisions'),'Signals published');
insert into booking_revisions(business_id) values ('d1000000-0000-0000-0000-000000000002');
set local role anon;
select throws_ok('select * from booking_revisions','42501',null,'Anonymous cannot read signals');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000003';
select is((select count(*) from booking_revisions),1::bigint,'Employee sees only own tenant signal');
select throws_ok('update booking_revisions set revision=999','42501',null,'Members cannot forge signals');
select throws_ok('delete from booking_revisions','42501',null,'Members cannot delete signals');
select throws_ok($$insert into booking_revisions(business_id) values (gen_random_uuid())$$,'42501',null,'Members cannot insert signals');
select throws_ok('select private.notify_booking_revision()','42501',null,'Trigger function is not callable');
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000004';
select is((select count(*) from booking_revisions),0::bigint,'Outsider sees no signals');
reset role;
update employees set user_id=null where user_id='d2000000-0000-0000-0000-000000000003';
delete from business_members where user_id='d2000000-0000-0000-0000-000000000003';
set local role authenticated;
set local "request.jwt.claim.sub" = 'd2000000-0000-0000-0000-000000000003';
select is((select count(*) from booking_revisions),0::bigint,'Revoked member cannot read signals');
reset role;
select * from finish();
rollback;
