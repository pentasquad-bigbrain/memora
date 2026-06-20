import { useState } from 'react'
import { useStore } from '../lib/store'
import { format, isToday, isTomorrow, isPast } from 'date-fns'

const AVATAR_COLORS = ['avatar-blue', 'avatar-green', 'avatar-purple', 'avatar-amber', 'avatar-red']
function initials(name) { return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?' }
function avatarColor(name) { const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length; return AVATAR_COLORS[idx] }

function dueLabel(due) {
  if (!due) return null
  const d = new Date(due)
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`
  return format(d, 'EEE d MMM, h:mm a')
}

export default function Tasks() {
  const { tasks, updateTask } = useStore()
  const [activeTab, setActiveTab] = useState('today')

  const filterTasks = () => {
    if (activeTab === 'today') return tasks.filter(t => t.status !== 'done' && (!t.due_at || isToday(new Date(t.due_at))))
    if (activeTab === 'upcoming') return tasks.filter(t => t.status !== 'done' && t.due_at && !isToday(new Date(t.due_at)) && !isPast(new Date(t.due_at)))
    return tasks.filter(t => t.status === 'done')
  }

  const filtered = filterTasks()

  const handleProgress = async (task, val) => {
    const progress = parseInt(val)
    const status = progress === 100 ? 'done' : progress > 0 ? 'in_progress' : 'todo'
    await updateTask(task.id, { progress, status })
  }

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Tasks</h2>
        <div style={{ display: 'flex', gap: 14 }}>
          <i className="ti ti-search" style={{ fontSize: 20, color: 'var(--muted)', cursor: 'pointer' }}></i>
          <i className="ti ti-adjustments-horizontal" style={{ fontSize: 20, color: 'var(--muted)', cursor: 'pointer' }}></i>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div className="tabs">
          {['today', 'upcoming', 'done'].map(tab => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'today' && tasks.filter(t => t.status !== 'done' && (!t.due_at || isToday(new Date(t.due_at)))).length > 0 &&
                <span style={{ marginLeft: 6, background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                  {tasks.filter(t => t.status !== 'done' && (!t.due_at || isToday(new Date(t.due_at)))).length}
                </span>
              }
            </button>
          ))}
        </div>
      </div>

      <div className="page-scroll" style={{ paddingTop: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
            {activeTab === 'done' ? 'No completed tasks yet.' : 'All clear. Tap + to add a task.'}
          </div>
        ) : filtered.map(task => (
          <div key={task.id} className="card" style={{ marginBottom: 10, opacity: task.status === 'done' ? .6 : 1 }}>
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                <div style={{ fontSize: 11, color: task.due_at && isPast(new Date(task.due_at)) && task.status !== 'done' ? 'var(--red)' : 'var(--muted)', marginTop: 2 }}>
                  {dueLabel(task.due_at) || 'No due date'}
                  {task.project && ` · ${task.project}`}
                </div>
              </div>
              {task.person && (
                <div className="flex-row gap-8" style={{ background: 'var(--bg)', borderRadius: 20, padding: '3px 10px 3px 4px', flexShrink: 0 }}>
                  <div className={`avatar avatar-sm ${avatarColor(task.person?.name)}`}>{initials(task.person?.name)}</div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{task.person?.name?.split(' ')[0]}</span>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="range"
                min="0" max="100" step="5"
                value={task.progress}
                onChange={e => handleProgress(task, e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
            <div className="flex-between" style={{ marginTop: 2 }}>
              <div className="progress-label">{task.progress}%</div>
              {task.status === 'done' && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 500 }}>Done</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
