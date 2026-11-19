import { PasswordRequest, PasswordSetup, InviteStaff, CreateAccount } from './components/AccountAccess';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Calendar } from './components/Calendar';
import { chartColors, CohortChart, Donut, YearChart } from './components/Charts';
import { Upload } from './components/Upload';
import { confirmed, distribution, enrollmentYear, yearStats } from './lib/analytics';
import { demoDataset, isSampleEnrollment } from './lib/demo';
import { clearSampleData, importRows, loadDataset, loadProfile, loadProgram, reportIssue, saveGoal, saveProfile, supabase } from './lib/supabase';
import { featureKeys, type Dataset, type Enrollment, type Feature, type Profile } from './lib/types';

const labels: Record<string, string> = { overview: 'Overview', goals: 'Goals', players: 'New players', demographics: 'Demographics', calendar: 'Calendar', enrollment: 'Enrollment', upload: 'Upload CSV', features: 'Choose features', profile: 'Your profile' };
const descriptions: Record<Feature, string> = { goals: 'Set annual targets and compare one to five years.', players: 'See first-seen and returning players over time.', demographics: 'Explore schools and districts by camp year.', calendar: 'Plan around camp dates in month, week, or day view.', enrollment: 'Track enrollment and referral sources across years.' };
const emptyData: Dataset = { enrollments: [], imports: [], goals: [] };
const defaultProfile: Profile = { display_name: 'Mickey', features: [...featureKeys] };
const errorText = (e: unknown) => e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : 'Something went wrong. Please try again.';
const getPage = () => { const page = window.location.hash.slice(1); return labels[page] ? page : 'overview'; };
function go(page: string) { window.location.hash = page; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}><div className="dialog-header"><h2>{title}</h2><button aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</dialog>;
}

