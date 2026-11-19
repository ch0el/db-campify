-- Campify: one shared program, explicitly provisioned membership, no public access.
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200)
);
create table public.program_members (
  program_id uuid not null references public.programs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (program_id, user_id)
);
create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  display_name text not null default '' check (length(display_name) <= 100),
  features text[] not null default array['goals','players','demographics','calendar','enrollment'],
  check (features <@ array['goals','players','demographics','calendar','enrollment']::text[])
);
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs on delete cascade,
  file_name text not null check (length(file_name) between 1 and 255),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  row_count integer not null check (row_count between 1 and 5000),
  imported_by uuid not null references auth.users default auth.uid(),
  imported_at timestamptz not null default now(),
  unique (program_id, file_hash)
);
create table public.camps (
  program_id uuid not null references public.programs on delete cascade,
  camp_id text not null check (length(camp_id) between 1 and 300),
  camp_name text not null check (length(camp_name) between 1 and 300),
  camp_type text not null check (length(camp_type) between 1 and 300),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  primary key (program_id, camp_id)
);
create table public.players (
  program_id uuid not null references public.programs on delete cascade,
  participant_id text not null check (length(participant_id) between 1 and 300),
  participant_name text not null check (length(participant_name) between 1 and 300),
  primary key (program_id, participant_id)
);
create table public.enrollments (
  program_id uuid not null references public.programs on delete cascade,
  registration_id text not null check (length(registration_id) between 1 and 300),
  participant_id text not null,
  camp_id text not null,
  registered_on date not null,
  school text not null default 'Unknown' check (length(school) between 1 and 300),
  district text not null default 'Unknown' check (length(district) between 1 and 300),
  referral_source text not null default 'Unknown' check (length(referral_source) between 1 and 300),
  status text not null check (status in ('confirmed', 'cancelled', 'waitlisted')),
  amount_cents integer not null default 0 check (amount_cents between 0 and 100000000),
  import_id uuid not null references public.imports,
  primary key (program_id, registration_id),
  foreign key (program_id, participant_id) references public.players,
  foreign key (program_id, camp_id) references public.camps
);
create table public.goals (
  program_id uuid not null references public.programs on delete cascade,
  year integer not null check (year between 1900 and 2200),
  target integer not null check (target between 1 and 1000000),
  primary key (program_id, year)
);
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs on delete cascade,
  reported_by uuid not null references auth.users default auth.uid(),
  description text not null check (length(description) between 10 and 5000),
  page text not null check (length(page) <= 100),
  created_at timestamptz not null default now()
);

alter table public.programs enable row level security;
alter table public.program_members enable row level security;
alter table public.profiles enable row level security;
alter table public.imports enable row level security;
alter table public.camps enable row level security;
alter table public.players enable row level security;
alter table public.enrollments enable row level security;
alter table public.goals enable row level security;
alter table public.issues enable row level security;

create policy membership_read on public.program_members for select to authenticated using (user_id = (select auth.uid()));
create policy programs_read on public.programs for select to authenticated using (id in (select program_id from public.program_members where user_id = (select auth.uid())));
create policy profile_read on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profile_insert on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profile_update on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Enrollment data is read by members; writes only through the validated atomic RPC.
create policy imports_read on public.imports for select to authenticated using (program_id in (select program_id from public.program_members where user_id = (select auth.uid())));
create policy camps_read on public.camps for select to authenticated using (program_id in (select program_id from public.program_members where user_id = (select auth.uid())));
create policy players_read on public.players for select to authenticated using (program_id in (select program_id from public.program_members where user_id = (select auth.uid())));
create policy enrollments_read on public.enrollments for select to authenticated using (program_id in (select program_id from public.program_members where user_id = (select auth.uid())));
create policy goals_access on public.goals for all to authenticated using (program_id in (select program_id from public.program_members where user_id = (select auth.uid()))) with check (program_id in (select program_id from public.program_members where user_id = (select auth.uid())));
create policy issues_read on public.issues for select to authenticated using (program_id in (select program_id from public.program_members where user_id = (select auth.uid())));
create policy issues_insert on public.issues for insert to authenticated with check (reported_by = (select auth.uid()) and program_id in (select program_id from public.program_members where user_id = (select auth.uid())));

create view public.enrollment_details with (security_invoker = true) as
select e.program_id, e.registration_id, e.participant_id, p.participant_name,
       e.camp_id, c.camp_name, c.camp_type, c.starts_on, c.ends_on,
       e.registered_on, e.school, e.district, e.referral_source, e.status, e.amount_cents
from public.enrollments e
join public.players p using (program_id, participant_id)
join public.camps c using (program_id, camp_id);

