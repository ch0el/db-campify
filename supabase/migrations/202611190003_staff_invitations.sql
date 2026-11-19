create table if not exists public.program_admins (
  program_id uuid not null references public.programs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (program_id,user_id),
  foreign key (program_id,user_id) references public.program_members on delete cascade
);
alter table public.program_admins enable row level security;
revoke all on public.program_admins from anon,authenticated;
grant select on public.program_admins to authenticated;
create policy admin_self_read on public.program_admins for select to authenticated using (user_id = (select auth.uid()));
-- Designate administrators explicitly; never derive this from client user_metadata.
-- Example (replace both UUIDs with the existing program and administrator):
-- insert into public.program_admins values ('PROGRAM_UUID','ADMIN_AUTH_UUID');
