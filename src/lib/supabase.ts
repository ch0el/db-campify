import { createClient } from '@supabase/supabase-js';
import type { Dataset, Enrollment, Goal, ImportRecord, Profile } from './types';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export async function loadProgram() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('program_members').select('program_id, programs(name)').limit(2);
  if (error) throw error;
  if (!data?.length) throw new Error('Your account has no program access. Ask an administrator to add your program membership.');
  if (data.length > 1) throw new Error('This version supports one program per staff account. Ask an administrator to select your program.');
  return data[0].program_id as string;
}
export async function loadDataset(programId: string): Promise<Dataset> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const enrollments: Enrollment[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('enrollment_details').select('*').eq('program_id', programId).order('registration_id').range(offset, offset + 999);
    if (error) throw error;
    enrollments.push(...data as Enrollment[]);
    if (data.length < 1000) break;
  }
  const [imports, goals] = await Promise.all([
    supabase.from('imports').select('id,file_name,imported_at,row_count,file_hash').eq('program_id', programId).order('imported_at', { ascending: false }).limit(50),
    supabase.from('goals').select('year,target').eq('program_id', programId),
  ]);
  if (imports.error) throw imports.error;
  if (goals.error) throw goals.error;
  return { enrollments, imports: imports.data as ImportRecord[], goals: goals.data as Goal[] };
}
export async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase!.from('profiles').select('display_name,features').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveProfile(userId: string, profile: Profile) {
  const { error } = await supabase!.from('profiles').upsert({ user_id: userId, ...profile });
  if (error) throw error;
}
export async function importRows(programId: string, fileName: string, hash: string, rows: Enrollment[]) {
  const { data, error } = await supabase!.rpc('import_enrollments', { p_program_id: programId, p_file_name: fileName, p_file_hash: hash, p_rows: rows });
  if (error) throw error;
  return data as { duplicate: boolean; row_count: number };
}
export async function saveGoal(programId: string, goal: Goal) {
  const { error } = await supabase!.from('goals').upsert({ program_id: programId, ...goal });
  if (error) throw error;
}
export async function reportIssue(programId: string, description: string, page: string) {
  const { error } = await supabase!.from('issues').insert({ program_id: programId, description, page });
  if (error) throw error;
}

export async function clearSampleData(programId: string) {
  const { data, error } = await supabase!.rpc('clear_sample_data', { p_program_id: programId });
  if (error) {
    if (error.code === 'PGRST202') throw new Error('Sample cleanup is not installed yet. Ask your administrator to apply the sample cleanup migration.');
    throw error;
  }
  return data as { removed: number };
}
