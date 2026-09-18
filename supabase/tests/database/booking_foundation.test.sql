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
update employees set user_id='62000000-0000-0000-0000-000000000003' where id='63000000-0000-0000-0000-000000000001';
insert into employees(id,business_id,name) values ('63000000-0000-0000-0000-000000000003','61000000-0000-0000-0000-000000000001','Another professional');
insert into customers(id,business_id,name,email) values
  ('65000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','Own client','own@example.test'),
  ('65000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000001','Other client','other@example.test'),
  ('65000000-0000-0000-0000-000000000003','61000000-0000-0000-0000-000000000002','Foreign client','foreign@example.test');
insert into bookings(id,business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('66000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 09:00Z','2026-07-06 09:30Z','Service A','Employee A',30,1000);
insert into bookings(id,business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('66000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000003','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 09:00Z','2026-07-06 09:30Z','Service A','Employee A',30,1000);
insert into bookings(id,business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('66000000-0000-0000-0000-000000000003','61000000-0000-0000-0000-000000000002','65000000-0000-0000-0000-000000000003','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002',gen_random_uuid(),'2026-07-06 09:00Z','2026-07-06 09:30Z','Service A','Employee A',30,1000);
select ok((select relrowsecurity from pg_class where oid='public.bookings'::regclass),'Bookings RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.customers'::regclass),'Customers RLS enabled');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 09:15Z','2026-07-06 09:45Z','Service A','Employee A',30,1000)$$,'23P01',null,'Partial overlap rejected');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 09:00Z','2026-07-06 09:30Z','Service A','Employee A',30,1000)$$,'23P01',null,'Duplicate occupied interval rejected');
select lives_ok($$insert into bookings(id,business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('66000000-0000-0000-0000-000000000004','61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 09:30Z','2026-07-06 10:00Z','Service A','Employee A',30,1000)$$,'Adjacent reservation allowed');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',(select request_id from bookings where id='66000000-0000-0000-0000-000000000004'),'2026-07-06 11:00Z','2026-07-06 11:30Z','Service A','Employee A',30,1000)$$,'23505',null,'Request key unique within business');
select lives_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000002','65000000-0000-0000-0000-000000000003','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002',(select request_id from bookings where id='66000000-0000-0000-0000-000000000004'),'2026-07-06 11:00Z','2026-07-06 11:30Z','Service A','Employee A',30,1000)$$,'Request namespace isolated per business');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000003','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 11:00Z','2026-07-06 11:30Z','Service A','Employee A',30,1000)$$,'23503',null,'Foreign customer rejected');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 12:00Z','2026-07-06 12:30Z','Service A','Employee A',30,1000)$$,'23503',null,'Foreign employee rejected');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000002',gen_random_uuid(),'2026-07-06 11:00Z','2026-07-06 11:30Z','Service A','Employee A',30,1000)$$,'23503',null,'Foreign service rejected');
select throws_ok($$update bookings set ends_at=starts_at where id='66000000-0000-0000-0000-000000000001'$$,'23514',null,'Empty interval rejected');
select throws_ok($$update bookings set ends_at=starts_at+interval '45 minutes' where id='66000000-0000-0000-0000-000000000001'$$,'23514',null,'End must match snapshot duration');
select throws_ok($$update bookings set ends_at='infinity' where id='66000000-0000-0000-0000-000000000001'$$,'23514',null,'Infinite interval rejected');
select throws_ok($$update bookings set price_cents=-1 where id='66000000-0000-0000-0000-000000000001'$$,'23514',null,'Negative snapshot price rejected');
select throws_ok($$update bookings set status='unknown' where id='66000000-0000-0000-0000-000000000001'$$,'23514',null,'Invalid status rejected');
update services set name='Changed catalog',price_cents=5000 where id='64000000-0000-0000-0000-000000000001';
update employees set name='Changed professional' where id='63000000-0000-0000-0000-000000000001';
select is((select service_name from bookings where id='66000000-0000-0000-0000-000000000001'),'Service A','Service name snapshot preserved');
select is((select price_cents from bookings where id='66000000-0000-0000-0000-000000000001'),1000,'Price snapshot preserved');
select is((select employee_name from bookings where id='66000000-0000-0000-0000-000000000001'),'Employee A','Employee name snapshot preserved');
select throws_ok($$delete from customers where id='65000000-0000-0000-0000-000000000001'$$,'23503',null,'Customer with history cannot be deleted');
select throws_ok($$delete from services where id='64000000-0000-0000-0000-000000000001'$$,'23503',null,'Service with history cannot be deleted');
select throws_ok($$insert into customers(business_id,name,email) values ('61000000-0000-0000-0000-000000000001',' ','valid@example.test')$$,'23514',null,'Blank customer name rejected');
select throws_ok($$insert into customers(business_id,name,email) values ('61000000-0000-0000-0000-000000000001','Client','invalid')$$,'23514',null,'Malformed customer email rejected');
select throws_ok($$insert into customers(business_id,name,email) values ('61000000-0000-0000-0000-000000000001','Client','Mixed@Example.test')$$,'23514',null,'Email must be normalized');
select lives_ok($$insert into customers(business_id,name,email) values ('61000000-0000-0000-0000-000000000001','Another person','own@example.test')$$,'Shared email does not merge identities');
set local role authenticated;
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000001';
select is((select count(*) from bookings),3::bigint,'owner sees authorized reservations');
select is((select count(*) from customers),3::bigint,'owner sees authorized customers');
select is((select count(*) from bookings where business_id='61000000-0000-0000-0000-000000000002'),0::bigint,'owner cannot see other tenant');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 15:00Z','2026-07-06 15:30Z','Service A','Employee A',30,1000)$$,'42501',null,'owner cannot insert bookings directly');
select throws_ok($$update bookings set status='cancelled'$$,'42501',null,'owner cannot update bookings directly');
select throws_ok($$delete from bookings$$,'42501',null,'owner cannot delete bookings directly');
select throws_ok($$insert into customers(business_id,name,email) values ('61000000-0000-0000-0000-000000000001','Attack','attack@example.test')$$,'42501',null,'owner cannot insert customers directly');
select throws_ok($$update customers set name='Attack'$$,'42501',null,'owner cannot update customers directly');
select throws_ok($$delete from customers$$,'42501',null,'owner cannot delete customers directly');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000002';
select is((select count(*) from bookings),3::bigint,'admin sees authorized reservations');
select is((select count(*) from customers),3::bigint,'admin sees authorized customers');
select is((select count(*) from bookings where business_id='61000000-0000-0000-0000-000000000002'),0::bigint,'admin cannot see other tenant');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 15:00Z','2026-07-06 15:30Z','Service A','Employee A',30,1000)$$,'42501',null,'admin cannot insert bookings directly');
select throws_ok($$update bookings set status='cancelled'$$,'42501',null,'admin cannot update bookings directly');
select throws_ok($$delete from bookings$$,'42501',null,'admin cannot delete bookings directly');
select throws_ok($$insert into customers(business_id,name,email) values ('61000000-0000-0000-0000-000000000001','Attack','attack@example.test')$$,'42501',null,'admin cannot insert customers directly');
select throws_ok($$update customers set name='Attack'$$,'42501',null,'admin cannot update customers directly');
select throws_ok($$delete from customers$$,'42501',null,'admin cannot delete customers directly');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000003';
select is((select count(*) from bookings),2::bigint,'employee sees authorized reservations');
select is((select count(*) from customers),1::bigint,'employee sees authorized customers');
select is((select count(*) from bookings where business_id='61000000-0000-0000-0000-000000000002'),0::bigint,'employee cannot see other tenant');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 15:00Z','2026-07-06 15:30Z','Service A','Employee A',30,1000)$$,'42501',null,'employee cannot insert bookings directly');
select throws_ok($$update bookings set status='cancelled'$$,'42501',null,'employee cannot update bookings directly');
select throws_ok($$delete from bookings$$,'42501',null,'employee cannot delete bookings directly');
select throws_ok($$insert into customers(business_id,name,email) values ('61000000-0000-0000-0000-000000000001','Attack','attack@example.test')$$,'42501',null,'employee cannot insert customers directly');
select throws_ok($$update customers set name='Attack'$$,'42501',null,'employee cannot update customers directly');
select throws_ok($$delete from customers$$,'42501',null,'employee cannot delete customers directly');
select is((select count(*) from bookings where employee_id='63000000-0000-0000-0000-000000000003'),0::bigint,'Employee cannot read colleague booking details');
select is(jsonb_array_length(private.booking_busy_periods('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000003','2026-07-06 00:00Z','2026-07-07 00:00Z')),1,'Employee can see busy time of colleague without customer data');
select ok(not (private.booking_busy_periods('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000003','2026-07-06 00:00Z','2026-07-07 00:00Z')::text like '%Other client%'),'Busy time contains no customer name');
select throws_ok($$select private.booking_busy_periods('61000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','2026-07-06 00:00Z','2026-07-07 00:00Z')$$,'42501',null,'Busy helper enforces tenant');
select is(jsonb_array_length(get_availability_context('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000003','64000000-0000-0000-0000-000000000001','2026-07-06')->'booking_periods'),1,'Availability context includes colleague busy time');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000005';
select is((select count(*) from bookings),0::bigint,'Outsider sees no bookings');
select is((select count(*) from customers),0::bigint,'Outsider sees no customers');
reset role;
-- Cancelar liberta o intervalo, mas reativar uma reserva em conflito é rejeitado.
update bookings set status='cancelled' where id='66000000-0000-0000-0000-000000000001';
select lives_ok($$insert into bookings(id,business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('66000000-0000-0000-0000-000000000005','61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 09:00Z','2026-07-06 09:30Z','Service A','Employee A',30,1000)$$,'Cancelled booking no longer blocks interval');
select throws_ok($$update bookings set status='confirmed' where id='66000000-0000-0000-0000-000000000001'$$,'23P01',null,'Reactivation cannot overlap replacement');
set local role authenticated;
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000001';
select is(jsonb_array_length(private.booking_busy_periods('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','2026-07-06 09:00Z','2026-07-06 09:30Z')),1,'Only confirmed overlapping booking returned; adjacent and cancelled excluded');
reset role;
set local role anon;
select throws_ok($$select * from bookings$$,'42501',null,'Anon cannot read bookings');
select throws_ok($$select * from customers$$,'42501',null,'Anon cannot read customers');
select throws_ok($$insert into bookings(business_id,customer_id,employee_id,service_id,request_id,starts_at,ends_at,service_name,employee_name,duration_minutes,price_cents) values ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',gen_random_uuid(),'2026-07-06 15:00Z','2026-07-06 15:30Z','Service A','Employee A',30,1000)$$,'42501',null,'Anon cannot insert bookings');
select throws_ok($$select private.booking_busy_periods('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','2026-07-06 00:00Z','2026-07-07 00:00Z')$$,'42501',null,'Anon cannot call private helper');
reset role;
select * from finish();
rollback;
