-- Isolated CI identities, not hosted Supabase accounts. No application bypass route.
insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000ce01'),('00000000-0000-0000-0000-00000000ce02'),('00000000-0000-0000-0000-00000000ce03');
insert into public.profiles(id,display_name) values
 ('00000000-0000-0000-0000-00000000ce01','Connor fixture'),('00000000-0000-0000-0000-00000000ce02','Izzy fixture'),('00000000-0000-0000-0000-00000000ce03','Unrelated fixture');
