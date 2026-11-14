-- STEP 3: run AFTER creating your admin user in Authentication > Users.
-- Replace PUT_YOUR_EMAIL_HERE with YOUR admin email, then press Run.
insert into profiles (id, role)
select id, 'admin' from auth.users where email = 'PUT_YOUR_EMAIL_HERE'
on conflict (id) do update set role = 'admin';
