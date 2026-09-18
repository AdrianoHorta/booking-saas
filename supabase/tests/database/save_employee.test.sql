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
set local role authenticated;
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000001';
select lives_ok($$select save_employee('61000000-0000-0000-0000-000000000001','  Created  ',array['64000000-0000-0000-0000-000000000001'::uuid])$$,'Owner creates profile and assignment');
select is((select name from employees where name='Created'),'Created','Name trimmed');
select is((select count(*) from employee_services where business_id='61000000-0000-0000-0000-000000000001'),1::bigint,'Creation saves assignment');
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Failed creation',array['64000000-0000-0000-0000-000000000002'::uuid])$$,'23503',null,'Foreign service rejects creation');
select is((select count(*) from employees where name='Failed creation'),0::bigint,'Failed assignment rolls back new profile');
select lives_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Edited',array['64000000-0000-0000-0000-000000000001'::uuid,'64000000-0000-0000-0000-000000000001'::uuid],'63000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000003')$$,'Owner edits and links member, deduplicating services');
select is((select count(*) from employee_services where employee_id='63000000-0000-0000-0000-000000000001'),1::bigint,'Duplicate selection creates one association');
select is((select user_id from employees where id='63000000-0000-0000-0000-000000000001'),'62000000-0000-0000-0000-000000000003'::uuid,'Membership saved');
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Must rollback',array['64000000-0000-0000-0000-000000000002'::uuid],'63000000-0000-0000-0000-000000000001',null)$$,'23503',null,'Foreign service rejects edit');
select is((select name from employees where id='63000000-0000-0000-0000-000000000001'),'Edited','Failed edit rolls back name');
select is((select user_id from employees where id='63000000-0000-0000-0000-000000000001'),'62000000-0000-0000-0000-000000000003'::uuid,'Failed edit rolls back member');
select is((select service_id from employee_services where employee_id='63000000-0000-0000-0000-000000000001'),'64000000-0000-0000-0000-000000000001'::uuid,'Failed edit restores removed assignment');
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Invalid',null,'63000000-0000-0000-0000-000000000001')$$,'22023',null,'Null selection rejected');
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Invalid',array[null::uuid],'63000000-0000-0000-0000-000000000001')$$,'22023',null,'Null item rejected');
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Wrong tenant',array[]::uuid[],'63000000-0000-0000-0000-000000000002')$$,'42501',null,'Foreign employee rejected');
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000002','Wrong business',array[]::uuid[])$$,'42501',null,'Foreign business rejected');
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001',' ',array[]::uuid[],'63000000-0000-0000-0000-000000000001')$$,'23514',null,'Invalid name rejected');
update employees set is_active=false where id='63000000-0000-0000-0000-000000000001';
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000002';
select lives_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Admin edit',array[]::uuid[],'63000000-0000-0000-0000-000000000001',null)$$,'Admin clears services and member');
select is((select count(*) from employee_services where employee_id='63000000-0000-0000-0000-000000000001'),0::bigint,'Empty array removes all assignments');
select is((select user_id from employees where id='63000000-0000-0000-0000-000000000001'),null::uuid,'Member unlinked');
select ok((select not is_active from employees where id='63000000-0000-0000-0000-000000000001'),'Editing preserves inactive state');
select lives_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Admin create',array[]::uuid[])$$,'Admin creates without services');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000003';
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Employee attack',array[]::uuid[])$$,'42501',null,'Employee cannot create via RPC');
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Employee attack',array[]::uuid[],'63000000-0000-0000-0000-000000000001')$$,'42501',null,'Employee cannot edit via RPC');
set local "request.jwt.claim.sub" = '62000000-0000-0000-0000-000000000005';
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Outsider',array[]::uuid[])$$,'42501',null,'Outsider cannot call RPC');
set local "request.jwt.claim.sub" = '';
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','No identity',array[]::uuid[])$$,'42501',null,'Missing identity rejected');
reset role;
set local role anon;
select throws_ok($$select save_employee('61000000-0000-0000-0000-000000000001','Anonymous',array[]::uuid[])$$,'42501',null,'Anonymous cannot execute RPC');
reset role;
select is((select name from employees where id='63000000-0000-0000-0000-000000000002'),'Employee B','Other tenant unchanged');
select ok(not (select prosecdef from pg_proc where oid='public.save_employee(uuid,text,uuid[],uuid,uuid)'::regprocedure),'RPC runs with caller permissions');
select * from finish();
rollback;
