import { useState, useMemo } from 'react'
import { useStore } from '../lib/store'
import { parseTaskQuick } from '../lib/groq'
import { format, isToday, isTomorrow, isPast, isFuture } from 'date-fns'

const AVATAR_COLORS = ['avatar-blue','avatar-green','avatar-purple','avatar-amber','avatar-red']
function initials(name) { return name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?' }
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0)||0)%AVATAR_COLORS.length] }

function dueLabel(due) {
  if (!due) return null
  const d = new Date(due)
  if (isPast(d) && !isToday(d)) return { text: `Overdue · ${format(d,'d MMM')}`, red: true }
  if (isToday(d))    return { text: `Today · ${format(d,'h:mm a')}`, red: false }
  if (isTomorrow(d)) return { text: `Tomorrow · ${format(d,'h:mm a')}`, red: false }
  return { text: format(d,'EEE d MMM · h:mm a'), red: false }
}

// ── Quick-add with AI parse ───────────────────────────────────
function QuickAdd({ onAdd, onFindPerson }) {
  const [title,    setTitle]    = useState('')
  const [due,      setDue]      = useState('')
  const [expanded, setExpanded] = useState(false)
  const [parsing,  setParsing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [parsed,   setParsed]   = useState(null)   // AI preview before confirm

  const runAIParse = async (text) => {
    if (!text.trim()) return
    setParsing(true)
    const result = await parseTaskQuick(text)
    setParsed(result)
    if (result.due) setDue(new Date(result.due).toISOString().slice(0,16))
    setParsing(false)
  }

  const submit = async (titleOverride) => {
    const finalTitle = (titleOverride ?? parsed?.title ?? title).trim()
    if (!finalTitle) return
    setSaving(true)
    let person_id = null
    if (parsed?.person && onFindPerson) {
      const p = await onFindPerson(parsed.person)
      if (p) person_id = p.id
    }
    await onAdd({ title: finalTitle, due_at: due || null, status: 'todo', progress: 0, source: 'manual', person_id })
    setTitle(''); setDue(''); setExpanded(false); setSaving(false); setParsed(null)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (parsed) submit()
      else runAIParse(title)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder="Quick add… (Enter to AI-parse, then Enter to save)"
          value={title}
          onChange={e => { setTitle(e.target.value); setParsed(null) }}
          onKeyDown={handleKey}
          style={{ flex: 1, fontSize: 13, border: 'none', background: 'transparent', padding: '2px 0' }}
          disabled={saving || parsing}
        />
        <button
          onClick={() => setExpanded(s => !s)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: expanded || due ? 'var(--accent)' : 'var(--hint)' }}
          title="Set due date"
        >
          <i className="ti ti-calendar" style={{ fontSize: 16 }} />
        </button>
        {!parsed ? (
          <button
            onClick={() => runAIParse(title)}
            disabled={!title.trim() || parsing || saving}
            style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0, borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}
            title="AI parse"
          >
            {parsing
              ? <div className="spinner" style={{ width: 12, height: 12 }} />
              : <i className="ti ti-sparkles" style={{ fontSize: 14 }} />}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => submit()} disabled={saving} style={{ padding: '6px 14px', fontSize: 13, flexShrink: 0 }}>
            {saving ? <div className="spinner" style={{ width: 12, height: 12, borderTopColor: '#fff' }} /> : 'Add'}
          </button>
        )}
      </div>

      {/* AI parse preview */}
      {parsed && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--accent-soft)', borderRadius: 'var(--r-sm)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <i className="ti ti-sparkles" style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{parsed.title}</div>
            <div style={{ fontSize: 11, color: 'var(--accent-dark)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {parsed.due && <span><i className="ti ti-calendar" style={{ fontSize: 10 }} /> {format(new Date(parsed.due), 'd MMM · h:mm a')}</span>}
              {parsed.person && <span><i className="ti ti-user" style={{ fontSize: 10 }} /> {parsed.person}</span>}
              {parsed.priority === 'high' && <span style={{ color: 'var(--red)' }}>⚡ High priority</span>}
            </div>
          </div>
          <button onClick={() => setParsed(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--hint)' }}>
            <i className="ti ti-x" style={{ fontSize: 12 }} />
          </button>
        </div>
      )}

      {expanded && (
        <input
          className="input"
          type="datetime-local"
          value={due}
          onChange={e => setDue(e.target.value)}
          style={{ marginTop: 8, fontSize: 12 }}
        />
      )}
    </div>
  )
}

