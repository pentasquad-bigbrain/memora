import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { generateNudges } from '../lib/groq'
import { format } from 'date-fns'

const AVATAR_COLORS = ['avatar-blue', 'avatar-green', 'avatar-purple', 'avatar-amber', 'avatar-red']
function initials(name) { return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?' }
function avatarColor(name) { const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length; return AVATAR_COLORS[idx] }

const NUDGE_ICONS = {
  followup:      'ti-user',
  stuck_task:    'ti-clock',
  expense_alert: 'ti-currency-rupee',
  idea_prompt:   'ti-bulb',
  general:       'ti-sparkles'
}

// ── Add Space Modal ───────────────────────────────────────────
function AddSpaceModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true); await onSave(name.trim()); setSaving(false); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', maxWidth: 430, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 14 }}>New Space</div>
        <input className="input" placeholder="Space name (e.g. Work, Side Project…)" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!name.trim() || saving}>{saving ? 'Creating…' : 'Create Space'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Global search ─────────────────────────────────────────────
function SearchResults({ query, tasks, ideas, people, vaultItems, expenses, onClose }) {
  const navigate = useNavigate()
  const q = query.toLowerCase()

  const results = [
    ...tasks.filter(t => t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q))
      .slice(0, 4).map(t => ({ type: 'task', icon: 'ti-checkbox', color: 'var(--accent)', label: t.title, sub: t.due_at ? format(new Date(t.due_at), 'd MMM') : 'No date', dest: '/tasks' })),
    ...ideas.filter(i => i.title.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q))
      .slice(0, 3).map(i => ({ type: 'idea', icon: 'ti-bulb', color: 'var(--purple)', label: i.title, sub: 'Idea', dest: '/idealab' })),
    ...people.filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 3).map(p => ({ type: 'person', icon: 'ti-user', color: 'var(--green)', label: p.name, sub: p.role || 'Person', dest: '/people' })),
    ...vaultItems.filter(v => v.title?.toLowerCase().includes(q) || v.ocr_text?.toLowerCase().includes(q))
      .slice(0, 3).map(v => ({ type: 'vault', icon: 'ti-photo', color: 'var(--muted)', label: v.title || 'Untitled', sub: 'Vault', dest: '/vault' })),
    ...expenses.filter(e => e.vendor?.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q))
      .slice(0, 2).map(e => ({ type: 'expense', icon: 'ti-currency-rupee', color: 'var(--amber)', label: e.vendor || 'Expense', sub: `₹${e.amount}`, dest: '/vault' })),
  ]

  if (results.length === 0) {
    return (
      <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        No results for "{query}"
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px 8px' }}>
      {results.map((r, i) => (
        <div
          key={i}
          onClick={() => { navigate(r.dest); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className={`ti ${r.icon}`} style={{ fontSize: 15, color: r.color }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{r.sub}</div>
          </div>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--hint)' }} />
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { user, spaces, activeSpace, setActiveSpace, tasks, ideas, people, expenses, vaultItems, nudges, dismissNudge, addNudges, addSpace } = useStore()

  const [showSpaceModal, setShowSpaceModal] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef(null)

  // ── Draggable IdeaLab button ──────────────────────────────
  const [ideaPos, setIdeaPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ideaLabPos')) } catch { return null }
  })
  const dragState = useRef({ active: false, moved: false, startClientX: 0, startClientY: 0, startBtnX: 0, startBtnY: 0 })
  const ideaPosRef = useRef(ideaPos)
  useEffect(() => { ideaPosRef.current = ideaPos }, [ideaPos])

  const getBtnDefaults = useCallback(() => ({
    x: window.innerWidth - 70,
    y: window.innerHeight - 160,   // above bottom nav
  }), [])

  const startDrag = (clientX, clientY) => {
    const pos = ideaPosRef.current || getBtnDefaults()
    dragState.current = { active: true, moved: false, startClientX: clientX, startClientY: clientY, startBtnX: pos.x, startBtnY: pos.y }
  }
  const moveDrag = useCallback((clientX, clientY) => {
    if (!dragState.current.active) return
    const dx = clientX - dragState.current.startClientX
    const dy = clientY - dragState.current.startClientY
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragState.current.moved = true
    const newX = Math.max(8, Math.min(window.innerWidth - 60, dragState.current.startBtnX + dx))
    const newY = Math.max(60, Math.min(window.innerHeight - 140, dragState.current.startBtnY + dy))
    setIdeaPos({ x: newX, y: newY })
  }, [])
  const endDrag = useCallback((clientX, clientY) => {
    if (!dragState.current.active) return
    dragState.current.active = false
    if (!dragState.current.moved) {
      navigate('/idealab')
    } else {
      const pos = ideaPosRef.current
      if (pos) localStorage.setItem('ideaLabPos', JSON.stringify(pos))
    }
  }, [navigate])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const todayTasks = tasks.filter(t => {
    if (t.status === 'done') return false
    if (!t.due_at) return true
    const due = new Date(t.due_at)
    return due.toDateString() === new Date().toDateString()
  }).slice(0, 3)

  const upcomingTasks = tasks.filter(t => {
    if (t.status === 'done' || !t.due_at) return false
    const due = new Date(t.due_at)
    const today = new Date()
    return due > today && due.toDateString() !== today.toDateString()
  }).slice(0, 3)

  const weekExpenses = expenses.filter(e => {
    const d = new Date(e.date); const now = new Date()
    return (now - d) / (1000 * 60 * 60 * 24) <= 7
  }).reduce((s, e) => s + Number(e.amount), 0)

  useEffect(() => {
    if (nudges.length === 0 && tasks.length > 0) {
      generateNudges({ tasks: tasks.slice(0, 5), people: people.slice(0, 3), expenses: expenses.slice(0, 5), ideas: ideas.slice(0, 3) })
        .then(addNudges).catch(() => {})
    }
  }, [tasks.length])

  useEffect(() => {
    if (showSearch) searchRef.current?.focus()
  }, [showSearch])

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500 }}>{greeting}, {firstName}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {todayTasks.length} tasks today · {format(new Date(), 'EEE, d MMM')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Search toggle */}
          <button
            onClick={() => { setShowSearch(s => !s); setSearchQuery('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
          >
            <i className="ti ti-search" style={{ fontSize: 20, color: showSearch ? 'var(--accent)' : 'var(--muted)' }} />
          </button>
          {/* Bell */}
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => document.querySelector('.nudge')?.scrollIntoView({ behavior: 'smooth' })}>
            <i className="ti ti-bell" style={{ fontSize: 22, color: nudges.length > 0 ? 'var(--accent)' : 'var(--muted)' }} />
            {nudges.length > 0 && (
              <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--accent)', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {nudges.length}
              </div>
            )}
          </div>
          {/* Avatar → People */}
          <div className={`avatar avatar-md ${avatarColor(firstName)}`} style={{ cursor: 'pointer' }} onClick={() => navigate('/people')}>
            {initials(user?.user_metadata?.full_name || firstName)}
          </div>
        </div>
      </div>

      {/* Search bar + results */}
      {showSearch && (
        <div style={{ padding: '10px 16px 0' }}>
          <div className="search-bar">
            <i className="ti ti-search" />
            <input
              ref={searchRef}
              placeholder="Search tasks, ideas, people, vault…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && <i className="ti ti-x" style={{ fontSize: 14, color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
          </div>
          {searchQuery.trim().length >= 2 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginTop: 4, overflow: 'hidden' }}>
              <SearchResults
                query={searchQuery.trim()}
                tasks={tasks} ideas={ideas} people={people}
                vaultItems={vaultItems} expenses={expenses}
                onClose={() => setShowSearch(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Space selector */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {spaces.map(sp => (
          <button key={sp.id} className={`pill ${activeSpace?.id === sp.id ? 'active' : ''}`} onClick={() => setActiveSpace(sp)}>
            {sp.name}
          </button>
        ))}
        <button className="pill" onClick={() => setShowSpaceModal(true)}>+ Space</button>
      </div>

      {/* Draggable IdeaLab FAB — fixed, drag to reposition */}
      {(() => {
        const pos = ideaPos || getBtnDefaults()
        return (
          <button
            onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY) }}
            onMouseMove={e => moveDrag(e.clientX, e.clientY)}
            onMouseUp={e => endDrag(e.clientX, e.clientY)}
            onMouseLeave={() => { if (dragState.current.active && dragState.current.moved) { dragState.current.active = false; const p = ideaPosRef.current; if (p) localStorage.setItem('ideaLabPos', JSON.stringify(p)) } }}
            onTouchStart={e => { e.preventDefault(); const t = e.touches[0]; startDrag(t.clientX, t.clientY) }}
            onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY) }}
            onTouchEnd={e => { e.preventDefault(); const t = e.changedTouches[0]; endDrag(t.clientX, t.clientY) }}
            style={{
              position: 'fixed', left: pos.x, top: pos.y,
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--purple), var(--accent))',
              border: 'none', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(139,92,246,0.4)',
              zIndex: 200, touchAction: 'none', userSelect: 'none',
            }}
            title="IdeaLab (drag to move)"
          >
            <i className="ti ti-bulb" style={{ fontSize: 22, color: '#fff', pointerEvents: 'none' }} />
          </button>
        )
      })()}

      <div className="page-scroll" style={{ paddingTop: 0, position: 'relative' }}>

        {/* Today's focus */}
        <div className="section-row" style={{ marginTop: 20 }}>
          <div className="section-label">Today's focus</div>
          <button className="see-all" onClick={() => navigate('/tasks')}>See all</button>
        </div>

        {todayTasks.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: 13 }}>
            No tasks for today. Tap + to capture one.
          </div>
        ) : todayTasks.map(task => (
          <div key={task.id} className="card" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{task.title}</div>
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
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${task.progress}%` }} /></div>
            <div className="progress-label">{task.progress}%</div>
          </div>
        ))}

        {/* Nudges */}
        {nudges.length > 0 && (
          <>
            <div className="section-label">Smart nudges</div>
            {nudges.map(n => {
              const dest = n.entity_type === 'task' ? '/tasks' : n.entity_type === 'person' ? '/people' : n.entity_type === 'idea' ? '/idealab' : n.entity_type === 'expense' ? '/vault' : null
              return (
                <div key={n.id} className="nudge" style={{ cursor: dest ? 'pointer' : 'default' }} onClick={() => dest && navigate(dest)}>
                  <i className={`ti ${NUDGE_ICONS[n.type] || 'ti-sparkles'} nudge-icon`} />
                  <div className="nudge-text">{n.message}</div>
                  <button className="nudge-close" onClick={e => { e.stopPropagation(); dismissNudge(n.id) }}>
                    <i className="ti ti-x" />
                  </button>
                </div>
              )
            })}
          </>
        )}

        {/* Stats */}
        <div className="section-label">Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: 'ti-checkbox',       color: 'var(--accent)', val: tasks.filter(t => t.status !== 'done').length,         label: 'Tasks',     sub: `${tasks.filter(t => t.status === 'in_progress').length} in progress`, onClick: () => navigate('/tasks') },
            { icon: 'ti-bulb',           color: 'var(--purple)', val: ideas.length,                                          label: 'Ideas',     sub: `${ideas.filter(i => i.status === 'raw').length} new`,                    onClick: () => navigate('/idealab') },
            { icon: 'ti-users',          color: 'var(--green)',  val: people.length,                                         label: 'People',    sub: 'tap to view',                                                             onClick: () => navigate('/people') },
            { icon: 'ti-currency-rupee', color: 'var(--amber)',  val: `₹${Math.round(weekExpenses).toLocaleString('en-IN')}`, label: 'This week', sub: `${expenses.length} expenses`,                                             onClick: () => navigate('/vault') }
          ].map(s => (
            <div key={s.label} onClick={s.onClick} style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)', padding: '12px 14px', cursor: 'pointer' }}>
              <i className={`ti ${s.icon}`} style={{ fontSize: 18, color: s.color }} />
              <div style={{ fontSize: 20, fontWeight: 500, marginTop: 6 }}>{s.val}</div>
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
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.due_at ? format(new Date(t.due_at), 'EEE, d MMM · h:mm a') : 'No date'}</div>
                  </div>
                  {t.person && <div className={`avatar avatar-sm ${avatarColor(t.person.name)}`}>{initials(t.person.name)}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showSpaceModal && <AddSpaceModal onClose={() => setShowSpaceModal(false)} onSave={addSpace} />}
    </div>
  )
}
