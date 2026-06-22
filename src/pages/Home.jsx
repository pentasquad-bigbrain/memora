import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { generateNudges } from '../lib/groq'
import { format, isPast, isToday } from 'date-fns'
import Skeleton from '../components/shared/Skeleton'
import { PRIORITY_META } from './Tasks'

// Slide-to-complete gesture
function SlideToComplete({ taskTitle, onComplete, accentColor='var(--accent)' }) {
  const trackRef = useRef(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [completing, setCompleting] = useState(false)
  const maxDragRef = useRef(0)
  const thumbSize = 30

  const handlePointerDown = (e) => {
    if (completing) return
    const track = trackRef.current
    if (!track) return
    maxDragRef.current = track.offsetWidth - thumbSize - 6
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const handlePointerMove = (e) => {
    if (!dragging) return
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const x = e.clientX - rect.left - thumbSize/2
    setDragX(Math.max(0, Math.min(maxDragRef.current, x)))
  }
  const handlePointerUp = () => {
    if (!dragging) return
    setDragging(false)
    const max = maxDragRef.current||1
    if (dragX/max > 0.7) { setCompleting(true); setDragX(max); onComplete() }
    else setDragX(0)
  }

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ position:'relative', height:40, borderRadius:20, background:'var(--bg)', border:'1px solid var(--border)', overflow:'hidden', touchAction:'none', userSelect:'none' }}
    >
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontSize:12, fontWeight:600, color:'var(--muted)', pointerEvents:'none', paddingRight:20 }}>
        <i className="ti ti-chevrons-right" style={{ fontSize:14 }} /> Slide to complete
      </div>
      <div
        style={{
          position:'absolute', top:5, left:5, width:thumbSize, height:thumbSize, borderRadius:'50%',
          background: completing ? 'var(--green)' : accentColor,
          display:'flex', alignItems:'center', justifyContent:'center',
          transform:`translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform .25s ease',
          cursor: completing ? 'default' : 'grab',
        }}
      >
        <i className={`ti ${completing?'ti-check':'ti-chevron-right'}`} style={{ fontSize:14, color:'#fff' }} />
      </div>
    </div>
  )
}

const AVATAR_COLORS = ['avatar-blue','avatar-green','avatar-purple','avatar-amber','avatar-red']
function initials(name) { return name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?' }
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0)||0)%AVATAR_COLORS.length] }

const SPACE_ICONS = ['ti-briefcase','ti-user','ti-run','ti-home','ti-star','ti-heart','ti-code','ti-palette']
const SPACE_COLORS = ['var(--accent)','var(--green)','var(--amber)','var(--purple)','var(--red)','var(--red)','var(--accent)','var(--purple)']

const INSIGHT_ICONS = {
  followup:      { icon: 'ti-user-check', color: 'var(--amber)',  bg: 'var(--amber-soft)',  label: 'Follow up' },
  stuck_task:    { icon: 'ti-clock',      color: 'var(--red)',    bg: 'var(--red-soft)',    label: 'Overdue task' },
  expense_alert: { icon: 'ti-coin',       color: 'var(--green)',  bg: 'var(--green-soft)',  label: 'Expense' },
  idea_prompt:   { icon: 'ti-bulb',       color: 'var(--purple)', bg: 'var(--purple-soft)', label: 'Ideas pending' },
  general:       { icon: 'ti-sparkles',   color: 'var(--accent)', bg: 'var(--accent-soft)', label: 'Insight' },
}

function AddSpaceModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true); await onSave(name.trim()); setSaving(false); onClose()
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', flexDirection:'column', justifyContent:'flex-end', background:'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:'24px 24px 0 0', padding:'20px 20px calc(24px + env(safe-area-inset-bottom))', maxWidth:430, margin:'0 auto', width:'100%' }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 20px' }} />
        <div style={{ fontSize:18, fontWeight:600, marginBottom:16 }}>New Space</div>
        <input className="input" placeholder="Space name (e.g. Work, Side Project…)" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSave()} autoFocus />
        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={handleSave} disabled={!name.trim()||saving}>{saving?'Creating…':'Create Space'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function SearchOverlay({ onClose, tasks, ideas, people, vaultItems, expenses }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const results = q.length < 2 ? [] : [
    ...tasks.filter(t=>t.title.toLowerCase().includes(q.toLowerCase())).slice(0,4).map(t=>({ icon:'ti-checkbox', color:'var(--accent)', label:t.title, sub:'Task', dest:'/tasks' })),
    ...ideas.filter(i=>i.title.toLowerCase().includes(q.toLowerCase())).slice(0,3).map(i=>({ icon:'ti-bulb', color:'var(--purple)', label:i.title, sub:'Idea', dest:'/idealab' })),
    ...people.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())).slice(0,3).map(p=>({ icon:'ti-user', color:'var(--green)', label:p.name, sub:'Person', dest:'/people' })),
    ...vaultItems.filter(v=>v.title?.toLowerCase().includes(q.toLowerCase())).slice(0,2).map(v=>({ icon:'ti-photo', color:'var(--muted)', label:v.title||'Untitled', sub:'Vault', dest:'/vault' })),
  ]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:350, background:'rgba(0,0,0,0.5)', display:'flex', flexDirection:'column' }} onClick={onClose}>
      <div style={{ background:'var(--surface)', maxWidth:430, margin:'0 auto', width:'100%', flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'max(14px,env(safe-area-inset-top)) 16px 0', display:'flex', alignItems:'center', gap:10 }}>
          <div className="search-bar" style={{ flex:1 }}>
            <i className="ti ti-search" />
            <input ref={inputRef} placeholder="Search tasks, ideas, people…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:15, cursor:'pointer', padding:'4px 8px', fontFamily:'inherit', whiteSpace:'nowrap' }}>Cancel</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 16px' }}>
          {q.length < 2 ? (
            <div style={{ textAlign:'center', color:'var(--hint)', fontSize:13, padding:'40px 0' }}>Type to search…</div>
          ) : results.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--hint)', fontSize:13, padding:'40px 0' }}>No results for "{q}"</div>
          ) : results.map((r,i) => (
            <div key={i} onClick={()=>{ navigate(r.dest); onClose() }} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom: i<results.length-1 ? '1px solid var(--border)' : 'none', cursor:'pointer' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${r.icon}`} style={{ fontSize:17, color:r.color }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.label}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{r.sub}</div>
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize:14, color:'var(--hint)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { user, spaces, activeSpace, setActiveSpace, tasks, ideas, people, expenses, vaultItems, captures, nudges, dismissNudge, addNudges, addSpace, updateTask, loading } = useStore()

  const [showSpaceModal, setShowSpaceModal] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  // Draggable IdeaLab FAB
  const [ideaPos, setIdeaPos] = useState(() => { try { return JSON.parse(localStorage.getItem('ideaLabPos')) } catch { return null } })
  const dragState = useRef({ active:false, moved:false, startClientX:0, startClientY:0, startBtnX:0, startBtnY:0 })
  const ideaPosRef = useRef(ideaPos)
  useEffect(() => { ideaPosRef.current = ideaPos }, [ideaPos])

  const getBtnDefaults = useCallback(() => ({ x: window.innerWidth-70, y: window.innerHeight-160 }), [])
  const startDrag = (cx,cy) => { const pos=ideaPosRef.current||getBtnDefaults(); dragState.current={ active:true, moved:false, startClientX:cx, startClientY:cy, startBtnX:pos.x, startBtnY:pos.y } }
  const moveDrag = useCallback((cx,cy) => {
    if (!dragState.current.active) return
    const dx=cx-dragState.current.startClientX, dy=cy-dragState.current.startClientY
    if (Math.abs(dx)>6||Math.abs(dy)>6) dragState.current.moved=true
    setIdeaPos({ x:Math.max(8,Math.min(window.innerWidth-60,dragState.current.startBtnX+dx)), y:Math.max(60,Math.min(window.innerHeight-140,dragState.current.startBtnY+dy)) })
  }, [])
  const endDrag = useCallback((cx,cy) => {
    if (!dragState.current.active) return
    dragState.current.active=false
    if (!dragState.current.moved) navigate('/idealab')
    else { const pos=ideaPosRef.current; if (pos) localStorage.setItem('ideaLabPos',JSON.stringify(pos)) }
  }, [navigate])

  const hour = new Date().getHours()
  const greeting = hour<12 ? 'Good morning' : hour<17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const todayTasks = tasks.filter(t => {
    if (t.status==='done') return false
    if (!t.due_at) return true
    return new Date(t.due_at).toDateString()===new Date().toDateString()
  })

  const weekExpenses = expenses.filter(e => (new Date()-new Date(e.date))/(86400000)<=7).reduce((s,e)=>s+Number(e.amount),0)
  const todayCaptures = captures.filter(c => new Date(c.created_at).toDateString()===new Date().toDateString())
  const todayIdeas = ideas.filter(i => new Date(i.created_at).toDateString()===new Date().toDateString())

  useEffect(() => {
    if (nudges.length===0&&tasks.length>0) {
      generateNudges({ tasks:tasks.slice(0,5), people:people.slice(0,3), expenses:expenses.slice(0,5), ideas:ideas.slice(0,3) }).then(addNudges).catch(()=>{})
    }
  }, [tasks.length])

  const pos = ideaPos || getBtnDefaults()

  const STAT_TILES = [
    { icon:'ti-checkbox', color:'var(--accent)', bg:'var(--accent-soft)', val:tasks.filter(t=>t.status!=='done').length, label:'Tasks', sub:`${tasks.filter(t=>t.status==='in_progress').length} in progress`, dest:'/tasks' },
    { icon:'ti-bulb', color:'var(--purple)', bg:'var(--purple-soft)', val:todayIdeas.length, label:'Ideas', sub:'Today', dest:'/idealab' },
    { icon:'ti-screenshot', color:'var(--amber)', bg:'var(--amber-soft)', val:todayCaptures.length, label:'Captures', sub:'Today', dest:'/capture' },
    { icon:'ti-coin', color:'var(--green)', bg:'var(--green-soft)', val:`₹${Math.round(weekExpenses).toLocaleString('en-IN')||0}`, label:'Expenses', sub:'This week', dest:'/vault' },
  ]

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding:'max(14px,env(safe-area-inset-top)) 16px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ position:'relative', cursor:'pointer' }} onClick={()=>setShowNotifications(true)}>
            <i className="ti ti-bell" style={{ fontSize:24, color:nudges.length>0?'var(--accent)':'var(--muted)' }} />
            {nudges.length>0 && <div style={{ position:'absolute', top:-3, right:-3, background:'var(--accent)', color:'#fff', borderRadius:10, fontSize:9, fontWeight:700, minWidth:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>{nudges.length}</div>}
          </div>
        </div>
        <div className={`avatar avatar-md ${avatarColor(firstName)}`} style={{ cursor:'pointer' }} onClick={()=>navigate('/menu')}>
          {initials(user?.user_metadata?.full_name||firstName)}
        </div>
      </div>

      {/* Memora Logo */}
      <div style={{ display:'flex', justifyContent:'center', padding:'8px 0' }}>
        <svg width="48" height="48" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ opacity:0.85 }}>
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor:'var(--accent)',stopOpacity:1 }} />
              <stop offset="100%" style={{ stopColor:'#a855f7',stopOpacity:1 }} />
            </linearGradient>
            <linearGradient id="grad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor:'#06b6d4',stopOpacity:1 }} />
              <stop offset="100%" style={{ stopColor:'#14b8a6',stopOpacity:1 }} />
            </linearGradient>
          </defs>
          <path d="M50 80 Q50 50 80 50 L80 150 Q50 150 50 120 Z" fill="url(#grad1)" />
          <path d="M120 80 Q150 50 150 80 L150 150 Q120 150 120 120 Z" fill="url(#grad2)" />
          <path d="M70 85 Q100 70 130 85" stroke="url(#grad1)" strokeWidth="8" fill="none" strokeLinecap="round" />
          <circle cx="100" cy="110" r="6" fill="#fbbf24" />
        </svg>
      </div>

      {/* Greeting */}
      <div style={{ padding:'14px 16px 0' }}>
        <div style={{ fontSize:28, fontWeight:700, lineHeight:1.2 }}>
          {greeting}, <span style={{ color:'var(--accent)' }}>{firstName}</span> 👋
        </div>
        <div style={{ fontSize:14, color:'var(--muted)', marginTop:4 }}>
          {format(new Date(),'EEEE, d MMMM')}
        </div>
      </div>

      {/* Spaces */}
      <div style={{ padding:'14px 16px 0' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:.6, textTransform:'uppercase', marginBottom:8 }}>Spaces</div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
          {spaces.map((sp,i) => {
            const active = activeSpace?.id===sp.id
            const ic = SPACE_ICONS[i%SPACE_ICONS.length]
            const col = SPACE_COLORS[i%SPACE_COLORS.length]
            return (
              <button key={sp.id} onClick={()=>setActiveSpace(sp)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:'var(--r-full)', fontSize:13, fontWeight:500, border:'1.5px solid', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', transition:'all .15s', background:active?'var(--accent)':'var(--bg)', color:active?'#fff':'var(--text)', borderColor:active?'var(--accent)':'var(--border)', flexShrink:0 }}>
                <i className={`ti ${ic}`} style={{ fontSize:14, color:active?'#fff':col }} />
                {sp.name}
              </button>
            )
          })}
          <button onClick={()=>setShowSpaceModal(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:'var(--r-full)', fontSize:13, fontWeight:500, border:'1.5px dashed var(--border)', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', background:'transparent', color:'var(--muted)', flexShrink:0 }}>
            <i className="ti ti-plus" style={{ fontSize:14 }} /> Add
          </button>
        </div>
      </div>

      {/* Ambient search bar */}
      <div style={{ padding:'12px 16px 0' }}>
        <button onClick={()=>setShowSearch(true)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:'var(--r-full)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
          <i className="ti ti-search" style={{ fontSize:17, color:'var(--hint)' }} />
          <span style={{ flex:1, fontSize:15, color:'var(--hint)' }}>Search tasks, ideas, people, receipts…</span>
          <i className="ti ti-adjustments-horizontal" style={{ fontSize:17, color:'var(--hint)' }} />
        </button>
      </div>

      <div className="page-scroll" style={{ paddingTop:4 }}>

        {/* Day at a glance — horizontal */}
        <div className="section-label" style={{ marginTop:18 }}>Day at a glance</div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
          {loading ? Array.from({ length:4 }).map((_,i) => (
            <div key={i} style={{ background:'var(--bg)', borderRadius:'var(--r)', padding:'10px 12px', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:6, flex:'0 0 100px' }}>
              <Skeleton width={28} height={28} radius={8} />
              <Skeleton width="70%" height={16} />
              <Skeleton width="60%" height={10} />
            </div>
          )) : STAT_TILES.map(s => (
            <div key={s.label} onClick={()=>navigate(s.dest)} style={{ background:'var(--bg)', borderRadius:'var(--r)', padding:'10px 12px', cursor:'pointer', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:3, flex:'0 0 95px', textAlign:'center' }}>
              <div style={{ width:28, height:28, borderRadius:8, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }}>
                <i className={`ti ${s.icon}`} style={{ fontSize:14, color:s.color }} />
              </div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{s.val}</div>
              <div style={{ fontSize:11, fontWeight:500, color:'var(--text)' }}>{s.label}</div>
              <div style={{ fontSize:9, color:'var(--muted)' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Focus board — expanded */}
        <div className="section-label" style={{ marginTop:20 }}>Focus board</div>
        {todayTasks.length===0 ? (
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'20px 16px', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:44, height:44, background:'var(--surface)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid var(--border)' }}>
              <i className="ti ti-clipboard" style={{ fontSize:22, color:'var(--hint)' }} />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:500 }}>No tasks for today</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>Tap + to capture or add a task</div>
            </div>
            <i className="ti ti-chevron-right" style={{ color:'var(--hint)', fontSize:16, marginLeft:'auto', flexShrink:0 }} />
          </div>
        ) : todayTasks.map(task => {
          const overdue = task.due_at && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at))
          return (
            <div key={task.id} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <div style={{ fontSize:13, fontWeight:500, flex:1 }}>{task.title}</div>
                {task.priority && PRIORITY_META[task.priority] && (
                  <span style={{ fontSize:8, fontWeight:700, background:PRIORITY_META[task.priority].bg, color:PRIORITY_META[task.priority].color, padding:'1px 6px', borderRadius:10, whiteSpace:'nowrap' }}>{PRIORITY_META[task.priority].label}</span>
                )}
              </div>
              {task.due_at && <div style={{ fontSize:10, color:overdue?'var(--red)':'var(--muted)', marginBottom:6, fontWeight:overdue?600:400 }}>{format(new Date(task.due_at),'h:mm a')}</div>}
              <SlideToComplete
                taskTitle={task.title}
                onComplete={() => updateTask(task.id, { status:'done', progress:100 })}
                accentColor={task.priority && PRIORITY_META[task.priority] ? PRIORITY_META[task.priority].color : (overdue ? 'var(--red)' : 'var(--accent)')}
              />
            </div>
          )
        })}

        {/* Smart Insights (horizontal scroll tiles) */}
        {nudges.length>0 && (
          <>
            <div className="section-label" style={{ marginTop:20 }}>Smart insights</div>
            <div style={{ display:'flex', gap:10, overflowX:'auto', scrollbarWidth:'none', paddingBottom:4, marginBottom:4 }}>
              {nudges.map(n => {
                const meta = INSIGHT_ICONS[n.type]||INSIGHT_ICONS.general
                const dest = n.entity_type==='task'?'/tasks':n.entity_type==='person'?'/people':n.entity_type==='idea'?'/idealab':n.entity_type==='expense'?'/vault':null
                return (
                  <div key={n.id} onClick={()=>dest&&navigate(dest)} style={{ flex:'0 0 160px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 14px 12px', cursor:dest?'pointer':'default', position:'relative' }}>
                    <button onClick={e=>{e.stopPropagation();dismissNudge(n.id)}} style={{ position:'absolute', top:8, right:8, background:'none', border:'none', cursor:'pointer', padding:2, color:'var(--hint)', fontSize:12, lineHeight:1 }}>
                      <i className="ti ti-x" />
                    </button>
                    <div style={{ width:32, height:32, borderRadius:8, background:meta.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                      <i className={`ti ${meta.icon}`} style={{ fontSize:16, color:meta.color }} />
                    </div>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:4, lineHeight:1.3 }}>{meta.label}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.4 }}>{n.message}</div>
                    {dest && <div style={{ fontSize:11, color:meta.color, marginTop:8, fontWeight:500 }}>Review →</div>}
                  </div>
                )
              })}
            </div>
          </>
        )}

      </div>

      {/* Draggable IdeaLab FAB */}
      <button
        onMouseDown={e=>{e.preventDefault();startDrag(e.clientX,e.clientY)}}
        onMouseMove={e=>moveDrag(e.clientX,e.clientY)}
        onMouseUp={e=>endDrag(e.clientX,e.clientY)}
        onMouseLeave={()=>{if(dragState.current.active&&dragState.current.moved){dragState.current.active=false;const p=ideaPosRef.current;if(p)localStorage.setItem('ideaLabPos',JSON.stringify(p))}}}
        onTouchStart={e=>{e.preventDefault();const t=e.touches[0];startDrag(t.clientX,t.clientY)}}
        onTouchMove={e=>{e.preventDefault();const t=e.touches[0];moveDrag(t.clientX,t.clientY)}}
        onTouchEnd={e=>{e.preventDefault();const t=e.changedTouches[0];endDrag(t.clientX,t.clientY)}}
        style={{ position:'fixed', left:pos.x, top:pos.y, width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg, var(--purple), var(--accent))', border:'none', cursor:'grab', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(139,92,246,0.4)', zIndex:200, touchAction:'none', userSelect:'none' }}
        title="IdeaLab (drag to move)"
      >
        <i className="ti ti-bulb" style={{ fontSize:22, color:'#fff', pointerEvents:'none' }} />
      </button>

      {showSearch && <SearchOverlay onClose={()=>setShowSearch(false)} tasks={tasks} ideas={ideas} people={people} vaultItems={vaultItems} expenses={expenses} />}
      {showSpaceModal && <AddSpaceModal onClose={()=>setShowSpaceModal(false)} onSave={addSpace} />}

      {/* Notifications center */}
      {showNotifications && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', flexDirection:'column', justifyContent:'flex-end', background:'rgba(0,0,0,0.45)' }} onClick={()=>setShowNotifications(false)}>
          <div style={{ background:'var(--surface)', borderRadius:'20px 20px 0 0', maxHeight:'75dvh', overflowY:'auto', maxWidth:430, margin:'0 auto', width:'100%' }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'16px 20px calc(20px + env(safe-area-inset-bottom))' }}>
              <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 16px' }} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ fontSize:18, fontWeight:600 }}>Notifications</div>
                <button onClick={()=>setShowNotifications(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:18, padding:0 }}>
                  <i className="ti ti-x" />
                </button>
              </div>

              {nudges.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--muted)' }}>
                  <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
                  <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>All caught up!</div>
                  <div style={{ fontSize:12 }}>No notifications right now</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {nudges.map(n => {
                    const meta = INSIGHT_ICONS[n.type] || INSIGHT_ICONS.general
                    const dest = n.entity_type === 'task' ? '/tasks' : n.entity_type === 'person' ? '/people' : n.entity_type === 'idea' ? '/idealab' : n.entity_type === 'expense' ? '/vault' : null
                    return (
                      <div key={n.id} style={{ display:'flex', gap:12, padding:'12px 14px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', alignItems:'flex-start' }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:meta.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <i className={`ti ${meta.icon}`} style={{ fontSize:16, color:meta.color }} />
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>{meta.label}</div>
                          <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.4 }}>{n.message}</div>
                        </div>
                        <button onClick={e=>{e.stopPropagation();dismissNudge(n.id)}} style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--hint)', flexShrink:0 }}>
                          <i className="ti ti-x" style={{ fontSize:14 }} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
