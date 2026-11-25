import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { demoDataset } from '../src/lib/demo';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PROGRAM = '33333333-3333-4333-8333-333333333333';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/202611190001_campify.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/202611190002_clear_sample_data.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/202611190003_staff_invitations.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/202611240001_invitation_service_permissions.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${USER}'), ('${OTHER}'); insert into public.programs values ('${PROGRAM}', 'Test'); insert into public.program_members values ('${PROGRAM}', '${USER}'); set role authenticated; set request.jwt.claim.sub = '${USER}';`);
}, 30000);
afterAll(async () => { await db?.close(); });
const importData = (hash: string, rows = demoDataset().enrollments.slice(0, 4)) => db.query<{ result: { duplicate: boolean; row_count: number } }>('select public.import_enrollments($1,$2,$3,$4::jsonb) as result', [PROGRAM, 'example.csv', hash.repeat(64), JSON.stringify(rows)]);
describe('Supabase SQL security and atomic import', () => {
  it('imports normalized records and makes exact-file repeats idempotent', async () => {
    expect((await importData('a')).rows[0].result.row_count).toBe(4);
    expect((await importData('a')).rows[0].result.duplicate).toBe(true);
    expect((await db.query('select * from enrollment_details')).rows).toHaveLength(4);
  });
  it('updates a registration without counting it twice', async () => {
    const rows = demoDataset().enrollments.slice(0, 4); rows[1].school = 'Changed school';
    await importData('b', rows);
    const result = await db.query<{ school: string }>('select school from enrollments where registration_id=$1', [rows[1].registration_id]);
    expect(result.rows[0].school).toBe('Changed school');
    expect((await db.query('select * from enrollments')).rows).toHaveLength(4);
  });
  it('rolls back all writes when a later row is invalid', async () => {
    const rows = demoDataset().enrollments.slice(0, 4); rows[0].school = 'Must not persist'; rows[3].status = 'bad' as never;
    await expect(importData('c', rows)).rejects.toThrow();
    expect((await db.query<{ school: string }>('select school from enrollments where registration_id=$1', [rows[0].registration_id])).rows[0].school).not.toBe('Must not persist');
    expect((await db.query('select * from imports')).rows).toHaveLength(2);
  });
  it('blocks direct writes and membership escalation', async () => {
    await expect(db.exec(`insert into program_members values ('${PROGRAM}', '${OTHER}')`)).rejects.toThrow();
    await expect(db.exec(`update enrollments set status='cancelled'`)).rejects.toThrow();
  });
  it('isolates members and denies unauthorized import', async () => {
    await db.exec(`set request.jwt.claim.sub = '${OTHER}'`);
    expect((await db.query('select * from enrollment_details')).rows).toHaveLength(0);
    expect((await db.query('select * from imports')).rows).toHaveLength(0);
    await expect(importData('d')).rejects.toThrow('Program membership required');
    await db.exec(`set request.jwt.claim.sub = '${USER}'`);
  });
});

describe('Sample cleanup', () => {
  it('rejects other users and anonymous callers', async () => {
    await db.exec(`set request.jwt.claim.sub = '${OTHER}'`);
    await expect(db.query('select public.clear_sample_data($1)', [PROGRAM])).rejects.toThrow('Program membership required');
    await db.exec(`set request.jwt.claim.sub = ''`);
    await expect(db.query('select public.clear_sample_data($1)', [PROGRAM])).rejects.toThrow('Program membership required');
    await db.exec(`set request.jwt.claim.sub = '${USER}'`);
  });
  it('preserves real rows, shared entities, goals, memberships and mixed import receipts', async () => {
    const real = { ...demoDataset().enrollments[1], registration_id: 'REAL-1' };
    await importData('e', [real, demoDataset().enrollments[4]]);
    await db.exec(`insert into goals values ('${PROGRAM}', 2026, 160)`);
    const result = await db.query<{result: {removed:number}}>('select public.clear_sample_data($1) as result', [PROGRAM]);
    expect(result.rows[0].result.removed).toBe(5);
    expect((await db.query<{registration_id:string}>('select registration_id from enrollments')).rows).toEqual([{registration_id:'REAL-1'}]);
    expect((await db.query('select * from players')).rows).toHaveLength(1);
    expect((await db.query('select * from camps')).rows).toHaveLength(1);
    expect((await db.query('select * from goals')).rows).toHaveLength(1);
    expect((await db.query('select * from program_members')).rows).toHaveLength(1);
    expect((await db.query('select * from imports where file_hash=$1', ['e'.repeat(64)])).rows).toHaveLength(1);
    expect((await db.query('select * from imports where file_hash=$1', ['b'.repeat(64)])).rows).toHaveLength(0);
    expect((await db.query<{result:{removed:number}}>('select public.clear_sample_data($1) as result', [PROGRAM])).rows[0].result.removed).toBe(0);
    // Removed receipts allow importing the sample again.
    expect((await importData('b')).rows[0].result.duplicate).toBe(false);
  });
});

describe('Invitation administrator permissions', () => {
  it('does not let staff make themselves invitation administrators', async () => {
    await expect(db.exec(`insert into program_admins values ('${PROGRAM}', '${USER}')`)).rejects.toThrow();
    expect((await db.query('select * from program_admins')).rows).toHaveLength(0);
  });
  it('only reveals the caller’s own administrator membership', async () => {
    await db.exec(`reset role; insert into program_admins values ('${PROGRAM}', '${USER}'); set role authenticated; set request.jwt.claim.sub = '${USER}'`);
    expect((await db.query('select * from program_admins')).rows).toHaveLength(1);
    await db.exec(`set request.jwt.claim.sub = '${OTHER}'`);
    expect((await db.query('select * from program_admins')).rows).toHaveLength(0);
    await db.exec(`set request.jwt.claim.sub = '${USER}'`);
  });
});

 it('allows the invitation service to assign membership without allowing client escalation', async () => {
  await db.exec('reset role; set role service_role');
  try {
    await db.exec(`insert into program_members values ('${PROGRAM}', '${OTHER}') on conflict (program_id,user_id) do update set user_id=excluded.user_id`);
    expect((await db.query(`select * from program_members where user_id='${OTHER}'`)).rows).toHaveLength(1);
  } finally {
    await db.exec(`reset role; delete from program_members where user_id='${OTHER}'; set role authenticated; set request.jwt.claim.sub='${USER}'`);
  }
  await expect(db.exec(`insert into program_members values ('${PROGRAM}', '${OTHER}')`)).rejects.toThrow();
 });
