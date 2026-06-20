import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { generateNudges } from '../lib/groq'
import { format } from 'date-fns'

const AVATAR_COLORS = ['avatar-blue', 'avatar-green', 'avatar-purple', 'avatar-amber', 'avatar-red']
function initials(name) { return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?' }
function avatarColor(name) { const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length; return AVATAR_COLORS[idx] }

const NUDGE_ICONS = {
  followup: 'ti-user',
  stuck_task: 'ti-clock',
  expense_alert: 'ti-currency-rupee',
  idea_prompt: 'ti-bulb',
  general: 'ti-sparkles'
}

export default function Home() {
  const navigate = useNavigate()
  const {
    user, spaces, activeSpace, setActiveSpace,
    tasks, ideas, people, expenses, nudges,
    dismissNudge, addNudges
  } = useStore()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const todayTasks = tasks.filter(t => {
    if (t.status === 'done') return false
    if (!t.due_at) return true
    const due = new Date(t.due_at)
    const today = new Date()
    return due.toDateString() === today.toDateString()
  }).slice(0, 3)

  const upcomingTasks = tasks.filter(t => {
    if (t.status === 'done' || !t.due_at) return false
    const due = new Date(t.due_at)
    const today = new Date()
    return due > today && due.toDateString() !== today.toDateString()
  }).slice(0, 3)

  const weekExpenses = expenses.filter(e => {
    const d = new Date(e.date)
    const now = new Date()
    return (now - d) / (1000 * 60 * 60 * 24) <= 7
  }).reduce((s, e) => s + Number(e.amount), 0)

  // Generate nudges if none exist
  useEffect(() => {
    if (nudges.length === 0 && tasks.length > 0) {
      generateNudges({ tasks: tasks.slice(0, 5), people: people.slice(0, 3), expenses: expenses.slice(0, 5), ideas: ideas.slice(0, 3) })
        .then(addNudges)
        .catch(() => {})
    }
  }, [tasks.length])

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>{greeting}, {firstName}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {todayTasks.length} tasks today · {format(new Date(), 'EEE, d MMM')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <i className="ti ti-bell" style={{ fontSize: 22, color: 'var(--muted)', cursor: 'pointer' }}></i>
          <div className={`avatar avatar-md ${avatarColor(firstName)}`}>{initials(user?.user_metadata?.full_name || firstName)}</div>
        </div>
      </div>

      {/* Space selector */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {spaces.map(sp => (
          <button key={sp.id} className={`pill ${activeSpace?.id === sp.id ? 'active' : ''}`} onClick={() => setActiveSpace(sp)}>
            {sp.name}
          </button>
        ))}
        <button className="pill" onClick={() => {/* add space modal */}}>+ Space</button>
      </div>

      <div className="page-scroll">
        {/* Today's focus */}
        <div className="section-row">
          <div className="section-label">Today's focus</div>
          <button className="see-all" onClick={() => navigate('/tasks')}>See all</button>
        </div>

        {todayTasks.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: 13 }}>
            No tasks for today. Tap + to capture one.
          </div>
        ) : todayTasks.map(task => (
          <div key={task.id} className="card" style={{ marginBottom: 8 }}>
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{task.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {task.due_at ? format(new Date(task.due_at), 'h:mm a') : 'No time set'}
                </div>
              </div>
              {task.person && (
                <div className="flex-row gap-8" style={{ background: 'var(--bg)', borderRadius: 20, padding: '3px 10px 3px 4px' }}>
                  <div className={`avatar avatar-sm ${avatarColor(task.person.name)}`}>{initials(task.person.name)}</div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{task.person.name.split(' ')[0]}</span>
                </div>
              )}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${task.progress}%` }}></div>
            </div>
            <div className="progress-label">{task.progress}%</div>
          </div>
        ))}

        {/* Nudges */}
        {nudges.length > 0 && (
          <>
            <div className="section-label">Smart nudges</div>
            {nudges.map(n => (
              <div key={n.id} className="nudge">
                <i className={`ti ${NUDGE_ICONS[n.type] || 'ti-sparkles'} nudge-icon`} aria-hidden="true"></i>
                <div className="nudge-text">{n.message}</div>
                <button className="nudge-close" onClick={() => dismissNudge(n.id)} aria-label="Dismiss">
                  <i className="ti ti-x"></i>
                </button>
              </div>
            ))}
          </>
        )}

        {/* Stats grid */}
        <div className="section-label">Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: 'ti-checkbox', color: 'var(--accent)', val: tasks.filter(t => t.status !== 'done').length, label: 'Tasks', sub: `${tasks.filter(t => t.status === 'in_progress').length} in progress` },
            { icon: 'ti-bulb', color: 'var(--purple)', val: ideas.length, label: 'Ideas', sub: `${ideas.filter(i => i.status === 'raw').length} new` },
            { icon: 'ti-users', color: 'var(--green)', val: people.length, label: 'People', sub: 'auto-tagged' },
            { icon: 'ti-currency-rupee', color: 'var(--amber)', val: `₹${Math.round(weekExpenses).toLocaleString('en-IN')}`, label: 'This week', sub: `${expenses.length} expenses` }
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
              <i className={`ti ${s.icon}`} style={{ fontSize: 18, color: s.color }}></i>
              <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', marginTop: 6 }}>{s.val}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'var(--hint)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Upcoming */}
        {upcomingTasks.length > 0 && (
          <>
            <div className="section-row">
              <div className="section-label">Upcoming</div>
              <button className="see-all" onClick={() => navigate('/tasks')}>See all</button>
            </div>
            <div className="card" style={{ padding: '4px 16px' }}>
              {upcomingTasks.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < upcomingTasks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.due_at ? format(new Date(t.due_at), 'EEE, d MMM · h:mm a') : 'No date'}</div>
                  </div>
                  {t.person && <div className={`avatar avatar-sm ${avatarColor(t.person.name)}`}>{initials(t.person.name)}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
