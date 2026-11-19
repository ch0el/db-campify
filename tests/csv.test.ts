import { describe, expect, it } from 'vitest';
import { dateISO, parseCSV, suggestMapping, toCSV, validateRows } from '../src/lib/csv';
import { demoDataset } from '../src/lib/demo';
import { distribution, yearStats } from '../src/lib/analytics';
const sample = () => demoDataset().enrollments.filter(r => r.status === 'confirmed').slice(0, 3);
describe('CSV import', () => {
  it('round trips quoted commas, dates and exact cents', () => {
    const rows = sample(); rows[0].school = 'School, North'; rows[0].amount_cents = 10001;
    const parsed = parseCSV(toCSV(rows));
    expect(validateRows(parsed, suggestMapping(parsed.headers))).toEqual({ enrollments: rows, errors: [] });
  });
  it('rejects duplicate headers and malformed rows', () => {
    expect(() => parseCSV('ID,ID\na,b')).toThrow('unique');
    expect(() => parseCSV('A,B\na,b,c')).toThrow('Row 2');
  });
  it('rejects duplicate registrations and invalid status/amount', () => {
    const row = sample()[0];
    const parsed = parseCSV(toCSV([row, { ...row, status: 'unrecognized' as never, amount_cents: -100 }]));
    const { errors } = validateRows(parsed, suggestMapping(parsed.headers));
    expect(errors.join(' ')).toMatch(/appears more than once/);
    expect(errors.join(' ')).toMatch(/Status must/);
    expect(errors.join(' ')).toMatch(/non-negative/);
  });
  it('validates real dates without silently rolling into the next month', () => {
    expect(dateISO('2/29/2024')).toBe('2024-02-29');
    expect(dateISO('2025-02-29')).toBeNull();
    expect(dateISO('13/1/2025')).toBeNull();
    expect(dateISO('2026-11-19T00:00:00Z')).toBeNull();
  });
  it('rejects conflicting camp details and backwards date ranges', () => {
    const row = sample()[0];
    const parsed = parseCSV(toCSV([row, { ...row, registration_id: 'another', camp_name: 'Different', ends_on: '2020-01-01' }]));
    const { errors } = validateRows(parsed, suggestMapping(parsed.headers));
    expect(errors.join(' ')).toMatch(/conflicting/);
    expect(errors.join(' ')).toMatch(/precede/);
  });
  it('rejects malformed monetary grouping rather than silently changing the amount', () => {
    const parsed = parseCSV(toCSV(sample()));
    parsed.rows[0]['Amount Paid'] = '1,2';
    expect(validateRows(parsed, suggestMapping(parsed.headers)).errors.join(' ')).toMatch(/non-negative/);
    parsed.rows[0]['Amount Paid'] = '$1,234.56';
    expect(validateRows(parsed, suggestMapping(parsed.headers)).enrollments[0].amount_cents).toBe(123456);
  });
});
describe('Analytics', () => {
  it('counts each player once, across all imported history, excluding non-confirmed rows', () => {
    const row = sample()[0];
    const rows = [row, { ...row, registration_id: 'second' }, { ...row, registration_id: 'third', starts_on: '2023-01-01' }, { ...row, participant_id: 'other', starts_on: '2023-02-01', status: 'cancelled' as const }];
    expect(yearStats(rows, 2023, 1)[0]).toMatchObject({ enrollments: 1, players: 1, newPlayers: 0, returning: 1 });
    expect(yearStats(rows, 2022, 1)[0]).toMatchObject({ enrollments: 2, players: 1, newPlayers: 1 });
  });
  it('includes missing years as zero and reconciles distributions', () => {
    const rows = demoDataset().enrollments;
    expect(yearStats(rows, 2021, 1)[0].enrollments).toBe(0);
    expect(distribution(rows, 'district').reduce((sum, r) => sum + r.count, 0)).toBe(rows.filter(r => r.status === 'confirmed').length);
  });
});