// ── Task detail / edit modal ─────────────────────────────────
function TaskModal({ taskId, onClose, onUpdate, onDelete }) {
  // Always read live from store — avoids stale snapshot
  const tasks = useStore(s => s.tasks)
  const people = useStore(s => s.people)
  const task = tasks.find(t => t.id === taskId)

  const [editTitle,    setEditTitle]    = useState(task?.title || '')
  const [editNotes,    setEditNotes]    = useState(task?.notes || '')
  const [editDue,      setEditDue]      = useState(task?.due_at ? new Date(task.due_at).toISOString().slice(0,16) : '')
  const [editProgress, setEditProgress] = useState(task?.progress || 0)
  const [editPersonId, setEditPersonId] = useState(task?.person_id || '')
  const [saving,       setSaving]       = useState(false)
  const [delConfirm,   setDelConfirm]   = useState(false)

  if (!task) return null   // was deleted while modal was open

  const handleSave = async () => {
    if (!editTitle.trim()) return
    setSaving(true)
    const progress = editProgress
    const status = progress === 100 ? 'done' : progress > 0 ? 'in_progress' : 'todo'
    await onUpdate(task.id, {
      title: editTitle.trim(),
      notes: editNotes.trim() || null,
      due_at: editDue || null,
      progress, status,
      person_id: editPersonId || null,
    })
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!delConfirm) { setDelConfirm(true); return }
    onClose()                     // close first so modal doesn't try to render deleted task
    await onDelete(task.id)
  }

  const overdue = task.due_at && isPast(new Date(task.due_at)) && task.status !== 'done'

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:300, display:'flex', flexDirection:'column', justifyContent:'flex-end', background:'rgba(0,0,0,0.42)' }}
      onClick={onClose}
    >
      <div
        style={{ background:'var(--surface)', borderRadius:'20px 20px 0 0', maxWidth:430, margin:'0 auto', width:'100%', maxHeight:'90dvh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding:'16px 20px calc(24px + env(safe-area-inset-bottom))' }}>
          <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 18px' }} />

          {/* Status badge */}
          <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
            <span style={{
              fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5,
              padding:'3px 10px', borderRadius:20,
              background: task.status==='done' ? 'var(--green-soft)' : overdue ? 'var(--red-soft)' : 'var(--accent-soft)',
              color: task.status==='done' ? 'var(--green-dark)' : overdue ? 'var(--red-dark)' : 'var(--accent-dark)'
            }}>
              {task.status==='done' ? 'Done' : overdue ? 'Overdue' : task.status==='in_progress' ? 'In progress' : 'To do'}
            </span>
            {task.source && task.source !== 'manual' && (
              <span style={{ fontSize:10, color:'var(--hint)' }}>
                via {task.source.replace('_',' ')}
              </span>
            )}
          </div>

          <input
            className="input"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            style={{ marginBottom:10, fontWeight:500, fontSize:15 }}
            autoFocus
          />
          <textarea
            className="input"
            placeholder="Notes (optional)"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            style={{ marginBottom:10, minHeight:70 }}
          />
          <input
            className="input"
            type="datetime-local"
            value={editDue}
            onChange={e => setEditDue(e.target.value)}
            style={{ marginBottom:12 }}
          />

          {/* Person */}
          {people.length > 0 && (
            <select
              className="input"
              value={editPersonId}
              onChange={e => setEditPersonId(e.target.value)}
              style={{ marginBottom:12, fontSize:13 }}
            >
              <option value="">No person assigned</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* Progress */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:12, color:'var(--muted)' }}>Progress</span>
              <span style={{ fontSize:12, fontWeight:600, color: editProgress===100 ? 'var(--green)' : 'var(--accent)' }}>{editProgress}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="5"
              value={editProgress}
              onChange={e => setEditProgress(Number(e.target.value))}
              style={{ width:'100%', accentColor: editProgress===100 ? 'var(--green)' : 'var(--accent)' }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
              {[0,25,50,75,100].map(v => (
                <button
                  key={v}
                  onClick={() => setEditProgress(v)}
                  style={{ fontSize:10, color: editProgress===v ? 'var(--accent)' : 'var(--hint)', background:'none', border:'none', cursor:'pointer', padding:'2px 4px', fontWeight: editProgress===v ? 600 : 400 }}
                >
                  {v}%
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={handleSave} disabled={!editTitle.trim()||saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              style={{ padding:'10px 16px' }}
              title="Delete task"
            >
              {delConfirm ? 'Sure?' : <i className="ti ti-trash" style={{ fontSize:15 }} />}
            </button>
          </div>
          <button className="btn btn-ghost" style={{ width:'100%', marginTop:8 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
const TABS = ['today','upcoming','all','done']

export default function Tasks() {
  const { tasks, addTask, updateTask, deleteTask, findOrCreatePerson } = useStore()
  const [activeTab,   setActiveTab]   = useState('today')
  const [showSearch,  setShowSearch]  = useState(false)
  const [search,      setSearch]      = useState('')
  const [selectedId,  setSelectedId]  = useState(null)
  const [toast,       setToast]       = useState(null)
  const [clearing,    setClearing]    = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 2500) }

  const filtered = useMemo(() => {
    let list = tasks
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q))
    }

    const active = list.filter(t => t.status !== 'done')
    const done   = list.filter(t => t.status === 'done')

    if (activeTab === 'today') {
      const r = active.filter(t => !t.due_at || isToday(new Date(t.due_at)) || (isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at))))
      // Sort: overdue first (by how late), then today by time, then no-due-date
      return r.sort((a, b) => {
        const aO = a.due_at && isPast(new Date(a.due_at)) && !isToday(new Date(a.due_at))
        const bO = b.due_at && isPast(new Date(b.due_at)) && !isToday(new Date(b.due_at))
        if (aO && !bO) return -1
        if (!aO && bO) return 1
        if (!a.due_at && b.due_at) return 1
        if (a.due_at && !b.due_at) return -1
        if (a.due_at && b.due_at) return new Date(a.due_at) - new Date(b.due_at)
        return 0
      })
    }
    if (activeTab === 'upcoming') {
      return active
        .filter(t => t.due_at && isFuture(new Date(t.due_at)) && !isToday(new Date(t.due_at)))
        .sort((a,b) => new Date(a.due_at) - new Date(b.due_at))
    }
    if (activeTab === 'all') {
      return active.sort((a,b) => {
        if (!a.due_at && b.due_at) return 1
        if (a.due_at && !b.due_at) return -1
        if (a.due_at && b.due_at) return new Date(a.due_at) - new Date(b.due_at)
        return 0
      })
    }
    // done — newest first
    return done.sort((a,b) => new Date(b.updated_at||b.created_at) - new Date(a.updated_at||a.created_at))
  }, [tasks, activeTab, search])

  const todayCount = tasks.filter(t =>
    t.status !== 'done' && (!t.due_at || isToday(new Date(t.due_at)) || (isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at))))
  ).length

  const handleToggleDone = async (e, task) => {
    e.stopPropagation()
    const isDone = task.status === 'done'
    await updateTask(task.id, { status: isDone ? 'todo' : 'done', progress: isDone ? 0 : 100 })
  }

  const handleProgress = async (e, task) => {
    e.stopPropagation()
    const progress = parseInt(e.target.value)
    const status = progress === 100 ? 'done' : progress > 0 ? 'in_progress' : 'todo'
    await updateTask(task.id, { progress, status })
  }

  const handleUpdate = async (id, updates) => {
    const { error } = await updateTask(id, updates)
    if (error) showToast('Update failed')
  }

  const handleDelete = async (id) => {
    const { error } = await deleteTask(id)
    if (!error) showToast('Task deleted')
    else showToast('Delete failed')
  }

  const clearDone = async () => {
    setClearing(true)
    const doneTasks = tasks.filter(t => t.status === 'done')
    for (const t of doneTasks) await deleteTask(t.id)
    setClearing(false)
    showToast(`${doneTasks.length} tasks cleared`)
  }

  const EMPTY_MSG = {
    today:    'All clear — quick-add above or tap + to capture',
    upcoming: 'No upcoming tasks with due dates',
    all:      'No active tasks',
    done:     'No completed tasks yet',
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding:'14px 16px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2>Tasks</h2>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
            {tasks.filter(t=>t.status!=='done').length} active · {tasks.filter(t=>t.status==='done').length} done
          </div>
        </div>
        <div style={{ display:'flex', gap:14, alignItems:'center' }}>
          {activeTab === 'done' && tasks.some(t=>t.status==='done') && (
            <button
              onClick={clearDone}
              disabled={clearing}
              style={{ fontSize:12, color:'var(--red)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}
            >
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          )}
          <i
            className="ti ti-search"
            style={{ fontSize:20, color:showSearch?'var(--accent)':'var(--muted)', cursor:'pointer' }}
            onClick={() => { setShowSearch(s=>!s); setSearch('') }}
          />
        </div>
      </div>

      {showSearch && (
        <div style={{ padding:'8px 16px 0' }}>
          <div className="search-bar">
            <i className="ti ti-search" />
            <input placeholder="Search tasks…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus />
            {search && <i className="ti ti-x" style={{ fontSize:14, color:'var(--muted)', cursor:'pointer' }} onClick={()=>setSearch('')} />}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding:'0 16px' }}>
        <div className="tabs">
          {TABS.map(tab => (
            <button key={tab} className={`tab ${activeTab===tab?'active':''}`} onClick={()=>setActiveTab(tab)} style={{ textTransform:'capitalize', fontSize:12 }}>
              {tab}
              {tab==='today' && todayCount > 0 && (
                <span style={{ marginLeft:5, background:'var(--accent)', color:'#fff', borderRadius:10, padding:'1px 5px', fontSize:9 }}>{todayCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="page-scroll" style={{ paddingTop:12 }}>
        {activeTab !== 'done' && <QuickAdd onAdd={addTask} onFindPerson={findOrCreatePerson} />}

        {/* Overdue header in today tab */}
        {activeTab === 'today' && filtered.some(t => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at))) && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <i className="ti ti-alert-circle" style={{ fontSize:13, color:'var(--red)' }} />
            <span style={{ fontSize:11, fontWeight:600, color:'var(--red)', textTransform:'uppercase', letterSpacing:.4 }}>
              Overdue
            </span>
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--muted)', fontSize:13 }}>
            {search ? 'No tasks match your search.' : EMPTY_MSG[activeTab]}
          </div>
        ) : filtered.map((task, idx) => {
          const overdue = task.due_at && isPast(new Date(task.due_at)) && task.status !== 'done' && !isToday(new Date(task.due_at))
          const todayDue = task.due_at && isToday(new Date(task.due_at))
          const due = dueLabel(task.due_at)
          const isDone = task.status === 'done'

          // Section divider — when we transition from overdue to today/no-date in today tab
          const prevTask = idx > 0 ? filtered[idx-1] : null
          const prevOverdue = prevTask?.due_at && isPast(new Date(prevTask.due_at)) && !isToday(new Date(prevTask.due_at))
          const showDivider = activeTab === 'today' && prevOverdue && !overdue

          return (
            <div key={task.id}>
              {showDivider && (
                <div style={{ display:'flex', alignItems:'center', gap:6, margin:'6px 0 10px' }}>
                  <i className="ti ti-calendar" style={{ fontSize:12, color:'var(--muted)' }} />
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.4 }}>Today & no date</span>
                </div>
              )}
              <div
                className="card"
                style={{ marginBottom:10, opacity: isDone ? .5 : 1, cursor:'pointer', borderLeft: overdue ? '3px solid var(--red)' : todayDue ? '3px solid var(--accent)' : '1px solid var(--border)' }}
                onClick={() => setSelectedId(task.id)}
              >
                <div className="flex-between" style={{ marginBottom:8 }}>
                  {/* Check circle */}
                  <button
                    onClick={e => handleToggleDone(e, task)}
                    style={{ width:26, height:26, borderRadius:'50%', border:`2px solid ${isDone ? 'var(--green)' : overdue ? 'var(--red)' : 'var(--border-strong)'}`, background: isDone ? 'var(--green)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, marginRight:10 }}
                    title={isDone ? 'Mark incomplete' : 'Mark done'}
                  >
                    {isDone && <i className="ti ti-check" style={{ fontSize:13, color:'#fff' }} />}
                  </button>

                  <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                    <div style={{ fontSize:14, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--muted)' : 'var(--text)' }}>
                      {task.title}
                    </div>
                    {due && (
                      <div style={{ fontSize:11, color: due.red ? 'var(--red)' : 'var(--muted)', marginTop:2, fontWeight: due.red ? 600 : 400 }}>
                        {due.text}
                      </div>
                    )}
                    {task.notes && (
                      <div style={{ fontSize:11, color:'var(--hint)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {task.notes}
                      </div>
                    )}
                  </div>

                  {task.person && (
                    <div className="flex-row gap-8" style={{ background:'var(--bg)', borderRadius:20, padding:'3px 8px 3px 4px', flexShrink:0 }}>
                      <div className={`avatar avatar-sm ${avatarColor(task.person?.name)}`}>{initials(task.person?.name)}</div>
                      <span style={{ fontSize:10, color:'var(--muted)' }}>{task.person?.name?.split(' ')[0]}</span>
                    </div>
                  )}
                </div>

                {/* Progress — tap doesn't open modal */}
                {!isDone && (
                  <div onClick={e => e.stopPropagation()}>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={task.progress}
                      onChange={e => handleProgress(e, task)}
                      style={{ width:'100%', accentColor: overdue ? 'var(--red)' : 'var(--accent)', cursor:'pointer' }}
                    />
                    <div style={{ fontSize:10, color: overdue ? 'var(--red)' : 'var(--accent)', fontWeight:500, marginTop:2 }}>
                      {task.progress}%
                      {task.status === 'in_progress' && <span style={{ color:'var(--muted)', fontWeight:400 }}> · in progress</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedId && (
        <TaskModal
          taskId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
