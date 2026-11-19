-- Run AFTER creating a staff account in Supabase Authentication > Users.
-- Replace this address with the actual staff account. This fails rather than creating orphan setup.
do $$
declare
  staff_id uuid;
  program_id uuid;
begin
  select id into staff_id from auth.users where email = 'joel.ihm@duke.edu';
  if staff_id is null then raise exception 'Create the staff auth user first and replace the email in bootstrap.sql'; end if;
  insert into public.programs(name) values ('Duke Baseball Camps') returning id into program_id;
  insert into public.program_members(program_id, user_id) values(program_id, staff_id);
  insert into public.profiles(user_id, display_name) values(staff_id, 'Mickey') on conflict(user_id) do nothing;
end $$;
