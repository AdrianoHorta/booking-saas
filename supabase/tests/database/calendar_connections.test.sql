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
create function pg_temp.backend(action text, payload jsonb default '{}'::jsonb) returns jsonb language sql as $$
 select public.calendar_connection_backend(action,'d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000003',payload)
$$;
set local role anon;
select throws_ok('select * from employee_calendar_credentials','42501',null,'Anon cannot read credentials');
select throws_ok($$select calendar_connection_status('d1000000-0000-0000-0000-000000000001')$$,'42501',null,'Anon cannot read status');
reset role;
set local role authenticated;
set local "request.jwt.claim.sub"='d2000000-0000-0000-0000-000000000003';
select is(calendar_connection_status('d1000000-0000-0000-0000-000000000001')->>'connected','false','Associated employee initially disconnected');
select throws_ok($$select pg_temp.backend('read')$$,'42501',null,'Browser cannot invoke backend RPC');
select throws_ok('select * from employee_calendar_credentials','42501',null,'Employee cannot read encrypted secrets');
set local "request.jwt.claim.sub"='d2000000-0000-0000-0000-000000000001';
select is(calendar_connection_status('d1000000-0000-0000-0000-000000000001'),null::jsonb,'Owner without professional cannot inspect colleagues');
reset role;
select throws_ok($$select calendar_connection_backend('read','d1000000-0000-0000-0000-000000000002','d2000000-0000-0000-0000-000000000003')$$,'42501',null,'Cross tenant request rejected');
select throws_ok($$select pg_temp.backend('start')$$,'22023',null,'Missing state rejected');
select ok(pg_temp.backend('start',jsonb_build_object('state_hash',repeat('a',64)))->>'state_hash'=repeat('a',64),'Start stores hash');
select throws_ok($$select pg_temp.backend('consume')$$,'22023',null,'Missing callback state rejected');
select throws_ok($$select pg_temp.backend('consume','{"state_hash":"wrong"}')$$,'22023',null,'Wrong state rejected');
select lives_ok($$select pg_temp.backend('consume',jsonb_build_object('state_hash',repeat('a',64)))$$,'Valid state consumed');
select throws_ok($$select pg_temp.backend('consume',jsonb_build_object('state_hash',repeat('a',64)))$$,'22023',null,'Replay rejected');
select throws_ok($$select pg_temp.backend('save',jsonb_build_object('version',gen_random_uuid(),'credentials','ciphertext'))$$,'40001',null,'Stale save rejected');
select lives_ok($$select pg_temp.backend('save',jsonb_build_object('version',pg_temp.backend('read')->>'version','credentials','ciphertext'))$$,'Server saves encrypted credentials');
select lives_ok($$select pg_temp.backend('select',jsonb_build_object('version',pg_temp.backend('read')->>'version','calendar_id','primary','calendar_name','Work'))$$,'Server selects validated calendar');
set local role authenticated;
set local "request.jwt.claim.sub"='d2000000-0000-0000-0000-000000000003';
select is(calendar_connection_status('d1000000-0000-0000-0000-000000000001')->>'connected','true','Own status visible');
select ok(not(calendar_connection_status('d1000000-0000-0000-0000-000000000001') ? 'credentials'),'Status contains no secrets');
reset role;
select lives_ok($$select pg_temp.backend('disconnect',jsonb_build_object('version',pg_temp.backend('read')->>'version'))$$,'Disconnect succeeds');
select is(pg_temp.backend('read')->>'credentials',null::text,'Disconnect deletes secret');
select lives_ok($$select pg_temp.backend('start',jsonb_build_object('state_hash',repeat('a',64)))$$,'Can reconnect');
update employee_calendar_credentials set state_expires_at=now()-interval '1 minute';
select throws_ok($$select pg_temp.backend('consume',jsonb_build_object('state_hash',repeat('a',64)))$$,'22023',null,'Expired state rejected');
update employees set user_id=null where id='d3000000-0000-0000-0000-000000000001';
select is((select count(*) from employee_calendar_credentials),0::bigint,'Reassignment removes old credentials and pending state');
select throws_ok($$select pg_temp.backend('read')$$,'42501',null,'Detached user cannot finish connection');
select * from finish();
rollback;

