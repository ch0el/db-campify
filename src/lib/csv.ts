import Papa from 'papaparse';
import type { Enrollment, EnrollmentStatus } from './types';

// Placeholder schema: mapping is deliberately editable until a real Teamworks export is available.
export const columns = [
  ['registration_id', 'Registration ID', true], ['participant_id', 'Participant ID', true],
  ['participant_name', 'Participant Name', true], ['camp_id', 'Camp ID', true],
  ['camp_name', 'Camp Name', true], ['camp_type', 'Camp Type', false],
  ['starts_on', 'Start Date', true], ['ends_on', 'End Date', true],
  ['registered_on', 'Registration Date', true], ['school', 'School', false],
  ['district', 'District', false], ['referral_source', 'Referral Source', false], ['status', 'Status', false], ['amount_cents', 'Amount Paid', false],
] as const;
export type Field = typeof columns[number][0];
export type Mapping = Record<Field, string>;
export interface ParsedCSV { headers: string[]; rows: Record<string, string>[] }
export const MAX_ROWS = 5000;
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases: Partial<Record<Field, string[]>> = {
  participant_name: ['campername', 'playername'], participant_id: ['camperid', 'playerid'],
  camp_id: ['eventid'], camp_name: ['eventname'], starts_on: ['campstartdate', 'eventstartdate'],
  ends_on: ['campenddate', 'eventenddate'], district: ['schooldistrict'],
};
export function parseCSV(text: string): ParsedCSV {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (parsed.errors.length) throw new Error(`CSV could not be read: ${parsed.errors[0].message}`);
  const [rawHeaders, ...rows] = parsed.data;
  const headers = rawHeaders?.map(s => s.trim());
  if (!headers?.length || !rows.length) throw new Error('The CSV must contain a header row and at least one enrollment.');
  if (headers.some(h => !h) || new Set(headers.map(normalize)).size !== headers.length) throw new Error('Column names must be non-empty and unique.');
  if (rows.length > MAX_ROWS) throw new Error(`Import up to ${MAX_ROWS.toLocaleString()} rows at a time.`);
  rows.forEach((row, i) => { if (row.length !== headers.length) throw new Error(`Row ${i + 2}: expected ${headers.length} columns, found ${row.length}.`); });
  return { headers, rows: rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i].trim()]))) };
}
export function suggestMapping(headers: string[]): Mapping {
  return Object.fromEntries(columns.map(([key, label]) => [key, headers.find(h => [normalize(key), normalize(label), ...(aliases[key] ?? [])].includes(normalize(h))) ?? ''])) as Mapping;
}
export function dateISO(value: string): string | null {
  let match: string[] | null = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (us) match = ['', us[3], us[1].padStart(2, '0'), us[2].padStart(2, '0')];
  }
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
export function validateRows(parsed: ParsedCSV, mapping: Mapping): { enrollments: Enrollment[]; errors: string[] } {
  const errors: string[] = [];
  const selected = Object.values(mapping).filter(Boolean);
  if (new Set(selected).size !== selected.length) errors.push('Map each source column to only one field.');
  for (const [key, label, required] of columns) if (required && !mapping[key]) errors.push(`Map the ${label} column.`);
  if (errors.length) return { enrollments: [], errors };
  const seen = new Set<string>();
  const camps = new Map<string, string>();
  const enrollments = parsed.rows.map((row, i) => {
    const get = (key: Field) => row[mapping[key]]?.trim() ?? '';
    const fail = (message: string) => errors.push(`Row ${i + 2}: ${message}`);
    for (const [key, label, required] of columns) {
      if (required && !get(key)) fail(`${label} is required.`);
      if (get(key).length > 300) fail(`${label} exceeds 300 characters.`);
    }
    const registration_id = get('registration_id');
    if (seen.has(registration_id)) fail(`Registration ID ${registration_id} appears more than once.`);
    seen.add(registration_id);
    const starts_on = dateISO(get('starts_on'));
    const ends_on = dateISO(get('ends_on'));
    const registered_on = dateISO(get('registered_on'));
    if (!starts_on || !ends_on || !registered_on) fail('Dates must be valid YYYY-MM-DD or M/D/YYYY values.');
    if (starts_on && ends_on && ends_on < starts_on) fail('End Date cannot precede Start Date.');
    const inputAmount = get('amount_cents') || '0';
    const rawAmount = inputAmount.replace(/^\$/, '').replace(/,/g, '');
    if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(inputAmount)) fail('Amount Paid must be a non-negative dollar amount with at most two decimals.');
    const amount_cents = Math.round(Number(rawAmount) * 100);
    if (!Number.isSafeInteger(amount_cents) || amount_cents > 100000000) fail('Amount Paid is too large.');
    const status = (get('status').toLowerCase() || 'confirmed').replace('canceled', 'cancelled');
    if (!['confirmed', 'cancelled', 'waitlisted'].includes(status)) fail('Status must be confirmed, cancelled, or waitlisted.');
    const campSignature = JSON.stringify([get('camp_name'), get('camp_type') || 'General', starts_on, ends_on]);
    if (camps.has(get('camp_id')) && camps.get(get('camp_id')) !== campSignature) fail('The same Camp ID has conflicting camp details.');
    camps.set(get('camp_id'), campSignature);
    return {
      registration_id, participant_id: get('participant_id'), participant_name: get('participant_name'),
      camp_id: get('camp_id'), camp_name: get('camp_name'), camp_type: get('camp_type') || 'General',
      starts_on: starts_on ?? '', ends_on: ends_on ?? '', registered_on: registered_on ?? '',
      school: get('school') || 'Unknown', district: get('district') || 'Unknown',
      referral_source: get('referral_source') || 'Unknown',
      status: status as EnrollmentStatus, amount_cents,
    };
  });
  return { enrollments, errors };
}
export async function hashFile(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}
export function toCSV(enrollments: Enrollment[]): string {
  return Papa.unparse(enrollments.map(row => Object.fromEntries(columns.map(([key, label]) => [label, key === 'amount_cents' ? (row.amount_cents / 100).toFixed(2) : row[key]]))));
}
