import type { Enrollment } from './types';
export const enrollmentYear = (row: Enrollment) => Number(row.starts_on.slice(0, 4));
export const confirmed = (rows: Enrollment[]) => rows.filter(row => row.status === 'confirmed');
export function yearStats(rows: Enrollment[], endYear: number, span: number) {
  const active = confirmed(rows);
  const firstYear = new Map<string, number>();
  for (const row of active) firstYear.set(row.participant_id, Math.min(firstYear.get(row.participant_id) ?? Infinity, enrollmentYear(row)));
  return Array.from({ length: span }, (_, i) => {
    const year = endYear - span + 1 + i;
    const inYear = active.filter(row => enrollmentYear(row) === year);
    const people = new Set(inYear.map(row => row.participant_id));
    const newPlayers = [...people].filter(id => firstYear.get(id) === year).length;
    return { year, enrollments: inYear.length, players: people.size, newPlayers, returning: people.size - newPlayers, amount: inYear.reduce((sum, row) => sum + row.amount_cents, 0) / 100 };
  });
}
export function distribution(rows: Enrollment[], field: 'school' | 'district' | 'camp_type' | 'referral_source') {
  const counts = new Map<string, number>();
  for (const row of confirmed(rows)) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
export function campEvents(rows: Enrollment[]) {
  const camps = new Map<string, { id: string; name: string; type: string; start: string; end: string; count: number }>();
  for (const row of rows) {
    const existing = camps.get(row.camp_id);
    if (existing) existing.count += Number(row.status === 'confirmed');
    else camps.set(row.camp_id, { id: row.camp_id, name: row.camp_name, type: row.camp_type, start: row.starts_on, end: row.ends_on, count: Number(row.status === 'confirmed') });
  }
  return [...camps.values()].sort((a, b) => a.start.localeCompare(b.start));
}