create function public.import_enrollments(p_program_id uuid, p_file_name text, p_file_hash text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import_id uuid;
  v_row jsonb;
  v_count integer;
  v_seen text[] := '{}';
begin
  if auth.uid() is null or not exists (select 1 from public.program_members where program_id = p_program_id and user_id = auth.uid()) then
    raise exception 'Program membership required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Expected an array of enrollments'; end if;
  v_count := jsonb_array_length(p_rows);
  if v_count < 1 or v_count > 5000 then raise exception 'Import requires 1 to 5000 rows'; end if;
  -- Serialize imports for one program; repeated requests cannot race.
  perform pg_advisory_xact_lock(hashtextextended(p_program_id::text, 0));
  if exists (select 1 from public.imports where program_id = p_program_id and file_hash = p_file_hash) then
    return jsonb_build_object('duplicate', true, 'row_count', 0);
  end if;
  insert into public.imports(program_id, file_name, file_hash, row_count, imported_by)
    values(p_program_id, p_file_name, p_file_hash, v_count, auth.uid()) returning id into v_import_id;

  -- Validation runs on the server too; a caller cannot bypass the CSV preview.
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) is distinct from 'object' then raise exception 'Invalid enrollment'; end if;
    if nullif(btrim(v_row->>'registration_id'), '') is null or nullif(btrim(v_row->>'participant_id'), '') is null or nullif(btrim(v_row->>'participant_name'), '') is null or nullif(btrim(v_row->>'camp_id'), '') is null or nullif(btrim(v_row->>'camp_name'), '') is null then
      raise exception 'Registration, participant, and camp identifiers and names are required';
    end if;
    if (v_row->>'registration_id') = any(v_seen) then raise exception 'Duplicate Registration ID in this file'; end if;
    v_seen := array_append(v_seen, v_row->>'registration_id');
    if coalesce(v_row->>'starts_on','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(v_row->>'ends_on','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(v_row->>'registered_on','') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Dates must use YYYY-MM-DD';
    end if;
    if coalesce(v_row->>'amount_cents','') !~ '^\d+$' then raise exception 'Amount must be integer cents'; end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    group by r->>'camp_id'
    having count(distinct jsonb_build_array(r->>'camp_name',r->>'camp_type',r->>'starts_on',r->>'ends_on')) > 1
  ) then raise exception 'Conflicting details for the same Camp ID'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    join public.enrollments e on e.program_id = p_program_id and e.registration_id = r->>'registration_id'
    where e.participant_id <> r->>'participant_id' or e.camp_id <> r->>'camp_id'
  ) then raise exception 'An existing Registration ID belongs to another player or camp'; end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    insert into public.camps(program_id,camp_id,camp_name,camp_type,starts_on,ends_on)
      values(p_program_id,v_row->>'camp_id',v_row->>'camp_name',v_row->>'camp_type',(v_row->>'starts_on')::date,(v_row->>'ends_on')::date)
      on conflict (program_id,camp_id) do update set camp_name=excluded.camp_name,camp_type=excluded.camp_type,starts_on=excluded.starts_on,ends_on=excluded.ends_on;
    insert into public.players(program_id,participant_id,participant_name)
      values(p_program_id,v_row->>'participant_id',v_row->>'participant_name')
      on conflict (program_id,participant_id) do update set participant_name=excluded.participant_name;
    insert into public.enrollments(program_id,registration_id,participant_id,camp_id,registered_on,school,district,referral_source,status,amount_cents,import_id)
      values(p_program_id,v_row->>'registration_id',v_row->>'participant_id',v_row->>'camp_id',(v_row->>'registered_on')::date,v_row->>'school',v_row->>'district',coalesce(v_row->>'referral_source','Unknown'),v_row->>'status',(v_row->>'amount_cents')::integer,v_import_id)
      on conflict (program_id,registration_id) do update set registered_on=excluded.registered_on,school=excluded.school,district=excluded.district,referral_source=excluded.referral_source,status=excluded.status,amount_cents=excluded.amount_cents,import_id=excluded.import_id;
  end loop;
  return jsonb_build_object('duplicate',false,'row_count',v_count,'import_id',v_import_id);
end;
$$;

revoke all on function public.import_enrollments(uuid,text,text,jsonb) from public;
grant execute on function public.import_enrollments(uuid,text,text,jsonb) to authenticated;
-- Remove Supabase default table grants before granting the intended API surface.
revoke all on public.programs, public.program_members, public.profiles, public.imports, public.camps, public.players, public.enrollments, public.enrollment_details, public.goals, public.issues from anon, authenticated;
grant select on public.programs, public.program_members, public.imports, public.camps, public.players, public.enrollments, public.enrollment_details to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert on public.issues to authenticated;
