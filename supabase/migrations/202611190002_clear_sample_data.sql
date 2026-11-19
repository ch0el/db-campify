-- Only removes reserved Campify sample IDs in the caller's own program.
create or replace function public.clear_sample_data(p_program_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import_ids uuid[];
  v_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.program_members
    where program_id = p_program_id and user_id = auth.uid()
  ) then
    raise exception 'Program membership required' using errcode = '42501';
  end if;
  -- Use the same lock as CSV imports to prevent concurrent import/cleanup races.
  perform pg_advisory_xact_lock(hashtextextended(p_program_id::text, 0));
  select array_agg(distinct import_id) into v_import_ids
  from public.enrollments
  where program_id = p_program_id
    and registration_id ~ '^DEMO-202[2-6]-[0-9]+$'
    and participant_id ~ '^DEMO-P[0-9]+$'
    and camp_id ~ '^DEMO-C202[2-6]-[0-2]$';
  delete from public.enrollments
  where program_id = p_program_id
    and registration_id ~ '^DEMO-202[2-6]-[0-9]+$'
    and participant_id ~ '^DEMO-P[0-9]+$'
    and camp_id ~ '^DEMO-C202[2-6]-[0-2]$';
  get diagnostics v_count = row_count;
  delete from public.players p
  where p.program_id = p_program_id and p.participant_id ~ '^DEMO-P[0-9]+$'
    and not exists (select 1 from public.enrollments e where e.program_id = p.program_id and e.participant_id = p.participant_id);
  delete from public.camps c
  where c.program_id = p_program_id and c.camp_id ~ '^DEMO-C202[2-6]-[0-2]$'
    and not exists (select 1 from public.enrollments e where e.program_id = c.program_id and e.camp_id = c.camp_id);
  delete from public.imports i
  where i.program_id = p_program_id and i.id = any(v_import_ids)
    and not exists (select 1 from public.enrollments e where e.import_id = i.id);
  return jsonb_build_object('removed', v_count);
end;
$$;
revoke all on function public.clear_sample_data(uuid) from public, anon;
grant execute on function public.clear_sample_data(uuid) to authenticated;
