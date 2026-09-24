begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into businesses(id,name,slug,public_booking_enabled) values
 ('a1000000-0000-0000-0000-000000000001','Public A','catalog-test-a',true),
 ('a1000000-0000-0000-0000-000000000002','Private B','catalog-test-b',false);
insert into services(id,business_id,name,duration_minutes,price_cents) values
 ('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Corte',30,1500),
 ('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001','Unassigned',30,100),
 ('a2000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000002','Foreign',30,100);
insert into employees(id,business_id,name) values
 ('a3000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Ana'),
 ('a3000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','Foreign employee');
insert into employee_services(business_id,employee_id,service_id) values
 ('a1000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000003');

set local role anon;
select is(get_public_booking_catalog('catalog-test-a'),
 '{"business":{"name":"Public A","slug":"catalog-test-a","timezone":"Europe/Lisbon","cancellation_notice_hours":12},"services":[{"id":"a2000000-0000-0000-0000-000000000001","name":"Corte","duration_minutes":30,"price_cents":1500,"currency":"EUR","employees":[{"id":"a3000000-0000-0000-0000-000000000001","name":"Ana"}]}]}'::jsonb,
 'Anonymous catalog exposes only the exact public contract and assigned local selections');
select throws_ok($$select get_public_booking_catalog('catalog-test-b')$$,'42501','Public booking unavailable','Unpublished business hidden');
select throws_ok($$select get_public_booking_catalog('missing')$$,'42501','Public booking unavailable','Missing business uses same error');
select throws_ok($$select get_public_booking_catalog(null)$$,'42501','Public booking unavailable','Null slug rejected');
select throws_ok($$select * from employees$$,'42501',null,'Employee table remains private');
select throws_ok($$select * from customers$$,'42501',null,'Customer table remains private');
select throws_ok($$select * from bookings$$,'42501',null,'Booking table remains private');
reset role;
set local role authenticated;
select lives_ok($$select get_public_booking_catalog('catalog-test-a')$$,'Authenticated visitor without membership can consult published catalog');
reset role;

update services set is_active=false where id='a2000000-0000-0000-0000-000000000001';
set local role anon;
select is(get_public_booking_catalog('catalog-test-a')->'services','[]'::jsonb,'Inactive service omitted');
reset role;
update services set is_active=true, duration_minutes=44641 where id='a2000000-0000-0000-0000-000000000001';
set local role anon;
select is(get_public_booking_catalog('catalog-test-a')->'services','[]'::jsonb,'Unsupported duration omitted');
reset role;
update services set duration_minutes=30 where id='a2000000-0000-0000-0000-000000000001';
update employees set is_active=false where id='a3000000-0000-0000-0000-000000000001';
set local role anon;
select is(get_public_booking_catalog('catalog-test-a')->'services','[]'::jsonb,'Service without active professional omitted');
reset role;
update employees set is_active=true where id='a3000000-0000-0000-0000-000000000001';
update businesses set is_active=false where slug='catalog-test-a';
set local role anon;
select throws_ok($$select get_public_booking_catalog('catalog-test-a')$$,'42501','Public booking unavailable','Inactive business hidden even if published');
reset role;
update businesses set is_active=true, public_booking_enabled=false where slug='catalog-test-a';
set local role anon;
select throws_ok($$select get_public_booking_catalog('catalog-test-a')$$,'42501','Public booking unavailable','Disabling publication removes public access');
reset role;
select * from finish();
rollback;