function SignIn({ onDemo, onReset, onCreate }: { onDemo: () => void; onReset: () => void; onCreate: () => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function signIn(e: FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setError('');
    try { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <main className="signin"><section className="signin-story"><a className="wordmark" href="#overview">Campify<span>·</span></a><div><h1>A clearer view <br />of camp.</h1><p>Your players. Your progress. <br />Your next great season.</p></div><span>Duke Baseball Camps</span></section><section className="signin-form"><img className="signin-ball" src="/figma/38-2-imgMascotCenter.svg" alt="Campify baseball" /><h2>Welcome back.</h2><p>Sign in to your camp dashboard.</p><form onSubmit={signIn}><label>Email / staff ID<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@duke.edu" required disabled={!supabase} /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required disabled={!supabase} /></label>{error && <p role="alert" className="error">{error}</p>}<button className="primary" type="submit" disabled={!supabase || busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form><button disabled={!supabase} onClick={onReset}>Forgot your password?</button><button disabled={!supabase} onClick={onCreate}>Create account</button><p className="muted">New accounts require administrator approval for camp access.</p>{!supabase && <p className="inline-notice">Live sign-in will be available after a Supabase project is connected. You can explore the working demo now.</p>}<button className="secondary" onClick={onDemo}>Explore with demo data</button><small>Synthetic players only. Demo changes reset on reload.</small></section></main>;
}

function ProfilePage({ profile, email, onSave, onSignOut }: { profile: Profile; email: string; onSave: (p: Profile) => Promise<void>; onSignOut: () => void }) {
  const [name, setName] = useState(profile.display_name); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  return <section className="panel narrow"><h2>Profile details</h2><form onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(''); try { await onSave({ ...profile, display_name: name.trim() }); setMessage('Profile saved.'); } catch (e) { setMessage(errorText(e)); } finally { setBusy(false); } }}><label>Display name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label>Sign-in email<input value={email} readOnly /></label><p className="muted">Your administrator manages program access and your sign-in email.</p><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button><p role="status">{message}</p></form><button onClick={() => go('features')}>Choose dashboard features</button><button className="text-button signout" onClick={onSignOut}>Sign out</button></section>;
}
function FeaturesPage({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => Promise<void> }) {
  const [chosen, setChosen] = useState(profile.features); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <section className="panel feature-panel"><h2>Make room for what matters.</h2><p>Choose the features you want on your dashboard. You can change these at any time.</p><div className="feature-options">{featureKeys.map(key => <label className="feature-option" key={key}><input type="checkbox" checked={chosen.includes(key)} onChange={e => setChosen(e.target.checked ? [...chosen, key] : chosen.filter(k => k !== key))} /><span><strong>{labels[key]}</strong><span>{descriptions[key]}</span></span></label>)}</div>{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={!chosen.length || busy} onClick={async () => { setBusy(true); try { await onSave({ ...profile, features: chosen }); go('overview'); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }}>{busy ? 'Saving…' : 'Open my dashboard'}</button></section>;
}

function GoalWidget({ data, year, current }: { data: Dataset; year: number; current: number }) {
  const [mode, setMode] = useState(2);
  const best = Math.max(0, ...yearStats(data.enrollments, year - 1, 5).map(r => r.enrollments));
  const target = data.goals.find(g => g.year === year)?.target;
  const values = [current, best, target];
  const titles = ['Where you are', 'Best past year', target ? (target > best ? 'Stretch' : 'Within reach') : 'Set a goal'];
  return <section className="panel goal-widget" data-node-id="42:227"><div className="goal-fixed"><h2>Is it realistic?</h2><h3>{titles[mode]}</h3><p>{mode === 0 ? 'Confirmed enrollments in the selected camp year.' : mode === 1 ? 'Your highest total in the previous five camp years.' : target ? `${Math.max(0, target - current)} more enrollments to reach your target.` : 'Choose an enrollment target for this year.'}</p><img className="dial-ticks" src="/figma/42-227-imgDialTicks.svg" alt="" /><div className="dial-pointer" style={{ transform: `rotate(${Math.min(90, Math.max(-90, (values[mode] ?? 0) / Math.max(target ?? 1, best, current, 1) * 180 - 90))}deg)` }}><img src="/figma/42-227-imgSelector1.svg" alt="" /></div><strong className="dial-value">{values[mode] ?? '—'}</strong><span className="dial-unit">{['Now', 'Best year', 'Goal'][mode]} · enrollments</span><div className="dial-controls"><button disabled={mode === 0} onClick={() => setMode(mode - 1)} aria-label="Previous goal comparison"><img src="/figma/42-227-imgChevron.svg" alt="" /></button><button disabled={mode === 2} onClick={() => setMode(mode + 1)} aria-label="Next goal comparison"><img src="/figma/42-227-imgChevron1.svg" alt="" /></button></div><button className="goal-link" onClick={() => go('goals')}>Manage goals</button></div></section>;
}

function Overview({ data, year, profile }: { data: Dataset; year: number; profile: Profile }) {
  const stats = yearStats(data.enrollments, year, 5); const now = stats[4]; const previous = stats[3];
  const [selected, setSelected] = useState(4); const [span, setSpan] = useState(5);
  const shown = stats.slice(5 - span); const selectedStat = shown[Math.min(selected, shown.length - 1)];
  const rows = data.enrollments.filter(r => enrollmentYear(r) === year);
  const target = data.goals.find(g => g.year === year)?.target;
  const delta = now.enrollments - previous.enrollments;
  const pct = previous.enrollments ? Math.round(delta / previous.enrollments * 100) : null;
  const districts = distribution(rows, 'district');
  const schools = distribution(rows, 'school').filter(r => r.name !== 'Unknown');
  const max = Math.max(1, ...shown.map(s => s.newPlayers));
  const has = (feature: Feature) => profile.features.includes(feature);
  return <div className="overview-layout"><div className="overview-left"><h1 className="greeting">Good morning, {profile.display_name.split(' ')[0] || 'Mickey'}!</h1><div className="overview-top">
    {has('enrollment') && <section className="panel enrollment-widget" data-node-id="32:109"><div className="panel-heading"><h2>Enrollment</h2><span className="change-chip">{delta > 0 ? '+' : ''}{delta} enrolled</span></div><div className="enrollment-value">{pct !== null && pct > 0 && <img src="/figma/32-109-imgArrowUp.svg" alt="Up " />}<strong>{pct === null ? now.enrollments : `${pct}%`}</strong></div><p>{pct === null ? 'confirmed enrollments' : `vs. ${year - 1} camp year`}</p><small>{now.enrollments} now · {previous.enrollments} last year</small><button className="widget-hit" aria-label="View enrollment details" onClick={() => go('enrollment')} /></section>}
    {has('players') && <section className="panel players-widget" data-node-id="31:2"><div className="panel-heading"><h2><button className="heading-button" onClick={() => go('players')}>New players</button></h2><div className="segments"><button className={span === 3 ? 'active' : ''} onClick={() => { setSpan(3); setSelected(2); }}>3 years</button><button className={span === 5 ? 'active' : ''} onClick={() => { setSpan(5); setSelected(4); }}>5 years</button></div></div><div className="player-readout"><strong>{selectedStat.newPlayers}</strong><div><span>new players</span><small>First seen in {selectedStat.year}</small></div></div><div className="year-bars">{shown.map((r, i) => <button key={r.year} aria-label={`${r.year}: ${r.newPlayers} new players`} className={i === selected ? 'chosen' : ''} onClick={() => setSelected(i)}><span className="year-bar" style={{ height: `${r.newPlayers / max * 100}%` }}>{i === selected && <img className="bar-handle-dot" src="/figma/31-2-imgHandleDot.svg" alt="" />}</span><small>{r.year}</small></button>)}</div><input className="year-slider" aria-label="Select new player year" type="range" min={0} max={span - 1} value={Math.min(selected, span - 1)} onChange={e => setSelected(Number(e.target.value))} /></section>}
  </div><div className="overview-bottom">{has('enrollment') && <section className="panel distribution-widget" data-node-id="35:2"><div className="panel-heading"><h2><button className="heading-button" onClick={() => go('enrollment')}>Enrollment distribution</button></h2><span className="period-chip">{year}</span></div><Donut data={distribution(rows, 'referral_source')} total={now.enrollments} target={target} /></section>}{has('goals') && <GoalWidget data={data} year={year} current={now.enrollments} />}</div>{!has('enrollment') && !has('players') && !has('goals') && <section className="panel"><h2>Your dashboard</h2><p>Calendar and demographic features are shown alongside.</p><button onClick={() => go('features')}>Choose features</button></section>}</div>
  <div className="overview-right">{has('calendar') && <Calendar rows={data.enrollments} compact onOpen={() => go('calendar')} />}{has('demographics') && <section className="panel demographics-widget" data-node-id="38:2"><div className="panel-heading"><h2><button className="heading-button" onClick={() => go('demographics')}>Demographics</button></h2><span className="period-chip">{year}</span></div><div className="demographics-summary"><div className="school-orbit"><img src="/figma/38-2-imgMascotCenter.svg" alt="" /><strong>{schools.length}</strong><span>schools represented</span></div><div><strong className="large-number">{now.players}</strong><p>unique players</p><small>Across {districts.filter(d => d.name !== 'Unknown').length} known school districts.</small></div></div><div className="district-bars">{districts.slice(0, 3).map((d, i) => <div key={d.name}><div><span>{d.name}</span><b>{d.count}</b></div><div className="bar-track"><span style={{ width: `${now.enrollments ? d.count / now.enrollments * 100 : 0}%`, background: chartColors[i] }} /></div></div>)}</div><button className="text-button" onClick={() => go('demographics')}>Explore schools and districts</button></section>}</div></div>;
}

function Analytics({ page, data, year, onGoal }: { page: string; data: Dataset; year: number; onGoal: (year: number, target: number) => Promise<void> }) {
  const [span, setSpan] = useState(5); const [field, setField] = useState<'district' | 'school'>('district'); const [search, setSearch] = useState('');
  const stats = yearStats(data.enrollments, year, span);
  const rows = data.enrollments.filter(r => enrollmentYear(r) === year);
  const goal = data.goals.find(g => g.year === year)?.target;
  const [target, setTarget] = useState(String(goal ?? '')); const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { setTarget(String(goal ?? '')); setMessage(''); }, [goal, year]);
  const totals = distribution(rows, field);
  const allNames = [...new Set(stats.flatMap(s => distribution(data.enrollments.filter(r => enrollmentYear(r) === s.year), field).map(r => r.name)))].filter(n => n.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (totals.find(r => r.name === b)?.count ?? 0) - (totals.find(r => r.name === a)?.count ?? 0));
  const average = stats.reduce((sum, r) => sum + r.enrollments, 0) / stats.length;
  return <div className="page-stack"><div className="analytics-toolbar"><p>{page === 'goals' ? 'A clear target for the next season.' : page === 'players' ? 'See who is joining camp for the first time.' : page === 'demographics' ? 'Understand the communities your camps serve.' : 'Understand your enrollment mix and how players found camp.'}</p><label>Time span<select value={span} onChange={e => setSpan(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'year' : 'years'}</option>)}</select></label></div>
    {page === 'goals' && <><section className="panel"><div className="panel-heading"><h2>Enrollment against the average</h2><span>{year - span + 1}–{year}</span></div><YearChart stats={stats} average /><div className="chart-key"><span><i style={{ background: '#c14242' }} />At or above average</span><span><i style={{ background: '#8f887b' }} />Below average</span><span>Average: {average.toFixed(1)} enrollments / year</span></div></section><section className="panel"><h2>Your {year} enrollment goal</h2><form className="goal-form" onSubmit={async e => { e.preventDefault(); setSaving(true); setMessage(''); try { await onGoal(year, Number(target)); setMessage('Goal saved.'); } catch (e) { setMessage(errorText(e)); } finally { setSaving(false); } }}><label>Confirmed enrollments<input type="number" min={1} max={1000000} step={1} required value={target} onChange={e => setTarget(e.target.value)} /></label><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save goal'}</button><p role="status">{message}</p></form><p>{stats.at(-1)!.enrollments} confirmed enrollments so far{goal ? ` · ${Math.round(stats.at(-1)!.enrollments / goal * 100)}% of your ${goal} enrollment goal.` : '. Set a goal to track your progress.'}</p></section></>}
    {page === 'players' && <><section className="panel"><h2>New and returning players</h2><CohortChart stats={stats} /><div className="chart-key"><span><i style={{ background: '#c14242' }} />First seen</span><span><i style={{ background: '#8f887b' }} />Returning</span></div><p className="muted">A new player is a unique Participant ID first seen in a confirmed enrollment, grouped by camp start year. This uses all imported history, including years outside this chart. The earliest imported year may include existing players.</p></section><section className="panel"><h2>Players by camp year</h2><StatsTable stats={stats} players /></section></>}
    {page === 'demographics' && <section className="panel"><div className="panel-heading"><h2>Where players come from</h2><div className="segments"><button className={field === 'district' ? 'active' : ''} onClick={() => setField('district')}>Districts</button><button className={field === 'school' ? 'active' : ''} onClick={() => setField('school')}>Schools</button></div></div><label className="search-field">Search {field === 'school' ? 'schools' : 'districts'}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Find a ${field}…`} /></label><div className="table-scroll"><table><thead><tr><th>{field === 'school' ? 'School' : 'District'}</th>{stats.map(s => <th className="number" key={s.year}>{s.year}</th>)}</tr></thead><tbody>{allNames.map(name => <tr key={name}><td>{name}</td>{stats.map(s => <td className="number" key={s.year}>{distribution(data.enrollments.filter(r => enrollmentYear(r) === s.year), field).find(r => r.name === name)?.count ?? 0}</td>)}</tr>)}</tbody></table></div>{!allNames.length && <p>No matching {field === 'school' ? 'schools' : 'districts'} in this range.</p>}<p className="muted">Counts are confirmed enrollments, not unique players. School and district values are captured with each enrollment, preserving year-specific demographics. Missing values remain Unknown.</p></section>}
    {page === 'enrollment' && <><section className="panel"><h2>Enrollments over time</h2><YearChart stats={stats} /><StatsTable stats={stats} /></section><div className="two-panels"><section className="panel"><h2>Referral sources · {year}</h2><Donut data={distribution(rows, 'referral_source')} total={confirmed(rows).length} target={goal} /><p className="muted">Referral sources are self-reported CSV values, not measured advertising reach.</p></section><section className="panel"><h2>Camp mix · {year}</h2><div className="table-scroll"><table><thead><tr><th>Camp type</th><th className="number">Enrollments</th><th className="number">Share</th></tr></thead><tbody>{distribution(rows, 'camp_type').map(r => <tr key={r.name}><td>{r.name}</td><td className="number">{r.count}</td><td className="number">{Math.round(r.count / Math.max(1, confirmed(rows).length) * 100)}%</td></tr>)}</tbody></table></div><p className="muted">Cancelled and waitlisted registrations are excluded from all enrollment and player metrics.</p><p>{rows.filter(r => r.status === 'cancelled').length} cancelled · {rows.filter(r => r.status === 'waitlisted').length} waitlisted</p></section></div></>}
  </div>;
}
function StatsTable({ stats, players = false }: { stats: ReturnType<typeof yearStats>; players?: boolean }) {
  return <div className="table-scroll"><table><thead><tr><th>Camp year</th><th className="number">{players ? 'Unique players' : 'Enrollments'}</th><th className="number">{players ? 'First seen' : 'Amount paid'}</th>{players && <th className="number">Returning</th>}</tr></thead><tbody>{stats.map(s => <tr key={s.year}><td>{s.year}</td><td className="number">{players ? s.players : s.enrollments}</td><td className="number">{players ? s.newPlayers : s.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>{players && <td className="number">{s.returning}</td>}</tr>)}</tbody></table></div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null); const [demo, setDemo] = useState(false); const [authReady, setAuthReady] = useState(!supabase);
  const [accountMode, setAccountMode] = useState(() => new URLSearchParams(window.location.search).get('account') === 'setup' || /(?:^|[&#])type=(invite|recovery)(?:&|$)/.test(window.location.hash) ? 'setup' : '');
  const [canInvite,setCanInvite] = useState(false);
  const demoImportRows = useRef(new Map<string, string[]>());
  const [data, setData] = useState<Dataset>(emptyData); const [profile, setProfile] = useState<Profile>(defaultProfile); const [program, setProgram] = useState('');
  const currentYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(new Date()));
  const [page, setPage] = useState(getPage); const [year, setYear] = useState(currentYear); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [updated, setUpdated] = useState('');
  const demoReports = useRef<{ description: string; page: string }[]>([]);
  const [issueOpen, setIssueOpen] = useState(false); const [issue, setIssue] = useState(''); const [issueBusy, setIssueBusy] = useState(false); const [issueMessage, setIssueMessage] = useState('');
  useEffect(() => { const onHash = () => setPage(getPage()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => { if (active) { if (error) setError(error.message); setUser(data.session?.user ?? null); setAuthReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (_event === 'PASSWORD_RECOVERY') setAccountMode('setup'); setUser(session?.user ?? null); setAuthReady(true); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  async function refresh() {
    if (demo) { setUpdated(new Date().toISOString()); return; }
    if (!user) return;
    setLoading(true); setError('');
    try { const id = await loadProgram(); setProgram(id); const [next, saved] = await Promise.all([loadDataset(id), loadProfile(user.id)]); setData(next); setProfile(saved ?? { ...defaultProfile, display_name: user.email?.split('@')[0] ?? 'Coach' }); setUpdated(new Date().toISOString()); if (!saved && !accountMode) go('features'); const {data: admin}=await supabase!.from('program_admins').select('user_id').eq('program_id',id).eq('user_id',user.id).maybeSingle(); setCanInvite(!!admin); }
    catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }
  useEffect(() => { if (user && !demo) void refresh(); else if (!demo) { setData(emptyData); setProgram(''); } }, [user?.id, demo]);
  const years = useMemo(() => [...new Set([currentYear, currentYear + 1, ...data.enrollments.map(enrollmentYear), ...data.goals.map(g => g.year)])].sort((a, b) => b - a), [data, currentYear]);
  async function persistProfile(p: Profile) { if (!demo && user) await saveProfile(user.id, p); setProfile(p); }
  async function persistGoal(goalYear: number, target: number) { if (!Number.isInteger(target) || target < 1 || target > 1000000) throw new Error('Enter a whole number from 1 to 1,000,000.'); if (!demo) await saveGoal(program, { year: goalYear, target }); setData(prev => ({ ...prev, goals: [...prev.goals.filter(g => g.year !== goalYear), { year: goalYear, target }] })); }
  async function importFile(name: string, hash: string, rows: Enrollment[]) {
    if (demo) {
      if (data.imports.some(i => i.file_hash === hash)) return 'This exact file was already imported. No rows changed.';
      const merged = new Map(data.enrollments.map(r => [r.registration_id, r]));
      for (const row of rows) { const old = merged.get(row.registration_id); if (old && (old.participant_id !== row.participant_id || old.camp_id !== row.camp_id)) throw new Error(`Registration ${row.registration_id} belongs to another player or camp.`); merged.set(row.registration_id, row); }
      // Mirror the normalized backend: latest camp/player details apply to all their registrations.
      const camps = new Map(rows.map(r => [r.camp_id, r])); const players = new Map(rows.map(r => [r.participant_id, r.participant_name]));
      const enrollments = [...merged.values()].map(r => { const camp = camps.get(r.camp_id); return { ...r, ...(camp ? { camp_name: camp.camp_name, camp_type: camp.camp_type, starts_on: camp.starts_on, ends_on: camp.ends_on } : {}), participant_name: players.get(r.participant_id) ?? r.participant_name }; });
      demoImportRows.current.set(hash, rows.map(r => r.registration_id));
      setData({ ...data, enrollments, imports: [{ id: crypto.randomUUID(), file_hash: hash, file_name: name, imported_at: new Date().toISOString(), row_count: rows.length }, ...data.imports] });
      setUpdated(new Date().toISOString());
      return `${rows.length} enrollments processed in this demo session. Repeated IDs were updated.`;
    }
    const result = await importRows(program, name, hash, rows);
    await refresh();
    return result.duplicate ? 'This exact file was already imported. No rows changed.' : `${result.row_count} enrollments saved to Supabase.`;
  }
  async function clearSamples() {
    if (demo) {
      const removed = data.enrollments.filter(isSampleEnrollment).length;
      setData(prev => {
        const enrollments = prev.enrollments.filter(r => !isSampleEnrollment(r));
        const remaining = new Set(enrollments.map(r => r.registration_id));
        const imports = prev.imports.filter(i => {
          const ids = demoImportRows.current.get(i.file_hash);
          return !ids || ids.some(id => remaining.has(id));
        });
        return { ...prev, enrollments, imports };
      });
      setUpdated(new Date().toISOString());
      return removed;
    }
    const result = await clearSampleData(program);
    const next = await loadDataset(program);
    setData(next);
    setUpdated(new Date().toISOString());
    return result.removed;
  }
  async function signOut() { try { if (!demo && supabase) { const { error } = await supabase.auth.signOut(); if (error) throw error; } setDemo(false); setUser(null); setData(emptyData); setProfile(defaultProfile); setError(''); go('overview'); } catch (e) { setError(errorText(e)); } }
  if (!authReady) return <div className="boot" role="status"><h1>Campify</h1><p>Checking your session…</p></div>;
  const finishAccount = () => { const url = new URL(window.location.href); url.search = ''; url.hash = ''; window.history.replaceState(null, '', url); setAccountMode(''); go('overview'); };
  if (accountMode === 'create') return <CreateAccount onBack={finishAccount} />;
  if (accountMode === 'reset') return <PasswordRequest onBack={finishAccount} />;
  if (accountMode === 'setup') return <PasswordSetup ready={!!user} onDone={finishAccount} />;
  if (!user && !demo) return <SignIn onCreate={() => setAccountMode('create')} onReset={() => setAccountMode('reset')} onDemo={() => { setDemo(true); setData(demoDataset()); setProfile(defaultProfile); setUpdated(new Date().toISOString()); go('features'); }} />;
  return <div className="app"><header className="app-header"><a className="wordmark" href="#overview">Campify<span>·</span></a><span className="workspace-name">Duke Baseball Camps</span><nav aria-label="Main navigation"><a className={page === 'overview' ? 'active' : ''} href="#overview">Overview</a>{profile.features.map(key => <a key={key} className={page === key ? 'active' : ''} href={`#${key}`}>{labels[key]}</a>)}</nav><div className="header-actions"><a className="upload-link" href="#upload">Upload CSV</a><button className="avatar" aria-label="Open your profile" onClick={() => go('profile')}>{profile.display_name.slice(0, 1).toUpperCase()}</button></div></header>
    <div className="status-bar"><span>{demo ? 'Demo workspace · synthetic data · changes reset on reload' : 'Private workspace · Supabase connected'}</span><div><button className="text-button" onClick={() => go('features')}>Choose features</button><button className="text-button" disabled={loading} onClick={refresh}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
    <main className="main-content" id="main"><div className="page-tools">{page !== 'overview' ? <h1>{labels[page]}</h1> : <span className="scope-label">Your season, at a glance.</span>}{['overview', 'goals', 'players', 'demographics', 'enrollment'].includes(page) && <label className="year-picker">Camp year<select value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y}>{y}</option>)}</select></label>}</div>
      {error && <div className="error" role="alert"><p>{error}</p><button onClick={refresh}>Retry loading</button></div>}
      {loading && !updated ? <div className="loading-layout" role="status" aria-live="polite"><h2>Loading your camp data…</h2><div /><div /><div /></div> : <>
        {!data.enrollments.length && !['upload', 'profile', 'features'].includes(page) && <div className="empty-notice"><div><strong>Your next season starts here.</strong><p>Upload your first CSV to populate your dashboard.</p></div><button className="primary" onClick={() => go('upload')}>Upload CSV</button></div>}
        {page === 'overview' && <Overview data={data} year={year} profile={profile} />}
        {['goals', 'players', 'demographics', 'enrollment'].includes(page) && <Analytics key={page} page={page} data={data} year={year} onGoal={persistGoal} />}
        {page === 'calendar' && <Calendar rows={data.enrollments} />}
        {page === 'profile' && canInvite && !demo && <InviteStaff programId={program} />}
        {page === 'upload' && <Upload imports={data.imports} onImport={importFile} demo={demo} sampleCount={data.enrollments.filter(isSampleEnrollment).length} onClearSamples={clearSamples} />}
        {page === 'features' && <FeaturesPage profile={profile} onSave={persistProfile} />}
        {page === 'profile' && <ProfilePage profile={profile} email={demo ? 'mickey@example.test (demo)' : user?.email ?? ''} onSave={persistProfile} onSignOut={signOut} />}
      </>}
    </main><footer><span>Campify · {updated ? `Updated ${new Date(updated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET` : 'Awaiting data'}</span><button className="text-button" onClick={() => { setIssueOpen(true); setIssueMessage(''); }}>Report an issue</button></footer>
    {issueOpen && <Modal title="Report an issue" onClose={() => { if (!issueBusy) setIssueOpen(false); }}><p>Tell us what happened on the {labels[page].toLowerCase()} page.</p><form onSubmit={async e => { e.preventDefault(); setIssueBusy(true); setIssueMessage(''); try { if (!demo) await reportIssue(program, issue.trim(), page); else demoReports.current.push({ description: issue.trim(), page }); setIssueMessage(demo ? 'Demo report recorded for this session only. It has not been sent to a support team.' : 'Issue saved. Your program administrator can review it.'); setIssue(''); } catch (e) { setIssueMessage(errorText(e)); } finally { setIssueBusy(false); } }}><label>Description<textarea required minLength={10} maxLength={5000} rows={5} value={issue} onChange={e => setIssue(e.target.value)} placeholder="Describe the issue and what you expected to happen…" /></label><button className="primary" disabled={issueBusy || issue.trim().length < 10}>{issueBusy ? 'Saving…' : 'Save issue report'}</button><p role="status">{issueMessage}</p></form></Modal>}
  </div>;
}
