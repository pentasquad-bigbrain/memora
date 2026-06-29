import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../lib/store'
import { parseTaskQuick } from '../lib/groq'
import { format, isToday, isTomorrow, isPast, isFuture, addDays, startOfDay } from 'date-fns'

const AVATAR_COLORS = ['avatar-blue','avatar-green','avatar-purple','avatar-amber','avatar-red']
function initials(name) { return name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?' }
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0)||0)%AVATAR_COLORS.length] }

export const PRIORITY_META = {
  low:  { color:'var(--green)',  bg:'var(--green-soft)',  label:'Low' },
  med:  { color:'var(--amber)',  bg:'var(--amber-soft)',  label:'Medium' },
  high: { color:'var(--red)',    bg:'var(--red-soft)',    label:'High' },
}

function scheduleReminder(title, reminderAt) {
  if (!reminderAt || !('Notification' in window)) return
  if (localStorage.getItem('memora-notifications') !== 'on') return
  const delay = new Date(reminderAt) - Date.now()
  if (delay <= 0) return
  const go = () => new Notification('⏰ Memora Reminder', { body: title, icon: '/memora/icon-192.png' })
  if (Notification.permission === 'granted') { setTimeout(go, Math.min(delay, 2147483647)); return }
  Notification.requestPermission().then(p => { if (p === 'granted') setTimeout(go, Math.min(delay, 2147483647)) })
}

function dueLabel(due) {
  if (!due) return null
  const d = new Date(due)
  if (isPast(d)&&!isToday(d)) return { text:`Overdue · ${format(d,'d MMM')}`, red:true }
  if (isToday(d))    return { text:`Today · ${format(d,'h:mm a')}`, red:false }
  if (isTomorrow(d)) return { text:`Tomorrow · ${format(d,'h:mm a')}`, red:false }
  return { text:format(d,'EEE d MMM · h:mm a'), red:false }
}

