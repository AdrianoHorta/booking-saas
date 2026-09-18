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
select ok((select relrowsecurity from pg_class where oid='public.employees'::regclass), 'Employees RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.employee_services'::regclass), 'Employee services RLS enabled');
set local role authenticated;

-- owner: operações autorizadas e persistência.
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000001';
select is((select count(*) from employees),1::bigint,'owner sees only own tenant');
select lives_ok($$insert into employees(business_id,name) values ('61000000-0000-0000-0000-000000000001','Created owner')$$,'owner creates without login');
select lives_ok($$update employees set name='Edited owner',is_active=false where id='63000000-0000-0000-0000-000000000001'$$,'owner edits and deactivates');
select ok((select name='Edited owner' and not is_active and updated_at>'2000-01-01'::timestamptz from employees where id='63000000-0000-0000-0000-000000000001'),'owner changes and timestamp persist');
select lives_ok($$update employees set is_active=true where id='63000000-0000-0000-0000-000000000001'$$,'owner activates');
select ok((select is_active from employees where id='63000000-0000-0000-0000-000000000001'),'owner activation persists');
select lives_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001')$$,'owner assigns service');
select is((select count(*) from employee_services),1::bigint,'owner sees only own assignment');
with removed as (delete from employee_services where employee_id='63000000-0000-0000-0000-000000000001' returning employee_id)
select is((select count(*) from removed),1::bigint,'owner removes assignment');
select throws_ok($$insert into employees(business_id,name) values ('61000000-0000-0000-0000-000000000002','Attack')$$,'42501',null,'owner cannot create in B');
with changed as (update employees set name='Attack' where id='63000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from changed),0::bigint,'owner cannot edit B');
select throws_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002')$$,'42501',null,'owner cannot assign in B');
with removed as (delete from employee_services where business_id='61000000-0000-0000-0000-000000000002' returning employee_id)
select is((select count(*) from removed),0::bigint,'owner cannot remove B assignment');
select throws_ok($$delete from employees where id='63000000-0000-0000-0000-000000000001'$$,'42501',null,'owner cannot delete employees');

-- admin: operações autorizadas e persistência.
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000002';
select is((select count(*) from employees),2::bigint,'admin sees only own tenant');
select lives_ok($$insert into employees(business_id,name) values ('61000000-0000-0000-0000-000000000001','Created admin')$$,'admin creates without login');
select lives_ok($$update employees set name='Edited admin',is_active=false where id='63000000-0000-0000-0000-000000000001'$$,'admin edits and deactivates');
select ok((select name='Edited admin' and not is_active and updated_at>'2000-01-01'::timestamptz from employees where id='63000000-0000-0000-0000-000000000001'),'admin changes and timestamp persist');
select lives_ok($$update employees set is_active=true where id='63000000-0000-0000-0000-000000000001'$$,'admin activates');
select ok((select is_active from employees where id='63000000-0000-0000-0000-000000000001'),'admin activation persists');
select lives_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001')$$,'admin assigns service');
select is((select count(*) from employee_services),1::bigint,'admin sees only own assignment');
with removed as (delete from employee_services where employee_id='63000000-0000-0000-0000-000000000001' returning employee_id)
select is((select count(*) from removed),1::bigint,'admin removes assignment');
select throws_ok($$insert into employees(business_id,name) values ('61000000-0000-0000-0000-000000000002','Attack')$$,'42501',null,'admin cannot create in B');
with changed as (update employees set name='Attack' where id='63000000-0000-0000-0000-000000000002' returning id)
select is((select count(*) from changed),0::bigint,'admin cannot edit B');
select throws_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002')$$,'42501',null,'admin cannot assign in B');
with removed as (delete from employee_services where business_id='61000000-0000-0000-0000-000000000002' returning employee_id)
select is((select count(*) from removed),0::bigint,'admin cannot remove B assignment');
select throws_ok($$delete from employees where id='63000000-0000-0000-0000-000000000001'$$,'42501',null,'admin cannot delete employees');

-- Integridade de tenant e ligação opcional ao membro.
select throws_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000002')$$,'23503',null,'Cannot assign service from another tenant');
select throws_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000001')$$,'23503',null,'Cannot assign employee from another tenant');
select lives_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001')$$,'Assignment for permission tests');
select throws_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001')$$,'23505',null,'Duplicate assignment rejected');
select throws_ok($$update employee_services set service_id='64000000-0000-0000-0000-000000000002'$$,'42501',null,'Assignment identity is immutable');
select throws_ok($$update employees set business_id='61000000-0000-0000-0000-000000000002' where id='63000000-0000-0000-0000-000000000001'$$,'42501',null,'Employee tenant is immutable');
select throws_ok($$update employees set updated_at='2000-01-01' where id='63000000-0000-0000-0000-000000000001'$$,'42501',null,'Timestamp cannot be forged');
select throws_ok($$update employees set name=' ' where id='63000000-0000-0000-0000-000000000001'$$,'23514',null,'Blank name rejected');
select throws_ok($$update employees set name=repeat('a',101) where id='63000000-0000-0000-0000-000000000001'$$,'23514',null,'Long name rejected');
select throws_ok($$update employees set user_id='62000000-0000-0000-0000-000000000004' where id='63000000-0000-0000-0000-000000000001'$$,'23503',null,'User must belong to same tenant');
select throws_ok($$update employees set user_id='62000000-0000-0000-0000-000000000005' where id='63000000-0000-0000-0000-000000000001'$$,'23503',null,'User without membership cannot be linked');
select lives_ok($$update employees set user_id='62000000-0000-0000-0000-000000000003' where id='63000000-0000-0000-0000-000000000001'$$,'Link to same-tenant member');
select throws_ok($$insert into employees(business_id,name,user_id) values ('61000000-0000-0000-0000-000000000001','Duplicate account','62000000-0000-0000-0000-000000000003')$$,'23505',null,'One profile per user per business');
select is((select role::text from business_members where business_id='61000000-0000-0000-0000-000000000001' and user_id='62000000-0000-0000-0000-000000000003'),'employee','Profile link does not change role');

-- Employee tem leitura, mesmo sobre perfis desativados, sem escrita.
update employees set is_active=false where id='63000000-0000-0000-0000-000000000001';
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000003';
select is((select count(*) from employees),3::bigint,'Employee reads own catalog including inactive profiles');
select is((select count(*) from employee_services),1::bigint,'Employee reads own service assignments');
select throws_ok($$insert into employees(business_id,name) values ('61000000-0000-0000-0000-000000000001','Blocked')$$,'42501',null,'Employee cannot create');
with changed as (update employees set name='Attack',is_active=true,user_id=null where id='63000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from changed),0::bigint,'Employee cannot edit, activate or unlink own profile');
select throws_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001')$$,'42501',null,'Employee cannot assign services');
with removed as (delete from employee_services where employee_id='63000000-0000-0000-0000-000000000001' returning employee_id)
select is((select count(*) from removed),0::bigint,'Employee cannot remove assignments');
select throws_ok($$delete from employees$$,'42501',null,'Employee cannot delete');

set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000004';
select is((select count(*) from employees),1::bigint,'B owner sees only B');
select is((select count(*) from employees where id='63000000-0000-0000-0000-000000000001'),0::bigint,'Explicit ID cannot expose A');
with changed as (update employees set is_active=true where id='63000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from changed),0::bigint,'B owner cannot edit A');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000005';
select is((select count(*) from employees),0::bigint,'Outsider sees no employees');
select is((select count(*) from employee_services),0::bigint,'Outsider sees no assignments');
select throws_ok($$insert into employees(business_id,name) values ('61000000-0000-0000-0000-000000000001','Outsider')$$,'42501',null,'Outsider cannot create');
set local "request.jwt.claim.sub" = '';
select is((select count(*) from employees),0::bigint,'Missing identity sees nothing');

reset role;
-- Mesmo um manager das duas empresas não pode quebrar as referências compostas.
insert into business_members(business_id,user_id,role) values ('61000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000001','owner');
set local role authenticated;
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000001';
select throws_ok($$update employees set business_id='61000000-0000-0000-0000-000000000002' where id='63000000-0000-0000-0000-000000000001'$$,'42501',null,'Dual manager cannot transfer employee');
select throws_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000002')$$,'23503',null,'Dual manager cannot assign cross-tenant service');
select lives_ok($$update employees set user_id=null where id='63000000-0000-0000-0000-000000000001'$$,'Manager can unlink membership');
select is((select user_id from employees where id='63000000-0000-0000-0000-000000000001'),null::uuid,'Unlink persists');
select lives_ok($$insert into employees(business_id,name,user_id) values ('61000000-0000-0000-0000-000000000001','Owner A','62000000-0000-0000-0000-000000000001'),('61000000-0000-0000-0000-000000000002','Owner B','62000000-0000-0000-0000-000000000001')$$,'Same account can have profiles in different businesses');
reset role;
set local role anon;
select throws_ok($$select * from employees$$,'42501',null,'Anonymous cannot read employees');
select throws_ok($$delete from employees$$,'42501',null,'Anonymous cannot delete employees');
select throws_ok($$select * from employee_services$$,'42501',null,'Anonymous cannot read employee_services');
select throws_ok($$delete from employee_services$$,'42501',null,'Anonymous cannot delete employee_services');
select throws_ok($$insert into employees(business_id,name) values ('61000000-0000-0000-0000-000000000001','Anonymous')$$,'42501',null,'Anonymous cannot create employee');
select throws_ok($$update employees set is_active=false$$,'42501',null,'Anonymous cannot edit employee');
select throws_ok($$insert into employee_services(business_id,employee_id,service_id) values ('61000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001')$$,'42501',null,'Anonymous cannot assign services');
reset role;
select * from finish();
rollback;
