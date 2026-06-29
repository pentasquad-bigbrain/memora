import { useMemo, useState } from 'react'
import { format, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isToday } from 'date-fns'
import { useStore } from '../lib/store'
import { PRIORITY_META } from './Tasks'

export default function Calendar() {
  const { tasks } = useStore()
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState(new Date())

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    const list = []
    for (let day = start; day <= end; day = addDays(day, 1)) list.push(day)
    return list
  }, [cursor])

  const tasksForDate = (date) => tasks.filter((task) => task.due_at && isSameDay(new Date(task.due_at), date))
  const selectedTasks = tasksForDate(selected).sort((a, b) => new Date(a.due_at) - new Date(b.due_at))

  return (
    <div className="page">
      <div style={{ padding:'max(14px,env(safe-area-inset-top)) 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:700 }}>Calendar</h2>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>Tasks by date</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>setCursor(subMonths(cursor, 1))} style={iconButtonStyle} title="Previous month"><i className="ti ti-chevron-left" /></button>
          <button onClick={()=>{ const now = new Date(); setCursor(now); setSelected(now) }} style={iconButtonStyle} title="Today"><i className="ti ti-calendar-dot" /></button>
          <button onClick={()=>setCursor(addMonths(cursor, 1))} style={iconButtonStyle} title="Next month"><i className="ti ti-chevron-right" /></button>
        </div>
      </div>

      <div className="page-scroll" style={{ paddingTop:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontSize:18, fontWeight:700 }}>{format(cursor, 'MMMM yyyy')}</div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>{tasks.filter(t => t.due_at && isSameMonth(new Date(t.due_at), cursor)).length} tasks</div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6, marginBottom:8 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
            <div key={day} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'var(--muted)' }}>{day}</div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6, marginBottom:18 }}>
          {days.map(day => {
            const count = tasksForDate(day).length
            const active = isSameDay(day, selected)
            const muted = !isSameMonth(day, cursor)
            return (
              <button
                key={day.toISOString()}
                onClick={()=>setSelected(day)}
                style={{
                  minHeight:52,
                  borderRadius:'var(--r-sm)',
                  border:'1.5px solid',
                  borderColor:active?'var(--accent)':isToday(day)?'var(--accent-mid)':'var(--border)',
                  background:active?'var(--accent)':isToday(day)?'var(--accent-soft)':'var(--bg)',
                  color:active?'#fff':muted?'var(--hint)':'var(--text)',
                  cursor:'pointer',
                  fontFamily:'inherit',
                  display:'flex',
                  flexDirection:'column',
                  alignItems:'center',
                  justifyContent:'center',
                  gap:4
                }}
              >
                <span style={{ fontSize:13, fontWeight:700 }}>{format(day, 'd')}</span>
                <span style={{ width:count ? 18 : 4, height:4, borderRadius:999, background:count ? (active ? '#fff' : 'var(--accent)') : 'transparent', opacity:count ? 1 : 0 }}>
                  {count > 1 && <span style={{ display:'block', fontSize:8, lineHeight:'4px', color:active?'var(--accent)':'#fff' }}>{count}</span>}
                </span>
              </button>
            )
          })}
        </div>

        <div className="section-label">{format(selected, 'EEEE, d MMMM')}</div>
        {selectedTasks.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--muted)', padding:'36px 20px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)' }}>
            <i className="ti ti-calendar-off" style={{ fontSize:30, color:'var(--hint)' }} />
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginTop:10 }}>No tasks on this date</div>
          </div>
        ) : selectedTasks.map(task => {
          const priority = task.priority && PRIORITY_META[task.priority]
          return (
            <div key={task.id} className="card" style={{ marginBottom:10, borderLeft:priority ? `3px solid ${priority.color}` : '1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <i className={`ti ${task.status === 'done' ? 'ti-circle-check' : 'ti-circle'}`} style={{ fontSize:18, color:task.status === 'done' ? 'var(--green)' : priority?.color || 'var(--accent)', marginTop:1 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, textDecoration:task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{format(new Date(task.due_at), 'h:mm a')}</div>
                </div>
                {priority && <span style={{ fontSize:11, fontWeight:700, background:priority.bg, color:priority.color, padding:'3px 9px', borderRadius:12 }}>{priority.label}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const iconButtonStyle = {
  width:36,
  height:36,
  borderRadius:'50%',
  border:'1px solid var(--border)',
  background:'var(--bg)',
  color:'var(--muted)',
  cursor:'pointer',
  display:'flex',
  alignItems:'center',
  justifyContent:'center',
  fontSize:17
}