function SmartTimePicker({ value, onChange, disabled=false }) {
  const presets = [
    ['09:00','Morning'],
    ['13:00','Afternoon'],
    ['17:00','Evening'],
    ['20:00','Night'],
  ]
  const [hour='09', minute='00'] = (value || '09:00').split(':')
  const setPart = (nextHour, nextMinute) => onChange(`${String(nextHour).padStart(2,'0')}:${String(nextMinute).padStart(2,'0')}`)
  return (
    <div style={{ opacity:disabled ? .5 : 1, pointerEvents:disabled?'none':'auto' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <select className="input" value={hour} onChange={e=>setPart(e.target.value, minute)} style={{ padding:'10px 12px', fontSize:14 }}>
          {Array.from({ length:24 }, (_,i)=>String(i).padStart(2,'0')).map(h => <option key={h} value={h}>{format(new Date(2000,0,1,Number(h),0), 'h a')}</option>)}
        </select>
        <select className="input" value={minute} onChange={e=>setPart(hour, e.target.value)} style={{ padding:'10px 12px', fontSize:14 }}>
          {['00','15','30','45'].map(m => <option key={m} value={m}>{m} min</option>)}
        </select>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {presets.map(([time,label]) => (
          <button key={time} onClick={()=>onChange(time)} style={{ padding:'8px 6px', borderRadius:'var(--r-sm)', border:'1px solid', borderColor:value===time?'var(--accent)':'var(--border)', background:value===time?'var(--accent-soft)':'var(--bg)', color:value===time?'var(--accent)':'var(--muted)', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>
            {label} {format(new Date(2000,0,1,Number(time.slice(0,2)),Number(time.slice(3))), 'h:mm a')}
          </button>
        ))}
      </div>
    </div>
  )
}

function PersonSearchPicker({ people, value, onChange, onCreate }) {
  const selected = people.find(p => p.id === value)
  const [query, setQuery] = useState(selected?.name || '')
  const [open, setOpen] = useState(false)
  const matches = people.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
  const createPerson = async () => {
    if (!query.trim() || !onCreate) return
    const person = await onCreate(query.trim())
    if (person) { onChange(person.id); setQuery(person.name); setOpen(false) }
  }
  return (
    <div style={{ position:'relative', marginBottom:12 }}>
      <div style={{ fontSize:12, fontWeight:500, color:'var(--muted)', marginBottom:6 }}>Person</div>
      <div className="search-bar" style={{ margin:0, borderRadius:'var(--r)' }}>
        <i className="ti ti-user-search" />
        <input placeholder="Search or add person..." value={query} onFocus={()=>setOpen(true)} onChange={e=>{ setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange('') }} />
        {value && <button onClick={()=>{ onChange(''); setQuery('') }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)' }}><i className="ti ti-x" /></button>}
      </div>
      {open && query && (
        <div style={{ position:'absolute', left:0, right:0, top:'calc(100% + 6px)', zIndex:20, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', boxShadow:'0 8px 24px rgba(0,0,0,.12)', overflow:'hidden' }}>
          {matches.map(p => (
            <button key={p.id} onClick={()=>{ onChange(p.id); setQuery(p.name); setOpen(false) }} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', background:'none', border:'none', borderBottom:'1px solid var(--border)', textAlign:'left', cursor:'pointer', fontFamily:'inherit' }}>
              <div className={`avatar avatar-sm ${avatarColor(p.name)}`}>{initials(p.name)}</div>
              <span style={{ fontSize:13, color:'var(--text)' }}>{p.name}</span>
            </button>
          ))}
          {!matches.some(p => p.name.toLowerCase() === query.trim().toLowerCase()) && (
            <button onClick={createPerson} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 12px', background:'var(--accent-soft)', border:'none', color:'var(--accent)', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
              <i className="ti ti-plus" /> Add "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Circular progress ring ─────────────────────────────────────
function CircularProgress({ progress=0, size=40, stroke=3.5, color='var(--accent)', done=false, onClick }) {
  const r = (size-stroke)/2
  const c = 2*Math.PI*r
  const offset = c - (progress/100)*c
  return (
    <button onClick={onClick} style={{ position:'relative', width:size, height:size, flexShrink:0, background:'none', border:'none', cursor:'pointer', padding:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={done?'var(--green)':color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={done?0:offset} strokeLinecap="round" style={{ transition:'stroke-dashoffset .3s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {done
          ? <i className="ti ti-check" style={{ fontSize:size*0.42, color:'var(--green)' }} />
          : <span style={{ fontSize:size*0.26, fontWeight:700, color }}>{progress}%</span>}
      </div>
    </button>
  )
}

// ── Slide-to-complete gesture ───────────────────────────────────
function SlideToComplete({ onComplete, label='Slide to complete', accentColor='var(--accent)' }) {
  const trackRef = useRef(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [completing, setCompleting] = useState(false)
  const maxDragRef = useRef(0)
  const pointerOffsetRef = useRef(0)
  const thumbSize = 30

  const handlePointerDown = (e) => {
    if (completing) return
    const track = trackRef.current
    if (!track) return
    maxDragRef.current = track.offsetWidth - thumbSize - 6
    const thumbRect = e.currentTarget.getBoundingClientRect()
    pointerOffsetRef.current = e.clientX - thumbRect.left
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const handlePointerMove = (e) => {
    if (!dragging) return
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const x = e.clientX - rect.left - 3 - pointerOffsetRef.current
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
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ position:'relative', height:32, borderRadius:16, background:'var(--bg)', border:'1px solid var(--border)', overflow:'hidden', touchAction:'pan-y', userSelect:'none' }}
    >
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontSize:11, fontWeight:600, color:'var(--muted)', pointerEvents:'none', padding:'0 14px 0 42px' }}>
        <i className="ti ti-chevrons-right" style={{ fontSize:13 }} /> {label || 'Hold arrow and slide'}
      </div>
      <div
        onPointerDown={handlePointerDown}
        style={{
          position:'absolute', top:3, left:3, width:thumbSize, height:thumbSize, borderRadius:'50%',
          background: completing ? 'var(--green)' : accentColor,
          display:'flex', alignItems:'center', justifyContent:'center',
          transform:`translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform .25s ease',
          cursor: completing ? 'default' : 'grab',
          touchAction:'none',
        }}
      >
        <i className={`ti ${completing?'ti-check':'ti-chevron-right'}`} style={{ fontSize:14, color:'#fff' }} />
      </div>
    </div>
  )
}

// ── Redesigned QuickAdd ───────────────────────────────────────
function QuickAdd({ onAdd, onFindPerson, people=[], initialOpen=false }) {
  const [open,       setOpen]       = useState(initialOpen)
  const [title,      setTitle]      = useState('')
  const [dueDate,    setDueDate]    = useState(null)
  const [customDate, setCustomDate] = useState('')
  const [allDay,     setAllDay]     = useState(true)
  const [time,       setTime]       = useState('')
  const [priority,   setPriority]   = useState('med')
  const [personId,   setPersonId]   = useState('')
  const [reminder,   setReminder]   = useState('')
  const [reminderMenu, setReminderMenu] = useState(false)
  const [parsing,    setParsing]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [parsed,     setParsed]     = useState(null)
  const [listening,  setListening]  = useState(false)
  const recognitionRef = useRef(null)
  const inputRef = useRef(null)
  const hasVoiceSupport = typeof window!=='undefined'&&!!(window.SpeechRecognition||window.webkitSpeechRecognition)

  useEffect(() => {
    if (!initialOpen) return
    setOpen(true)
    const timer = setTimeout(()=>inputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [initialOpen])

  const toggleListening = () => {
    if (!hasVoiceSupport) return
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = navigator.language||'en-US'; rec.continuous=false; rec.interimResults=true
    rec.onresult = (e) => {
      let text=''
      for (let i=0;i<e.results.length;i++) text+=e.results[i][0].transcript
      setTitle(text); setParsed(null)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  const runAIParse = async (text) => {
    if (!text.trim()) return
    setParsing(true)
    const result = await parseTaskQuick(text)
    setParsed(result)
    if (result.due) {
      const d = new Date(result.due)
      if (isToday(d)) setDueDate('today')
      else if (isTomorrow(d)) setDueDate('tomorrow')
      else { setDueDate('custom'); setCustomDate(d.toISOString().slice(0,16)) }
    }
    setParsing(false)
  }

  const buildDueAt = () => {
    if (!dueDate) return null
    let base
    if (dueDate==='today')    base = startOfDay(new Date())
    else if (dueDate==='tomorrow') base = startOfDay(addDays(new Date(),1))
    else if (customDate) {
      if (!allDay) return customDate
      return new Date(`${customDate}T00:00:00`).toISOString()
    }
    else return null
    if (!allDay&&time) {
      const [h,m] = time.split(':')
      base.setHours(Number(h),Number(m),0,0)
    }
    return base.toISOString()
  }

  const submit = async () => {
    const finalTitle = (parsed?.title ?? title).trim()
    if (!finalTitle) return
    setSaving(true)
    let person_id = personId || null
    if (parsed?.person && onFindPerson) {
      const p = await onFindPerson(parsed.person)
      if (p) person_id = p.id
    }
    const reminderAt = reminder || null
    await onAdd({ title:finalTitle, due_at:buildDueAt(), reminder_at:reminderAt, priority:priority||null, status:'todo', progress:0, source:'manual', person_id })
    if (reminderAt) scheduleReminder(finalTitle, reminderAt)
    setTitle(''); setDueDate(null); setCustomDate(''); setAllDay(true); setTime(''); setPriority('med'); setPersonId(''); setReminder(''); setSaving(false); setParsed(null); setOpen(false)
  }

  const handleKey = (e) => {
    if (e.key==='Enter') { e.preventDefault(); if (!open) { setOpen(true); setTimeout(()=>inputRef.current?.focus(),50) } else submit() }
  }

  return (
    <div style={{ marginBottom:16 }}>
      {/* Collapsed state */}
      {!open ? (
        <div onClick={()=>{setOpen(true);setTimeout(()=>inputRef.current?.focus(),50)}} style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:'var(--r)', cursor:'text' }}>
          <i className="ti ti-plus" style={{ fontSize:17, color:'var(--muted)' }} />
          <span style={{ fontSize:15, color:'var(--hint)' }}>Quick add task…</span>
          <div style={{ marginLeft:'auto', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'4px 8px' }}>
            <i className="ti ti-calendar" style={{ fontSize:15, color:'var(--muted)' }} />
          </div>
        </div>
      ) : (
        <div style={{ background:'var(--surface)', border:'1.5px solid var(--accent)', borderRadius:'var(--r)', overflow:'hidden', boxShadow:'0 4px 20px rgba(59,130,246,0.12)' }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px 10px' }}>
            <div style={{ fontSize:15, fontWeight:600 }}>Quick add</div>
            <button onClick={()=>{setOpen(false);setParsed(null)}} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:4, fontSize:18 }}>
              <i className="ti ti-chevron-down" />
            </button>
          </div>

          {/* Text input */}
          <div style={{ padding:'0 16px 12px', position:'relative' }}>
            <input
              ref={inputRef}
              className="input"
              placeholder={listening?'Listening…':'What do you want to do?'}
              value={title}
              onChange={e=>{setTitle(e.target.value);setParsed(null)}}
              onKeyDown={handleKey}
              disabled={saving||parsing}
              style={{ background:'var(--bg)', borderColor:listening?'var(--accent)':'var(--border)', paddingRight:40 }}
            />
            {hasVoiceSupport && (
              <button
                onClick={toggleListening}
                disabled={saving||parsing}
                title={listening?'Stop listening':'Speak to add task'}
                style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:28, height:28, borderRadius:'50%', border:'none', background:listening?'var(--red-soft)':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              >
                <i className={`ti ${listening?'ti-player-stop':'ti-microphone'}`} style={{ fontSize:15, color:listening?'var(--red)':'var(--muted)' }} />
              </button>
            )}
          </div>

          {/* AI parsed preview */}
          {parsed && (
            <div style={{ margin:'0 16px 10px', padding:'8px 12px', background:'var(--accent-soft)', borderRadius:'var(--r-sm)', display:'flex', gap:8, alignItems:'flex-start' }}>
              <i className="ti ti-sparkles" style={{ fontSize:13, color:'var(--accent)', marginTop:2 }} />
              <div style={{ flex:1, fontSize:12, color:'var(--accent-dark)' }}>
                <strong>{parsed.title}</strong>
                {parsed.due&&<span> · {format(new Date(parsed.due),'d MMM')}</span>}
                {parsed.person&&<span> · {parsed.person}</span>}
              </div>
              <button onClick={()=>setParsed(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--hint)', fontSize:13, padding:2 }}>×</button>
            </div>
          )}

          {/* Date shortcuts */}
          <div style={{ padding:'0 16px 10px' }}>
            <div style={{ fontSize:12, fontWeight:500, color:'var(--muted)', marginBottom:8 }}>Date</div>
            <div style={{ display:'flex', gap:8 }}>
              {[['today','Today'],['tomorrow','Tomorrow'],['custom','Pick date']].map(([k,label])=>(
                <button key={k} onClick={()=>setDueDate(dueDate===k?null:k)} style={{ flex:1, padding:'9px 6px', fontSize:12, fontWeight:500, borderRadius:'var(--r-sm)', border:'1.5px solid', cursor:'pointer', fontFamily:'inherit', transition:'all .15s', background:dueDate===k?'var(--accent-soft)':'var(--bg)', color:dueDate===k?'var(--accent)':'var(--muted)', borderColor:dueDate===k?'var(--accent)':'var(--border)' }}>
                  {label}
                </button>
              ))}
            </div>
            {dueDate==='custom' && (
              <div style={{ marginTop:8 }}>
                <input className="input" type={allDay?'date':'datetime-local'} value={customDate} onChange={e=>setCustomDate(e.target.value)} />
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginTop:8, width:'fit-content' }}>
                  <div onClick={()=>{ setAllDay(s=>!s); setCustomDate('') }} style={{ width:40, height:24, borderRadius:12, background:allDay?'var(--accent)':'var(--border)', position:'relative', cursor:'pointer', transition:'background .2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:3, left:allDay?18:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .2s' }} />
                  </div>
                  <span style={{ fontSize:12, color:'var(--muted)' }}>All day</span>
                </label>
              </div>
            )}
          </div>

          {/* Time */}
          {dueDate&&dueDate!=='custom' && (
            <div style={{ padding:'0 16px 12px' }}>
              <div style={{ fontSize:12, fontWeight:500, color:'var(--muted)', marginBottom:8 }}>Time (optional)</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1 }}>
                  <SmartTimePicker value={time} onChange={setTime} disabled={allDay} />
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', whiteSpace:'nowrap' }}>
                  <div onClick={()=>setAllDay(s=>!s)} style={{ width:40, height:24, borderRadius:12, background:allDay?'var(--accent)':'var(--border)', position:'relative', cursor:'pointer', transition:'background .2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:3, left:allDay?18:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .2s' }} />
                  </div>
                  <span style={{ fontSize:12, color:'var(--muted)' }}>All day</span>
                </label>
              </div>
            </div>
          )}

          {/* Person */}
          <div style={{ padding:'0 16px 10px' }}>
            <PersonSearchPicker people={people} value={personId} onChange={setPersonId} onCreate={onFindPerson} />
          </div>

          {/* Priority */}
          <div style={{ padding:'0 16px 10px' }}>
            <div style={{ fontSize:12, fontWeight:500, color:'var(--muted)', marginBottom:6 }}>Priority</div>
            <div style={{ display:'flex', gap:6 }}>
              {Object.entries(PRIORITY_META).map(([key,p])=>(
                <button key={key} onClick={()=>setPriority(key)} style={{ flex:1, padding:'7px 0', borderRadius:'var(--r-sm)', border:'1.5px solid', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, background:priority===key?p.bg:'transparent', color:priority===key?p.color:'var(--muted)', borderColor:priority===key?p.color:'var(--border)' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reminder — bell button with quick menu */}
          <div style={{ padding:'0 16px 12px', display:'flex', alignItems:'center', gap:8, position:'relative' }}>
            <button onClick={()=>setReminderMenu(!reminderMenu)} style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid', borderColor:reminder?'var(--amber)':'var(--border)', background:reminder?'var(--amber-soft)':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:reminder?'var(--amber)':'var(--muted)', fontSize:18 }} title="Set reminder">
              <i className={`ti ${reminder?'ti-bell-filled':'ti-bell'}`} style={{ fontSize:18 }} />
            </button>
            <span style={{ fontSize:12, color:'var(--muted)' }}>{reminder?'Reminder set':'Set reminder'}</span>
            {reminderMenu && (
              <div style={{ position:'absolute', top:40, left:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', zIndex:10, minWidth:140 }}>
                {[
                  { label:'5 min', mins:5 },
                  { label:'15 min', mins:15 },
                  { label:'30 min', mins:30 },
                  { label:'1 hour', mins:60 },
                ].map(opt => (
                  <button key={opt.mins} onClick={() => { setReminder(new Date(Date.now()+opt.mins*60000).toISOString().slice(0,16)); setReminderMenu(false) }} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--text)', borderBottom:'1px solid var(--border)', fontFamily:'inherit' }}>
                    {opt.label}
                  </button>
                ))}
                <button onClick={() => setReminder('')} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--red)', fontFamily:'inherit' }}>
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding:'0 16px 14px', display:'flex', gap:8 }}>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={submit} disabled={!title.trim()||saving}>
              {saving ? <><div className="spinner" style={{ width:14, height:14, borderTopColor:'#fff' }}/> Saving…</> : 'Add task'}
            </button>
            <button
              onClick={()=>runAIParse(title)}
              disabled={!title.trim()||parsing||saving}
              title="AI Parse"
              style={{ padding:'12px 14px', borderRadius:'var(--r-full)', border:'none', background:'var(--accent-soft)', color:'var(--accent)', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13, fontWeight:500, minHeight:46 }}
            >
              {parsing ? <div className="spinner" style={{ width:14, height:14 }}/> : <i className="ti ti-sparkles" style={{ fontSize:16 }} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Task detail / edit modal ─────────────────────────────────
function TaskModal({ taskId, onClose, onUpdate, onDelete }) {
  const tasks = useStore(s=>s.tasks)
  const people = useStore(s=>s.people)
  const findOrCreatePerson = useStore(s=>s.findOrCreatePerson)
  const task = tasks.find(t=>t.id===taskId)

  const [editTitle,      setEditTitle]      = useState(task?.title||'')
  const [editNotes,      setEditNotes]      = useState(task?.notes||'')
  const initialAllDay = task?.due_at ? new Date(task.due_at).getHours()===0&&new Date(task.due_at).getMinutes()===0 : true
  const [editAllDay,     setEditAllDay]     = useState(initialAllDay)
  const [editDue,        setEditDue]        = useState(task?.due_at?format(new Date(task.due_at), initialAllDay?'yyyy-MM-dd':"yyyy-MM-dd'T'HH:mm"):'')
  const [editPriority,   setEditPriority]   = useState(task?.priority||'med')
  const [editReminder,   setEditReminder]   = useState(task?.reminder_at?new Date(task.reminder_at).toISOString().slice(0,16):'')
  const [editReminderMenu, setEditReminderMenu] = useState(false)
  const [editProgress,   setEditProgress]   = useState(task?.progress||0)
  const [editPersonId,   setEditPersonId]   = useState(task?.person_id||'')
  const [saving,         setSaving]         = useState(false)
  const [delConfirm,     setDelConfirm]     = useState(false)

  if (!task) return null

  const handleSave = async () => {
    if (!editTitle.trim()) return
    setSaving(true)
    const status = editProgress===100?'done':editProgress>0?'in_progress':'todo'
    const reminderAt = editReminder||null
    const dueAt = editDue
      ? (editAllDay ? new Date(`${editDue}T00:00:00`).toISOString() : new Date(editDue).toISOString())
      : null
    await onUpdate(task.id, { title:editTitle.trim(), notes:editNotes.trim()||null, due_at:dueAt, priority:editPriority||'med', reminder_at:reminderAt, progress:editProgress, status, person_id:editPersonId||null })
    if (reminderAt) scheduleReminder(editTitle.trim(), reminderAt)
    setSaving(false); onClose()
  }

  const handleDelete = async () => {
    if (!delConfirm) { setDelConfirm(true); return }
    onClose(); await onDelete(task.id)
  }

  const overdue = task.due_at&&isPast(new Date(task.due_at))&&task.status!=='done'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', flexDirection:'column', justifyContent:'flex-end', background:'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:'24px 24px 0 0', maxWidth:430, margin:'0 auto', width:'100%', maxHeight:'92dvh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'16px 20px calc(24px + env(safe-area-inset-bottom))' }}>
          <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 18px' }} />
          <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, padding:'4px 12px', borderRadius:20, background:task.status==='done'?'var(--green-soft)':overdue?'var(--red-soft)':'var(--accent-soft)', color:task.status==='done'?'var(--green-dark)':overdue?'var(--red-dark)':'var(--accent-dark)' }}>
              {task.status==='done'?'Done':overdue?'Overdue':task.status==='in_progress'?'In progress':'To do'}
            </span>
          </div>
          <input className="input" value={editTitle} onChange={e=>setEditTitle(e.target.value)} style={{ marginBottom:10, fontWeight:500, fontSize:16 }} autoFocus />
          <textarea className="input" placeholder="Notes (optional)" value={editNotes} onChange={e=>setEditNotes(e.target.value)} style={{ marginBottom:10, minHeight:70 }} />
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
            <input className="input" type={editAllDay?'date':'datetime-local'} value={editDue} onChange={e=>setEditDue(e.target.value)} style={{ flex:1 }} />
            <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'var(--muted)', whiteSpace:'nowrap', cursor:'pointer' }}>
              <input
                type="checkbox"
                checked={editAllDay}
                onChange={e => {
                  const next = e.target.checked
                  setEditAllDay(next)
                  setEditDue(value => next ? value.split('T')[0] : (value ? `${value.split('T')[0]}T09:00` : ''))
                }}
                style={{ width:16, height:16, accentColor:'var(--accent)' }}
              />
              All day
            </label>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:500, color:'var(--muted)', marginBottom:6 }}>Priority</div>
            <div style={{ display:'flex', gap:6 }}>
              {Object.entries(PRIORITY_META).map(([key,p])=>(
                <button key={key} onClick={()=>setEditPriority(key)} style={{ flex:1, padding:'7px 0', borderRadius:'var(--r-sm)', border:'1.5px solid', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, background:editPriority===key?p.bg:'transparent', color:editPriority===key?p.color:'var(--muted)', borderColor:editPriority===key?p.color:'var(--border)' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, position:'relative' }}>
            <button onClick={()=>setEditReminderMenu(!editReminderMenu)} style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid', borderColor:editReminder?'var(--amber)':'var(--border)', background:editReminder?'var(--amber-soft)':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:editReminder?'var(--amber)':'var(--muted)', fontSize:18, flexShrink:0 }} title="Set reminder">
              <i className={`ti ${editReminder?'ti-bell-filled':'ti-bell'}`} style={{ fontSize:18 }} />
            </button>
            <span style={{ fontSize:12, color:'var(--muted)' }}>{editReminder?'Reminder set':'Set reminder'}</span>
            {editReminderMenu && (
              <div style={{ position:'absolute', top:40, left:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', zIndex:10, minWidth:140 }}>
                {[
                  { label:'5 min', mins:5 },
                  { label:'15 min', mins:15 },
                  { label:'30 min', mins:30 },
                  { label:'1 hour', mins:60 },
                ].map(opt => (
                  <button key={opt.mins} onClick={() => { setEditReminder(new Date(Date.now()+opt.mins*60000).toISOString().slice(0,16)); setEditReminderMenu(false) }} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--text)', borderBottom:'1px solid var(--border)', fontFamily:'inherit' }}>
                    {opt.label}
                  </button>
                ))}
                <button onClick={() => setEditReminder('')} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--red)', fontFamily:'inherit' }}>
                  Clear
                </button>
              </div>
            )}
          </div>
          <PersonSearchPicker people={people} value={editPersonId} onChange={setEditPersonId} onCreate={findOrCreatePerson} />
          <div style={{ marginBottom:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:13, color:'var(--muted)' }}>Progress</span>
              <span style={{ fontSize:13, fontWeight:700, color:editProgress===100?'var(--green)':'var(--accent)' }}>{editProgress}%</span>
            </div>
            <input type="range" min="0" max="100" step="5" value={editProgress} onChange={e=>setEditProgress(Number(e.target.value))} style={{ width:'100%', accentColor:editProgress===100?'var(--green)':'var(--accent)' }} />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
              {[0,25,50,75,100].map(v=>(
                <button key={v} onClick={()=>setEditProgress(v)} style={{ fontSize:11, color:editProgress===v?'var(--accent)':'var(--hint)', background:'none', border:'none', cursor:'pointer', padding:'2px 4px', fontWeight:editProgress===v?700:400, fontFamily:'inherit' }}>{v}%</button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={handleSave} disabled={!editTitle.trim()||saving}>
              {saving?'Saving…':'Save changes'}
            </button>
            <button className="btn btn-danger" onClick={handleDelete} style={{ padding:'12px 16px' }}>
              {delConfirm?'Sure?':<i className="ti ti-trash" style={{ fontSize:16 }} />}
            </button>
          </div>
          <button className="btn btn-ghost" style={{ width:'100%', marginTop:8 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
const TABS = [
  { key:'today',    label:'Today' },
  { key:'tomorrow', label:'Tomorrow' },
  { key:'upcoming', label:'Upcoming' },
  { key:'all',      label:'All' },
  { key:'done',     label:'Done' },
]

export default function Tasks() {
  const { tasks, people, addTask, updateTask, deleteTask, findOrCreatePerson } = useStore()
  const [activeTab,  setActiveTab]  = useState('today')
  const [showSearch, setShowSearch] = useState(false)
  const [search,     setSearch]     = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [toast,      setToast]      = useState(null)
  const [clearing,   setClearing]   = useState(false)
  const quickAddOpen = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('quickAdd') === '1'

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null),2500) }

  const filtered = useMemo(() => {
    let list = tasks
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t=>t.title.toLowerCase().includes(q)||t.notes?.toLowerCase().includes(q))
    }
    const active = list.filter(t=>t.status!=='done')
    const done   = list.filter(t=>t.status==='done')

    if (activeTab==='today') {
      const r = active.filter(t=>t.status==='in_progress'||!t.due_at||isToday(new Date(t.due_at))||(isPast(new Date(t.due_at))&&!isToday(new Date(t.due_at))))
      return r.sort((a,b)=>{
        const aO=a.due_at&&isPast(new Date(a.due_at))&&!isToday(new Date(a.due_at))
        const bO=b.due_at&&isPast(new Date(b.due_at))&&!isToday(new Date(b.due_at))
        if (aO&&!bO) return -1; if (!aO&&bO) return 1
        if (!a.due_at&&b.due_at) return 1; if (a.due_at&&!b.due_at) return -1
        if (a.due_at&&b.due_at) return new Date(a.due_at)-new Date(b.due_at)
        return 0
      })
    }
    if (activeTab==='tomorrow') {
      return active.filter(t=>t.due_at&&isTomorrow(new Date(t.due_at))).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at))
    }
    if (activeTab==='upcoming') {
      return active.filter(t=>t.due_at&&isFuture(new Date(t.due_at))&&!isToday(new Date(t.due_at))&&!isTomorrow(new Date(t.due_at))).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at))
    }
    if (activeTab==='all') {
      return active.sort((a,b)=>{
        if (!a.due_at&&b.due_at) return 1; if (a.due_at&&!b.due_at) return -1
        if (a.due_at&&b.due_at) return new Date(a.due_at)-new Date(b.due_at)
        return 0
      })
    }
    return done.sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))
  }, [tasks, activeTab, search])

  const tabCounts = useMemo(() => ({
    today:    tasks.filter(t=>t.status!=='done'&&(t.status==='in_progress'||!t.due_at||isToday(new Date(t.due_at))||(isPast(new Date(t.due_at))&&!isToday(new Date(t.due_at))))).length,
    tomorrow: tasks.filter(t=>t.status!=='done'&&t.due_at&&isTomorrow(new Date(t.due_at))).length,
    done:     tasks.filter(t=>t.status==='done').length,
  }), [tasks])

  const handleToggleDone = async (e, task) => {
    e.stopPropagation()
    const isDone = task.status==='done'
    await updateTask(task.id, { status:isDone?'todo':'done', progress:isDone?0:100 })
  }
  const handleUpdate = async (id, updates) => { const { error } = await updateTask(id, updates); if (error) showToast('Update failed') }
  const handleDelete = async (id) => { const { error } = await deleteTask(id); showToast(error?'Delete failed':'Task deleted') }
  const clearDone = async () => {
    setClearing(true)
    const doneTasks = tasks.filter(t=>t.status==='done')
    for (const t of doneTasks) await deleteTask(t.id)
    setClearing(false); showToast(`${doneTasks.length} tasks cleared`)
  }

  const EMPTY = {
    today:    { emoji:'📋', title:'All clear for today!', sub:'Enjoy your day or capture something.' },
    tomorrow: { emoji:'📅', title:'Nothing for tomorrow', sub:'Quick-add a task with tomorrow selected.' },
    upcoming: { emoji:'🗓️', title:'No upcoming tasks', sub:'Tasks with future due dates appear here.' },
    all:      { emoji:'✅', title:'No active tasks', sub:'You\'re all caught up.' },
    done:     { emoji:'🎉', title:'No completed tasks yet', sub:'Tasks you complete will appear here.' },
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding:'max(14px,env(safe-area-inset-top)) 16px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:700 }}>Tasks</h2>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>
            {tasks.filter(t=>t.status!=='done').length} active · {tasks.filter(t=>t.status==='done').length} done
          </div>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          {activeTab==='done'&&tasks.some(t=>t.status==='done') && (
            <button onClick={clearDone} disabled={clearing} style={{ fontSize:13, color:'var(--red)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
              {clearing?'Clearing…':'Clear all'}
            </button>
          )}
          <button onClick={()=>{setShowSearch(s=>!s);setSearch('')}} style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:showSearch?'var(--accent)':'var(--muted)' }}>
            <i className="ti ti-search" style={{ fontSize:20 }} />
          </button>
          <button style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--muted)' }}>
            <i className="ti ti-dots" style={{ fontSize:20 }} />
          </button>
        </div>
      </div>

      {showSearch && (
        <div style={{ padding:'8px 16px 0' }}>
          <div className="search-bar">
            <i className="ti ti-search" />
            <input placeholder="Search tasks…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus />
            {search&&<button onClick={()=>setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', padding:2, color:'var(--muted)' }}><i className="ti ti-x" style={{ fontSize:14 }} /></button>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding:'6px 16px 0' }}>
        <div className="tabs">
          {TABS.map(({ key, label }) => (
            <button key={key} className={`tab ${activeTab===key?'active':''}`} onClick={()=>setActiveTab(key)}>
              {label}
              {tabCounts[key]>0 && (
                <span style={{ marginLeft:4, background:activeTab===key?'var(--accent)':'var(--border-strong)', color:activeTab===key?'#fff':'var(--muted)', borderRadius:10, padding:'1px 6px', fontSize:10, fontWeight:600 }}>
                  {tabCounts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="page-scroll" style={{ paddingTop:14 }}>
        {activeTab!=='done' && <QuickAdd onAdd={addTask} onFindPerson={findOrCreatePerson} people={people} initialOpen={quickAddOpen} />}

        {/* Overdue header */}
        {activeTab==='today'&&filtered.some(t=>t.due_at&&isPast(new Date(t.due_at))&&!isToday(new Date(t.due_at))) && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <i className="ti ti-alert-circle" style={{ fontSize:13, color:'var(--red)' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'var(--red)', textTransform:'uppercase', letterSpacing:.5 }}>Overdue</span>
          </div>
        )}

        {/* Task count */}
        {filtered.length>0 && !search && (
          <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.6, marginBottom:10 }}>
            {activeTab==='today'?'Tasks for today':activeTab==='tomorrow'?'Tomorrow':activeTab==='done'?'Completed':'All tasks'} · {filtered.length}
          </div>
        )}

        {filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:'44px 20px', color:'var(--muted)' }}>
            {search ? (
              <>
                <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
                <div style={{ fontSize:15, fontWeight:500, color:'var(--text)' }}>No tasks match</div>
                <div style={{ fontSize:13, marginTop:4 }}>Try a different search term</div>
              </>
            ) : (
              <>
                <div style={{ fontSize:48, marginBottom:12 }}>{EMPTY[activeTab].emoji}</div>
                <div style={{ fontSize:17, fontWeight:600, color:'var(--text)', marginBottom:6 }}>{EMPTY[activeTab].title}</div>
                <div style={{ fontSize:13 }}>{EMPTY[activeTab].sub}</div>
                {activeTab==='today' && (
                  <button className="btn btn-ghost" style={{ marginTop:16, gap:8 }} onClick={()=>document.querySelector('.page-scroll input')?.focus()}>
                    <i className="ti ti-plus" style={{ fontSize:15 }} /> Add task
                  </button>
                )}
              </>
            )}
          </div>
        ) : filtered.map((task,idx) => {
          const overdue = task.due_at&&isPast(new Date(task.due_at))&&task.status!=='done'&&!isToday(new Date(task.due_at))
          const todayDue = task.due_at&&isToday(new Date(task.due_at))
          const due = dueLabel(task.due_at)
          const isDone = task.status==='done'
          const prevTask = idx>0?filtered[idx-1]:null
          const prevOverdue = prevTask?.due_at&&isPast(new Date(prevTask.due_at))&&!isToday(new Date(prevTask.due_at))
          const showDivider = activeTab==='today'&&prevOverdue&&!overdue

          return (
            <div key={task.id}>
              {showDivider && (
                <div style={{ display:'flex', alignItems:'center', gap:6, margin:'4px 0 10px' }}>
                  <div style={{ flex:1, height:1, background:'var(--border)' }} />
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.4 }}>Today &amp; no date</span>
                  <div style={{ flex:1, height:1, background:'var(--border)' }} />
                </div>
              )}
              <div
                className="card"
                style={{ marginBottom:10, opacity:isDone?.55:1, cursor:'pointer', borderLeft:(task.priority&&PRIORITY_META[task.priority])?`3px solid ${PRIORITY_META[task.priority].color}`:overdue?'3px solid var(--red)':todayDue?'3px solid var(--accent)':'none', paddingLeft:(task.priority&&PRIORITY_META[task.priority])||overdue||todayDue?13:16 }}
                onClick={()=>setSelectedId(task.id)}
              >
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom: isDone?0:10 }}>
                  <div onClick={e=>e.stopPropagation()}>
                    <CircularProgress progress={task.progress||0} done={isDone} color={task.priority&&PRIORITY_META[task.priority]?PRIORITY_META[task.priority].color:overdue?'var(--red)':'var(--accent)'} onClick={e=>handleToggleDone(e,task)} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <div style={{ fontSize:14, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:isDone?'line-through':'none', color:isDone?'var(--muted)':'var(--text)', flex:1, minWidth:0 }}>{task.title}</div>
                      {task.priority && PRIORITY_META[task.priority] && (
                        <span style={{ fontSize:11, fontWeight:700, background:PRIORITY_META[task.priority].bg, color:PRIORITY_META[task.priority].color, padding:'3px 10px', borderRadius:12, flexShrink:0, whiteSpace:'nowrap', display:'flex', alignItems:'center' }}>{PRIORITY_META[task.priority].label}</span>
                      )}
                    </div>
                    {due && <div style={{ fontSize:11, color:due.red?'var(--red)':'var(--muted)', marginTop:2, fontWeight:due.red?600:400 }}>{due.text}</div>}
                    {task.notes && <div style={{ fontSize:11, color:'var(--hint)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.notes}</div>}
                  </div>
                  {task.person && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, background:'var(--bg)', borderRadius:20, padding:'3px 8px 3px 4px', flexShrink:0 }}>
                      <div className={`avatar avatar-sm ${avatarColor(task.person?.name)}`}>{initials(task.person?.name)}</div>
                      <span style={{ fontSize:10, color:'var(--muted)' }}>{task.person?.name?.split(' ')[0]}</span>
                    </div>
                  )}
                </div>
                {!isDone && (
                  <div onClick={e=>e.stopPropagation()} style={{ paddingLeft:50 }}>
                    <SlideToComplete accentColor={task.priority&&PRIORITY_META[task.priority]?PRIORITY_META[task.priority].color:overdue?'var(--red)':'var(--accent)'} onComplete={()=>updateTask(task.id,{ status:'done', progress:100 })} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedId && <TaskModal taskId={selectedId} onClose={()=>setSelectedId(null)} onUpdate={handleUpdate} onDelete={handleDelete} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
