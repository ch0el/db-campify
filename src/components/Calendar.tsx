import { useMemo, useState } from 'react';
import type { Enrollment } from '../lib/types';
import { campEvents } from '../lib/analytics';
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const localISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function todayISO() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
const parseDate = (iso: string) => new Date(`${iso}T12:00:00`);
export function Calendar({ rows, compact = false, onOpen }: { rows: Enrollment[]; compact?: boolean; onOpen?: () => void }) {
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<'Month' | 'Week' | 'Day'>('Month');
  const date = parseDate(selected);
  const events = useMemo(() => campEvents(rows), [rows]);
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: count }, (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1, 12));
  const weekStart = new Date(date); weekStart.setDate(date.getDate() - date.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const matching = events.filter(e => e.start <= selected && e.end >= selected);
  function move(direction: number) {
    const next = new Date(date);
    if (view === 'Month') { next.setDate(1); next.setMonth(next.getMonth() + direction); }
    else next.setDate(next.getDate() + direction * (view === 'Week' ? 7 : 1));
    setSelected(localISO(next));
  }
  function cell(d: Date) {
    const iso = localISO(d); const isToday = iso === today; const hasCamp = events.some(e => e.start <= iso && e.end >= iso);
    return <button key={iso} className={`date-cell ${iso === selected ? 'selected' : ''} ${iso < today ? 'past' : 'future'}`} aria-label={`${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${hasCamp ? ', camp scheduled' : ''}`} aria-pressed={iso === selected} onClick={() => setSelected(iso)}>
      <img className="date-disc" src={`/figma/32-69-${iso < today ? 'imgDay1Past' : 'imgDay25Upcoming'}.svg`} alt="" />
      {isToday ? <><img className="date-mascot" src="/figma/32-69-imgMascotBaseballPlaceholder.svg" alt="" /><span className="today-label">{d.getDate()}</span></> : <span>{d.getDate()}</span>}
      {hasCamp && <i className="event-dot" />}
    </button>;
  }
  return <section className={`panel calendar-panel ${compact ? 'compact-calendar' : ''}`}>
    <div className="panel-heading"><h2>{compact ? 'Your camp calendar' : 'Calendar'}</h2>{compact ? <button className="text-button" onClick={onOpen}>Open</button> : <div className="segments">{(['Month', 'Week', 'Day'] as const).map(v => <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v}</button>)}</div>}</div>
    <div className="calendar-title"><h3>{date.toLocaleDateString('en-US', { month: 'long', ...(compact ? { day: 'numeric' } : { year: 'numeric' }) })}</h3><div className="calendar-navigation"><button aria-label="Previous period" onClick={() => move(-1)}>‹</button><button aria-label="Next period" onClick={() => move(1)}>›</button></div></div>
    {view !== 'Day' && <><div className="week-labels">{dayNames.map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{view === 'Month' && Array.from({ length: first.getDay() }, (_, i) => <span key={`blank-${i}`} />)}{(view === 'Month' ? days : weekDays).map(cell)}</div></>}
    {!compact && <><div className="calendar-tools"><button className="text-button" onClick={() => setSelected(today)}>Today</button><label>Selected date<input type="date" value={selected} onChange={e => e.target.value && setSelected(e.target.value)} /></label><span>All-day camp dates · Eastern time</span></div><div className="event-list"><h3>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>{matching.length ? matching.map(event => <article key={event.id}><div><strong>{event.name}</strong><p>{event.start} – {event.end} · {event.type}</p></div><b>{event.count} enrolled</b></article>) : <p>No camps scheduled for this day.</p>}</div></>}
    {compact && <div className="calendar-caption">{matching.length ? `${matching.length} camp${matching.length === 1 ? '' : 's'} on this day` : 'Select a day · dots mark camp dates'}</div>}
  </section>;
}
