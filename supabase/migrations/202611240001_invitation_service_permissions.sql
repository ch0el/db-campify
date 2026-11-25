-- Server-only invitation handler needs these privileges after checking the caller.
grant select, insert, update on public.program_members to service_role;
grant select on public.program_admins to service_role;
