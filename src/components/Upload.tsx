import { useMemo, useState } from 'react';
import { columns, hashFile, parseCSV, suggestMapping, toCSV, validateRows, type Mapping, type ParsedCSV } from '../lib/csv';
import type { Enrollment, ImportRecord } from '../lib/types';
import { demoDataset } from '../lib/demo';
export function downloadSample() {
  const url = URL.createObjectURL(new Blob([toCSV(demoDataset().enrollments.slice(0, 12))], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'campify-placeholder-sample.csv'; a.click(); URL.revokeObjectURL(url);
}
export function Upload({ imports, onImport, demo }: { imports: ImportRecord[]; onImport: (name: string, hash: string, rows: Enrollment[]) => Promise<string>; demo: boolean }) {
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<Mapping>({} as Mapping);
  const [file, setFile] = useState({ name: '', text: '' });
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const validated = useMemo(() => parsed ? validateRows(parsed, mapping) : null, [parsed, mapping]);
  async function read(file?: File) {
    if (!file) return;
    setError(''); setMessage(''); setParsed(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a CSV smaller than 5 MB.');
      const text = await file.text(); const next = parseCSV(text);
      setFile({ name: file.name, text }); setParsed(next); setMapping(suggestMapping(next.headers));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read file.'); }
  }
  async function submit() {
    if (!validated || validated.errors.length || busy) return;
    setBusy(true); setError('');
    try { const result = await onImport(file.name, await hashFile(file.text), validated.enrollments); setMessage(result); setParsed(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Import failed. Please retry.'); }
    finally { setBusy(false); }
  }
  return <div className="page-stack"><section className="panel"><div className="panel-heading"><h2>Upload your enrollment export</h2><button onClick={downloadSample}>Download sample CSV</button></div><p>Choose your Teamworks Camps export, match the columns, and review the data before importing.</p><p className="muted">Placeholder columns are in use until a real Teamworks export is available. Up to 5 MB and 5,000 enrollments per file.</p>
    {demo && <p className="inline-notice">Demo imports stay in memory and reset when this page reloads. Use synthetic data here.</p>}
    <label className="file-drop"><span className="file-symbol">CSV</span><strong>Choose a CSV file</strong><span>Registration, participant, camp, dates, and demographic data</span><input type="file" accept=".csv,text/csv" aria-label="Choose CSV file" disabled={busy} onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} /></label>
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
  </section>
  {parsed && <section className="panel"><h2>Match columns</h2><p>{file.name} · {parsed.rows.length.toLocaleString()} rows. Fields marked * are required.</p><div className="mapping-grid">{columns.map(([key, label, required]) => <label key={key}>{label}{required ? ' *' : ''}<select disabled={busy} value={mapping[key]} onChange={e => { setMapping({ ...mapping, [key]: e.target.value }); setMessage(''); }}><option value="">{required ? 'Choose a column' : 'Not provided'}</option>{parsed.headers.map(h => <option key={h}>{h}</option>)}</select></label>)}</div><p className="muted">Dates: YYYY-MM-DD or M/D/YYYY. Amount Paid: dollars. Missing status defaults to confirmed; missing demographics and source become Unknown. Stable IDs are required to match repeat players and prevent duplicate enrollments.</p>
    {validated?.errors.length ? <div className="error" role="alert"><strong>Fix these issues before importing</strong><ul>{validated.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul>{validated.errors.length > 8 && <p>And {validated.errors.length - 8} more issues.</p>}</div> : <><h3>Preview · first 5 enrollments</h3><div className="table-scroll"><table><thead><tr><th>Registration</th><th>Player</th><th>Camp</th><th>Start date</th><th>School</th><th>Status</th></tr></thead><tbody>{validated?.enrollments.slice(0, 5).map(row => <tr key={row.registration_id}><td>{row.registration_id}</td><td>{row.participant_name}</td><td>{row.camp_name}</td><td>{row.starts_on}</td><td>{row.school}</td><td>{row.status}</td></tr>)}</tbody></table></div></>}
    <div className="form-actions"><button disabled={busy} onClick={() => setParsed(null)}>Cancel</button><button className="primary" disabled={busy || !!validated?.errors.length} onClick={submit}>{busy ? 'Importing…' : `Import ${parsed.rows.length.toLocaleString()} enrollments`}</button></div><p className="muted">Matching registration IDs update existing rows. The same file cannot be imported twice. Rows omitted from a later export are retained.</p>
  </section>}
  <section className="panel"><h2>Import history</h2>{imports.length ? <div className="table-scroll"><table><thead><tr><th>File</th><th>Imported</th><th className="number">Rows processed</th></tr></thead><tbody>{imports.map(row => <tr key={row.id}><td>{row.file_name}</td><td>{new Date(row.imported_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td><td className="number">{row.row_count}</td></tr>)}</tbody></table></div> : <p>No CSV imports yet. Start with the sample file above.</p>}</section></div>;
}
