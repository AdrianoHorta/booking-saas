begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
 ('f2000000-0000-4000-8000-000000000001','profile-owner@example.test'),
 ('f2000000-0000-4000-8000-000000000002','profile-worker@example.test'),
 ('f2000000-0000-4000-8000-000000000003','profile-admin@example.test');
insert into businesses(id,name,slug,public_booking_enabled) values
 ('f1000000-0000-4000-8000-000000000001','Profile test','profile-test',true),
 ('f1000000-0000-4000-8000-000000000002','Other profile','other-profile',true);
insert into business_members(business_id,user_id,role) values
 ('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','owner'),
 ('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','employee'),
 ('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000003','admin');
insert into employees(id,business_id,name,user_id) values
 ('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Professional name','f2000000-0000-4000-8000-000000000002');
insert into services(id,business_id,name,duration_minutes,price_cents) values
 ('f4000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Service',30,1500);
insert into employee_services(business_id,employee_id,service_id) values
 ('f1000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001');
set local role authenticated;
set local "request.jwt.claim.sub"='f2000000-0000-4000-8000-000000000002';
select is(get_my_profile()->>'full_name','','Existing accounts get an empty profile');
select is(save_my_profile('  Personal name  ')->>'full_name','Personal name','User saves a trimmed personal name');
select throws_ok($$select save_my_profile(' ')$$,'22023',null,'Blank name rejected');
select throws_ok($$select save_my_profile(repeat('a',121))$$,'22023',null,'Oversized name rejected');
select throws_ok($$insert into user_profiles(user_id,full_name) values('f2000000-0000-4000-8000-000000000001','Intruder')$$,'42501',null,'Direct profile writes denied');
select lives_ok($$insert into storage.objects(bucket_id,name) values('brand-images','users/f2000000-0000-4000-8000-000000000002/f5000000-0000-4000-8000-000000000001.webp')$$,'User uploads inside own namespace');
select throws_ok($$insert into storage.objects(bucket_id,name) values('brand-images','users/f2000000-0000-4000-8000-000000000001/f5000000-0000-4000-8000-000000000001.webp')$$,'42501',null,'Cannot upload as another user');
select throws_ok($$insert into storage.objects(bucket_id,name) values('brand-images','businesses/f1000000-0000-4000-8000-000000000001/f5000000-0000-4000-8000-000000000001.webp')$$,'42501',null,'Employee cannot upload company logo');
select throws_ok($$select set_my_avatar('users/f2000000-0000-4000-8000-000000000002/f5000000-0000-4000-8000-000000000099.webp')$$,'42501',null,'Nonexistent image rejected');
select is(set_my_avatar('users/f2000000-0000-4000-8000-000000000002/f5000000-0000-4000-8000-000000000001.webp')->>'avatar_path',
 'users/f2000000-0000-4000-8000-000000000002/f5000000-0000-4000-8000-000000000001.webp','Own uploaded image attached');
select is(save_my_profile('Updated name')->>'avatar_path','users/f2000000-0000-4000-8000-000000000002/f5000000-0000-4000-8000-000000000001.webp','Saving name preserves avatar');
select throws_ok($$select save_business_details('f1000000-0000-4000-8000-000000000001','Hijack','','','','')$$,'42501',null,'Employee cannot edit business');
set local "request.jwt.claim.sub"='f2000000-0000-4000-8000-000000000003';
select throws_ok($$select set_business_logo('f1000000-0000-4000-8000-000000000001',null)$$,'42501',null,'Admin cannot edit owner branding');
select throws_ok($$select save_business_details('f1000000-0000-4000-8000-000000000001','Hijack','','','','')$$,'42501',null,'Admin cannot edit owner details');
set local "request.jwt.claim.sub"='f2000000-0000-4000-8000-000000000001';
select is((select count(*) from user_profiles),0::bigint,'Owner cannot read another personal profile');
select is((select count(*) from storage.objects where bucket_id='brand-images'),0::bigint,'Cannot list another user images');
select throws_ok($$select set_my_avatar('users/f2000000-0000-4000-8000-000000000002/f5000000-0000-4000-8000-000000000001.webp')$$,'42501',null,'Cannot attach another user image');
select lives_ok($$insert into storage.objects(bucket_id,name) values('brand-images','businesses/f1000000-0000-4000-8000-000000000001/f5000000-0000-4000-8000-000000000002.webp')$$,'Owner uploads company logo');
select lives_ok($$select set_business_logo('f1000000-0000-4000-8000-000000000001','businesses/f1000000-0000-4000-8000-000000000001/f5000000-0000-4000-8000-000000000002.webp')$$,'Owner attaches company logo');
select throws_ok($$select set_my_avatar('businesses/f1000000-0000-4000-8000-000000000001/f5000000-0000-4000-8000-000000000002.webp')$$,'42501',null,'Company logo cannot be attached as personal avatar');
select throws_ok($$select set_business_logo('f1000000-0000-4000-8000-000000000002',null)$$,'42501',null,'Owner cannot change another company');
select lives_ok($$select save_business_details('f1000000-0000-4000-8000-000000000001','Updated business','Description','123','contact@example.test','Street')$$,'Owner updates details');
select is((select slug from businesses where id='f1000000-0000-4000-8000-000000000001'),'profile-test','Public address stays unchanged');
select throws_ok($$select save_business_details('f1000000-0000-4000-8000-000000000001','Valid','','','bad','')$$,'22023',null,'Invalid email rejected server-side');
set local role anon;
select throws_ok($$select get_my_profile()$$,'42501',null,'Anonymous cannot read personal profile');
select is(get_public_booking_catalog('profile-test')->'business'->>'logo_path','businesses/f1000000-0000-4000-8000-000000000001/f5000000-0000-4000-8000-000000000002.webp','Public catalog includes logo');
select is(get_public_booking_catalog('profile-test')->'services'->0->'employees'->0->>'avatar_path','users/f2000000-0000-4000-8000-000000000002/f5000000-0000-4000-8000-000000000001.webp','Public professional includes photo');
select is(get_public_booking_catalog('profile-test')->'services'->0->'employees'->0->>'name','Professional name','Personal name does not overwrite professional name');
select ok(not (get_public_booking_catalog('profile-test')::text like '%Updated name%'),'Private personal name not exposed');
reset role;
update employees set user_id=null where id='f3000000-0000-4000-8000-000000000001';
set local role anon;
select is(get_public_booking_catalog('profile-test')->'services'->0->'employees'->0->>'avatar_path',null::text,'Unlinking employee removes public photo');
reset role;
update businesses set public_booking_enabled=false where id='f1000000-0000-4000-8000-000000000001';
set local role anon;
select throws_ok($$select get_public_booking_catalog('profile-test')$$,'42501',null,'Unpublished catalog remains private');
set local role authenticated;
set local "request.jwt.claim.sub"='f2000000-0000-4000-8000-000000000002';
select is(set_my_avatar(null)->>'avatar_path',null::text,'User removes avatar');
select is(get_my_profile()->>'full_name','Updated name','Removing avatar preserves personal name');
reset role;
select * from finish();
rollback;
