import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie } from 'recharts';
import type { yearStats } from '../lib/analytics';
export const chartColors = ['#c14242', '#8f887b', '#121212', '#f5f2ec'];
type Stats = ReturnType<typeof yearStats>;
export function YearChart({ stats, metric = 'enrollments', average = false }: { stats: Stats; metric?: 'enrollments' | 'newPlayers'; average?: boolean }) {
  const mean = stats.length ? stats.reduce((sum, row) => sum + row[metric], 0) / stats.length : 0;
  return <div className="chart" role="img" aria-label={`${metric === 'enrollments' ? 'Enrollments' : 'New players'} by year. ${stats.map(r => `${r.year}: ${r[metric]}`).join(', ')}${average ? `. Average ${mean.toFixed(1)}.` : ''}`}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={stats} margin={{ top: 24, right: 34, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="#bdb6aa" strokeDasharray="3 5" />
        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#5c574f', fontSize: 13 }} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#5c574f', fontSize: 13 }} width={40} />
        <Tooltip contentStyle={{ borderRadius: 14, background: '#f5f2ec', border: 'none' }} />
        {average && <ReferenceLine y={mean} stroke="#121212" strokeDasharray="5 5" label={{ value: `Avg ${mean.toFixed(1)}`, fill: '#121212', fontSize: 12, position: 'insideTopLeft' }} />}
        <Line name={metric === 'enrollments' ? 'Enrollments' : 'New players'} type="linear" dataKey={metric} stroke="#c14242" strokeWidth={3} isAnimationActive={false} dot={(p: any) => <circle key={p.index} cx={p.cx} cy={p.cy} r={6} fill={average && p.value < mean ? '#8f887b' : '#c14242'} stroke="#eeebe6" strokeWidth={2} />} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
export function CohortChart({ stats }: { stats: Stats }) {
  return <div className="chart" role="img" aria-label={`New and returning players by year. ${stats.map(r => `${r.year}: ${r.newPlayers} new, ${r.returning} returning`).join('. ')}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={stats} margin={{ right: 20 }}>
    <CartesianGrid vertical={false} stroke="#bdb6aa" strokeDasharray="3 5" /><XAxis dataKey="year" axisLine={false} tickLine={false} /><YAxis width={40} allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip />
    <Bar dataKey="newPlayers" name="New players" stackId="players" fill="#c14242" isAnimationActive={false} /><Bar dataKey="returning" name="Returning players" stackId="players" fill="#8f887b" radius={[6, 6, 0, 0]} isAnimationActive={false} />
  </BarChart></ResponsiveContainer></div>;
}
export function Donut({ data, total, target }: { data: { name: string; count: number }[]; total: number; target?: number }) {
  const top = data.slice(0, data.length > 4 ? 3 : 4);
  if (data.length > 4) top.push({ name: 'Other', count: data.slice(3).reduce((sum, row) => sum + row.count, 0) });
  const gap = target ? Math.max(0, target - total) : 0;
  const slices = [...top, ...(gap ? [{ name: 'To goal', count: gap }] : [])];
  if (!slices.length) slices.push({ name: 'No enrollments', count: 1 });
  return <div className="donut-layout"><div className="donut-graphic" role="img" aria-label={data.length ? data.map(r => `${r.name}: ${r.count}`).join(', ') : 'No enrollments'}>
    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={slices} dataKey="count" nameKey="name" innerRadius="68%" outerRadius="94%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>{slices.map((row, i) => <Cell key={row.name} fill={row.name === 'To goal' || !total ? '#bdb6aa' : chartColors[i % 4]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
    <div className="donut-center"><span className="mono">Enrolled</span><div><strong>{total}</strong>{target ? <span>/{target}</span> : null}</div><small>{target ? `${Math.round(total / target * 100)}% of goal` : 'confirmed enrollments'}</small></div>
  </div><div className="legend">{top.map((row, i) => <div className="legend-row" key={row.name}><i style={{ background: chartColors[i] }} /><span>{row.name}</span><b>{row.count}</b></div>)}{gap > 0 && <div className="legend-row"><i style={{ background: '#bdb6aa' }} /><span>To goal</span><b>{gap}</b></div>}{target ? <><div className="legend-rule" /><div className="legend-row"><i style={{ background: '#121212' }} /><span>Year goal</span><b>{target}</b></div><small>{gap ? `${gap} more to reach the goal` : 'Enrollment goal reached'}</small></> : null}</div></div>;
}
