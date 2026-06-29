import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseCapture, analyzeImage, simplifySpokenEnglish } from '../lib/groq'
import { useStore } from '../lib/store'
import { format } from 'date-fns'

const TYPE_META = {
  task:    { icon:'ti-checkbox',       color:'var(--accent)', bg:'var(--accent-soft)',  label:'Task' },
  idea:    { icon:'ti-bulb',           color:'var(--purple)', bg:'var(--purple-soft)', label:'Idea' },
  expense: { icon:'ti-currency-rupee', color:'var(--amber)',  bg:'var(--amber-soft)',  label:'Expense' },
  note:    { icon:'ti-notes',          color:'var(--green)',  bg:'var(--green-soft)',  label:'Note' },
  person:  { icon:'ti-user',           color:'var(--green)',  bg:'var(--green-soft)',  label:'Person' },
  unknown: { icon:'ti-question-mark',  color:'var(--muted)',  bg:'var(--bg)',          label:'Unknown' },
}
const ALL_TYPES = ['task','idea','expense','note','person']
const CAPTURE_DEST = { task:'/tasks', idea:'/idealab', expense:'/vault', note:'/vault', person:'/people' }
const PRESET_TAGS = ['work','personal','finance','health','family','learning','travel','urgent','idea','reference']
const VAULT_PRESET = ['work','personal','finance','health','family','learning','travel','reference','receipt','document']

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

// Reusable tag chips + manual input
function TagSection({ tags, onChange, presets }) {
  const [custom, setCustom] = useState('')
  const toggle = (t) => onChange(tags.includes(t) ? tags.filter(x=>x!==t) : [...tags, t])
  const addCustom = () => {
    const t = custom.trim().toLowerCase()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setCustom('')
  }
  const all = [...new Set([...presets, ...tags.filter(t=>!presets.includes(t))])]
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.4, marginBottom:8 }}>Tags</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
        {all.map(tag=>(
          <button key={tag} onClick={()=>toggle(tag)} style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:500, border:'1px solid', cursor:'pointer', fontFamily:'inherit', background:tags.includes(tag)?'var(--accent)':'transparent', color:tags.includes(tag)?'#fff':'var(--muted)', borderColor:tags.includes(tag)?'var(--accent)':'var(--border)' }}>
            {tag}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <input className="input" placeholder="Add custom tag…" value={custom} onChange={e=>setCustom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustom()} style={{ fontSize:12, padding:'6px 10px', flex:1 }} />
        <button onClick={addCustom} disabled={!custom.trim()} style={{ padding:'6px 12px', borderRadius:'var(--r)', border:'1px solid var(--border)', background:'var(--accent-soft)', color:'var(--accent)', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>+ Add</button>
      </div>
    </div>
  )
}

function ResultCard({ result, onSave, onEdit, onDiscard, saving }) {
  const meta = TYPE_META[result.type]||TYPE_META.unknown
  const pri = result.priority && PRIORITY_META[result.priority]
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
      <div style={{ background:meta.bg, padding:'14px 16px', display:'flex', alignItems:'center', gap:10 }}>
        <i className={`ti ${meta.icon}`} style={{ fontSize:20, color:meta.color }} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:600, color:meta.color, textTransform:'uppercase', letterSpacing:.4 }}>{meta.label}{result.confidence?` · ${Math.round(result.confidence*100)}%`:''}</div>
          <div style={{ fontSize:16, fontWeight:500, color:'var(--text)', marginTop:2 }}>{result.title}</div>
        </div>
        {pri && <span style={{ fontSize:10, fontWeight:700, background:pri.bg, color:pri.color, padding:'2px 9px', borderRadius:10 }}>{pri.label}</span>}
      </div>
      <div style={{ padding:'14px 16px', background:'var(--surface)' }}>
        {result.body && <div style={{ fontSize:13, color:'var(--muted)', marginBottom:12, lineHeight:1.5 }}>{result.body}</div>}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
          {result.due&&<span className="pill accent"><i className="ti ti-calendar" style={{ fontSize:11 }} /> {new Date(result.due).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
          {result.reminder&&<span className="pill accent"><i className="ti ti-bell" style={{ fontSize:11 }} /> {format(new Date(result.reminder),'d MMM · h:mm a')}</span>}
          {result.amount&&<span className="pill accent"><i className="ti ti-currency-rupee" style={{ fontSize:11 }} />{result.amount}</span>}
          {result.tags?.map(t=><span key={t} className="pill">{t}</span>)}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={onSave} disabled={saving}>
            {saving?<><div className="spinner" style={{ width:14, height:14, borderTopColor:'#fff' }} /> Saving…</>:`Save as ${result.type}`}
          </button>
          <button className="btn btn-ghost" onClick={onEdit} disabled={saving}><i className="ti ti-edit" style={{ fontSize:15 }} /></button>
          {onDiscard&&<button className="btn btn-ghost" onClick={onDiscard} disabled={saving} style={{ color:'var(--muted)' }}><i className="ti ti-x" style={{ fontSize:15 }} /></button>}
        </div>
      </div>
    </div>
  )
}

function EditForm({ result, transcript, imgDataUrl, onConfirm, onCancel }) {
  const [editType,     setEditType]     = useState(result.type||'note')
  const [editTitle,    setEditTitle]    = useState(result.title||'')
  const [editBody,     setEditBody]     = useState(result.body||'')
  const [editAmount,   setEditAmount]   = useState(result.amount!=null?String(result.amount):'')
  const [editVendor,   setEditVendor]   = useState(result.vendor||'')
  const [editDue,      setEditDue]      = useState(result.due?new Date(result.due).toISOString().slice(0,16):'')
  const [editReminder, setEditReminder] = useState(result.reminder?new Date(result.reminder).toISOString().slice(0,16):'')
  const [editReminderMenu, setEditReminderMenu] = useState(false)
  const [editPriority, setEditPriority] = useState(result.priority||'')
  const [editTags,     setEditTags]     = useState(result.tags||[])
  const meta = TYPE_META[editType]||TYPE_META.unknown
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
      {imgDataUrl && <img src={imgDataUrl} alt="" style={{ width:'100%', maxHeight:160, objectFit:'cover' }} />}
      {transcript && (
        <div style={{ background:'var(--bg)', padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--hint)', textTransform:'uppercase', letterSpacing:.4, marginBottom:3 }}>You said</div>
          <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5, fontStyle:'italic' }}>"{transcript}"</div>
          {result._spokenEnglish && result._spokenEnglish !== transcript && (
            <>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:.4, margin:'8px 0 3px' }}>Simple English</div>
              <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.5 }}>{result._spokenEnglish}</div>
            </>
          )}
        </div>
      )}
      <div style={{ background:meta.bg, padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ fontSize:11, fontWeight:600, color:meta.color, textTransform:'uppercase', letterSpacing:.4, marginBottom:8 }}>Edit before saving</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {ALL_TYPES.map(t=>(
            <button key={t} onClick={()=>setEditType(t)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:500, border:'1px solid', cursor:'pointer', fontFamily:'inherit', background:editType===t?TYPE_META[t].color:'transparent', color:editType===t?'#fff':'var(--muted)', borderColor:editType===t?TYPE_META[t].color:'var(--border)' }}>
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding:'14px 16px', background:'var(--surface)', display:'flex', flexDirection:'column', gap:10 }}>
        <input className="input" placeholder="Title *" value={editTitle} onChange={e=>setEditTitle(e.target.value)} autoFocus />
        <textarea className="input" placeholder="Details (optional)" value={editBody} onChange={e=>setEditBody(e.target.value)} style={{ minHeight:70 }} />
        {editType==='task' && (
          <>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.4, marginBottom:6 }}>Priority</div>
              <div style={{ display:'flex', gap:6 }}>
                {Object.entries(PRIORITY_META).map(([key,p])=>(
                  <button key={key} onClick={()=>setEditPriority(editPriority===key?'':key)} style={{ flex:1, padding:'7px 0', borderRadius:'var(--r-sm)', border:'1.5px solid', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, background:editPriority===key?p.bg:'transparent', color:editPriority===key?p.color:'var(--muted)', borderColor:editPriority===key?p.color:'var(--border)' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <input className="input" type="datetime-local" value={editDue} onChange={e=>setEditDue(e.target.value)} placeholder="Due date (optional)" />
            <div style={{ display:'flex', alignItems:'center', gap:8, position:'relative' }}>
              <button onClick={()=>setEditReminderMenu(!editReminderMenu)} style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid', borderColor:editReminder?'var(--amber)':'var(--border)', background:editReminder?'var(--amber-soft)':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:editReminder?'var(--amber)':'var(--muted)', fontSize:18, fontFamily:'inherit' }} title="Set reminder">
                <i className={`ti ${editReminder?'ti-bell-filled':'ti-bell'}`} style={{ fontSize:18 }} />
              </button>
              <span style={{ fontSize:12, color:'var(--muted)', flex:1 }}>{editReminder?'Reminder set':'Set reminder'}</span>
              {editReminderMenu && (
                <div style={{ position:'absolute', top:40, left:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', zIndex:10, minWidth:140 }}>
                  {[{ label:'5 min', mins:5 }, { label:'15 min', mins:15 }, { label:'30 min', mins:30 }, { label:'1 hour', mins:60 }].map(opt => (
                    <button key={opt.mins} onClick={() => { setEditReminder(new Date(Date.now()+opt.mins*60000).toISOString().slice(0,16)); setEditReminderMenu(false) }} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--text)', borderBottom:'1px solid var(--border)', fontFamily:'inherit' }}>
                      {opt.label}
                    </button>
                  ))}
                  <button onClick={() => { setEditReminder(''); setEditReminderMenu(false) }} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--red)', fontFamily:'inherit' }}>
                    Clear
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {editType==='expense' && (
          <div style={{ display:'flex', gap:8 }}>
            <input className="input" placeholder="Vendor" value={editVendor} onChange={e=>setEditVendor(e.target.value)} style={{ flex:1 }} />
            <input className="input" placeholder="₹ Amount" type="number" min="0" value={editAmount} onChange={e=>setEditAmount(e.target.value)} style={{ width:110 }} />
          </div>
        )}
        <TagSection tags={editTags} onChange={setEditTags} presets={PRESET_TAGS} />
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>{ if(!editTitle.trim()) return; onConfirm({ type:editType, title:editTitle.trim(), body:editBody.trim()||null, amount:editAmount?parseFloat(editAmount):null, vendor:editVendor.trim()||null, due:editDue||null, reminder:editReminder||null, priority:editPriority||null, tags:editTags }) }}>Confirm &amp; save</button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function ImageTasksEditor({ imgAnalysis, imgDataUrl, onSave, onBack }) {
  const [tasks,    setTasks]    = useState(imgAnalysis.tasks?.length>0?imgAnalysis.tasks:[imgAnalysis.title])
  const [due,      setDue]      = useState(imgAnalysis.date?new Date(imgAnalysis.date).toISOString().slice(0,16):'')
  const [reminder, setReminder] = useState('')
  const [reminderMenu, setReminderMenu] = useState(false)
  const [priority, setPriority] = useState('')
  const [saving,   setSaving]   = useState(false)
  const update = (i,val) => setTasks(prev=>prev.map((t,j)=>j===i?val:t))
  const remove = (i) => setTasks(prev=>prev.filter((_,j)=>j!==i))
  const validTasks = tasks.filter(t=>t.trim())
  return (
    <div style={{ marginTop:16 }}>
      <img src={imgDataUrl} alt="" style={{ width:'100%', borderRadius:'var(--r)', maxHeight:160, objectFit:'cover', marginBottom:14 }} />
      <div style={{ fontSize:14, fontWeight:500, marginBottom:10 }}>Review tasks before saving</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
        {tasks.map((t,i)=>(
          <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
            <i className="ti ti-circle-check" style={{ fontSize:16, color:'var(--accent)', flexShrink:0 }} />
            <input className="input" value={t} onChange={e=>update(i,e.target.value)} placeholder={`Task ${i+1}`} style={{ flex:1 }} />
            {tasks.length>1&&<button onClick={()=>remove(i)} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}><i className="ti ti-x" style={{ fontSize:14, color:'var(--muted)' }} /></button>}
          </div>
        ))}
        <button className="btn btn-ghost" style={{ fontSize:13, alignSelf:'flex-start' }} onClick={()=>setTasks(p=>[...p,''])}><i className="ti ti-plus" style={{ fontSize:13 }} /> Add task</button>
      </div>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.4, marginBottom:6 }}>Priority</div>
      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
        {Object.entries(PRIORITY_META).map(([key,p])=>(
          <button key={key} onClick={()=>setPriority(priority===key?'':key)} style={{ flex:1, padding:'7px 0', borderRadius:'var(--r-sm)', border:'1.5px solid', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, background:priority===key?p.bg:'transparent', color:priority===key?p.color:'var(--muted)', borderColor:priority===key?p.color:'var(--border)' }}>
            {p.label}
          </button>
        ))}
      </div>
      <input className="input" type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} style={{ marginBottom:8 }} placeholder="Due date (optional)" />
      <div style={{ display:'flex', alignItems:'center', gap:8, position:'relative', marginBottom:14 }}>
        <button onClick={()=>setReminderMenu(!reminderMenu)} style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid', borderColor:reminder?'var(--amber)':'var(--border)', background:reminder?'var(--amber-soft)':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:reminder?'var(--amber)':'var(--muted)', fontSize:18, fontFamily:'inherit', flexShrink:0 }} title="Set reminder">
          <i className={`ti ${reminder?'ti-bell-filled':'ti-bell'}`} style={{ fontSize:18 }} />
        </button>
        <span style={{ fontSize:12, color:'var(--muted)', flex:1 }}>{reminder?'Reminder set':'Set reminder'}</span>
        {reminderMenu && (
          <div style={{ position:'absolute', top:40, left:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', zIndex:10, minWidth:140 }}>
            {[{ label:'5 min', mins:5 }, { label:'15 min', mins:15 }, { label:'30 min', mins:30 }, { label:'1 hour', mins:60 }].map(opt => (
              <button key={opt.mins} onClick={() => { setReminder(new Date(Date.now()+opt.mins*60000).toISOString().slice(0,16)); setReminderMenu(false) }} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--text)', borderBottom:'1px solid var(--border)', fontFamily:'inherit' }}>
                {opt.label}
              </button>
            ))}
            <button onClick={() => { setReminder(''); setReminderMenu(false) }} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--red)', fontFamily:'inherit' }}>
              Clear
            </button>
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={async()=>{setSaving(true);await onSave(validTasks,due,reminder,priority)}} disabled={saving||validTasks.length===0}>
          {saving?<><div className="spinner" style={{ width:14, height:14, borderTopColor:'#fff' }}/> Saving…</>:`Save ${validTasks.length} Task${validTasks.length!==1?'s':''}`}
        </button>
        <button className="btn btn-ghost" onClick={onBack} disabled={saving}>Back</button>
      </div>
    </div>
  )
}

// Image description editor — preserves the image, lets user add/edit details before saving to vault
function ImageDescEditor({ imgDataUrl, imgAnalysis, onSave, onBack }) {
  const [title,  setTitle]  = useState(imgAnalysis?.title||'')
  const [desc,   setDesc]   = useState(imgAnalysis?.summary||'')
  const [tags,   setTags]   = useState([])
  const [saving, setSaving] = useState(false)
  return (
    <div style={{ marginTop:16 }}>
      <img src={imgDataUrl} alt="" style={{ width:'100%', borderRadius:'var(--r)', maxHeight:220, objectFit:'cover', marginBottom:14 }} />
      <div style={{ fontSize:14, fontWeight:600, marginBottom:10 }}>Add details to this image</div>
      <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} style={{ marginBottom:10 }} />
      <textarea className="input" placeholder="Describe what this image is about…" value={desc} onChange={e=>setDesc(e.target.value)} style={{ minHeight:80, marginBottom:12, fontSize:14 }} autoFocus />
      <TagSection tags={tags} onChange={setTags} presets={VAULT_PRESET} />
      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={async()=>{ setSaving(true); await onSave(title,desc,tags) }} disabled={saving}>
          {saving?<><div className="spinner" style={{ width:14, height:14, borderTopColor:'#fff' }}/> Saving…</>:'Save to Vault'}
        </button>
        <button className="btn btn-ghost" onClick={onBack} disabled={saving}>Back</button>
      </div>
    </div>
  )
}

// Pre-save vault confirmation sheet — shows before saving image to vault
function VaultSaveModal({ imgDataUrl, imgAnalysis, onSave, onClose }) {
  const VAULT_TYPES = ['image','note','receipt','document','screenshot']
  const [title, setTitle] = useState(imgAnalysis?.title||'')
  const [desc,  setDesc]  = useState(imgAnalysis?.summary||'')
  const [type,  setType]  = useState('image')
  const [tags,  setTags]  = useState([])
  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, display:'flex', flexDirection:'column', justifyContent:'flex-end', background:'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:'20px 20px 0 0', maxHeight:'90dvh', overflowY:'auto', maxWidth:430, margin:'0 auto', width:'100%' }} onClick={e=>e.stopPropagation()}>
        {imgDataUrl && <img src={imgDataUrl} alt="" style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:'20px 20px 0 0' }} />}
        <div style={{ padding:'14px 20px calc(20px + env(safe-area-inset-bottom))' }}>
          <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 14px' }} />
          <div style={{ fontSize:11, fontWeight:600, color:'var(--accent)', textTransform:'uppercase', letterSpacing:.4, marginBottom:10 }}>EDITING</div>
          <div style={{ position:'relative', marginBottom:10 }}>
            <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} style={{ fontWeight:500, paddingRight:32 }} />
            {title && <button onClick={()=>setTitle('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:16, padding:4 }} title="Clear title"><i className="ti ti-x" /></button>}
          </div>
          <div style={{ position:'relative', marginBottom:10 }}>
            <textarea className="input" placeholder="Description (AI generated — edit if needed)" value={desc} onChange={e=>setDesc(e.target.value)} style={{ minHeight:70, fontSize:13, paddingRight:32 }} />
            {desc && <button onClick={()=>setDesc('')} style={{ position:'absolute', right:10, top:10, background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:16, padding:4 }} title="Clear description"><i className="ti ti-x" /></button>}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            {VAULT_TYPES.map(t=>(
              <button key={t} onClick={()=>setType(t)} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, border:'1px solid', cursor:'pointer', fontFamily:'inherit', background:type===t?'var(--accent)':'transparent', color:type===t?'#fff':'var(--muted)', borderColor:type===t?'var(--accent)':'var(--border)' }}>{t}</button>
            ))}
          </div>
          <TagSection tags={tags} onChange={setTags} presets={VAULT_PRESET} />
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>onSave({ title:title.trim()||'Image', desc:desc.trim(), type, tags })}>
              <i className="ti ti-device-floppy" style={{ fontSize:14 }} /> Confirm &amp; Save
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhotoSheet({ onCamera, onGallery, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, display:'flex', flexDirection:'column', justifyContent:'flex-end', background:'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:'24px 24px 0 0', maxWidth:430, margin:'0 auto', width:'100%', padding:'12px 0 calc(20px + env(safe-area-inset-bottom))' }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 16px' }} />
        <div style={{ fontSize:14, fontWeight:600, color:'var(--muted)', textAlign:'center', marginBottom:8 }}>Add photo from</div>
        {[
          { icon:'ti-camera', color:'var(--accent)', bg:'var(--accent-soft)', label:'Camera', sub:'Take a new photo', action:onCamera },
          { icon:'ti-photo',  color:'var(--purple)', bg:'var(--purple-soft)', label:'Gallery', sub:'Choose from gallery', action:onGallery },
        ].map(opt=>(
          <button key={opt.label} onClick={opt.action} style={{ display:'flex', alignItems:'center', gap:14, width:'100%', padding:'14px 20px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
            <div style={{ width:44, height:44, borderRadius:12, background:opt.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className={`ti ${opt.icon}`} style={{ fontSize:22, color:opt.color }} />
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:500, color:'var(--text)' }}>{opt.label}</div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>{opt.sub}</div>
            </div>
          </button>
        ))}
        <button onClick={onClose} style={{ display:'block', width:'calc(100% - 32px)', margin:'8px 16px 0', padding:'14px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'inherit', color:'var(--muted)' }}>Cancel</button>
      </div>
    </div>
  )
}

export default function Capture() {
  const navigate = useNavigate()
  const { captures, addCapture, addTask, addIdea, addExpense, addPerson, addVaultItem, findOrCreatePerson } = useStore()

  const [status,          setStatus]          = useState('idle')
  const preEditStatus                          = useRef('done')
  const [input,           setInput]           = useState('')
  const [result,          setResult]          = useState(null)
  const [captureSource,   setCaptureSource]   = useState('text')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [isListening,     setIsListening]     = useState(false)
  const recognitionRef                         = useRef(null)
  const hasVoiceSupport                        = typeof window!=='undefined'&&!!(window.SpeechRecognition||window.webkitSpeechRecognition)
  const [imgDataUrl,      setImgDataUrl]      = useState(null)
  const [imgAnalysis,     setImgAnalysis]     = useState(null)
  const [showPhotoSheet,  setShowPhotoSheet]  = useState(false)
  const [showVaultSave,   setShowVaultSave]   = useState(false)
  const cameraInputRef  = useRef(null)
  const galleryInputRef = useRef(null)
  const [toast, setToast] = useState(null)
  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null),2500) }

  useEffect(() => {
    const loadSharedPayload = async () => {
      const params = new URLSearchParams(window.location.search)
      const hasSharedPayload = params.get('shared') === '1'
      const intent = params.get('intent')
      if (intent === 'voice') setTimeout(() => hasVoiceSupport && handleVoice(), 250)
      if (intent === 'task') setInput('Task: ')
      if (intent === 'note') setInput('Note: ')
      if (!hasSharedPayload || !('caches' in window)) return
      try {
        const cache = await caches.open('memora-share-target')
        const response = await cache.match('/memora/shared-data.json')
        if (!response) return
        const shared = await response.json()
        await cache.delete('/memora/shared-data.json')
        const textParts = [shared.title, shared.text, shared.url].filter(Boolean)
        if (textParts.length) setInput(textParts.join('\n'))
        const firstFile = shared.files?.[0]
        if (firstFile?.dataUrl?.startsWith('data:image/')) {
          setImgDataUrl(firstFile.dataUrl)
          setImgAnalysis({
            type:'photo',
            title:firstFile.name || shared.title || 'Shared image',
            summary:textParts.join('\n') || 'Shared to Memora',
            tasks:[],
            confidence:1
          })
          setStatus('img-confirm')
        } else if (firstFile) {
          await addVaultItem({
            title:firstFile.name || shared.title || 'Shared file',
            file_url:firstFile.dataUrl,
            ocr_text:textParts.join('\n') || null,
            type:firstFile.type?.startsWith('image/') ? 'image' : 'document',
            tags:['shared']
          })
          showToast('Shared file saved to Vault')
        } else if (textParts.length) {
          showToast('Shared text added')
        }
        window.history.replaceState({}, '', '/memora/capture')
      } catch (error) {
        console.error('Shared payload failed', error)
        showToast('Could not open shared item')
      }
    }
    loadSharedPayload()
  }, [])

  const resetAll = () => {
    setStatus('idle'); setInput(''); setResult(null); setVoiceTranscript('')
    setImgDataUrl(null); setImgAnalysis(null); setCaptureSource('text'); setShowVaultSave(false)
  }

  const saveResult = async (r, source) => {
    if (r.type==='task') {
      let person_id = null
      if (r.person) { const p = await findOrCreatePerson(r.person); if(p) person_id = p.id }
      const { data, error } = await addTask({ title:r.title, notes:r.body||null, due_at:r.due||null, reminder_at:r.reminder||null, priority:r.priority||null, status:'todo', progress:0, source:source==='voice'?'voice':'ai_capture', person_id })
      if (!error && r.reminder) scheduleReminder(r.title, r.reminder)
      return { data, error }
    }
    if (r.type==='idea')    return addIdea({ title:r.title, body:r.body||null, tags:r.tags||[], status:'raw', source:source==='voice'?'voice':'capture' })
    if (r.type==='expense') {
      if (!r.amount||r.amount<=0) { showToast('Please enter a valid amount'); return { error:'invalid' } }
      return addExpense({ vendor:r.vendor||r.title, amount:r.amount, notes:r.body||null, date:r.due?.split('T')[0]||new Date().toISOString().split('T')[0] })
    }
    if (r.type==='person') return addPerson({ name:r.person||r.title, role:'other' })
    return addVaultItem({ title:r.title, ocr_text:r.body||null, type:'note', tags:r.tags||[] })
  }

  const handleSubmit = async () => {
    if (!input.trim()) return
    setStatus('parsing')
    try {
      const parsed = await parseCapture(input.trim())
      setResult(parsed); setCaptureSource('text'); preEditStatus.current='done'; setStatus('done')
      addCapture({ raw_input:input.trim(), input_type:'text', ai_result:parsed, classified_as:parsed.type })
    } catch { setStatus('error') }
  }

  const handleSave = async () => {
    if (!result) return
    setStatus('saving')
    const savedType = result.type
    const { error } = await saveResult(result, captureSource)
    if (!error) {
      showToast(`${savedType.charAt(0).toUpperCase()+savedType.slice(1)} saved`)
      resetAll()
      if (savedType==='task') navigate('/tasks')
      else if (savedType==='idea') navigate('/idealab')
    } else if (error!=='invalid') { showToast('Save failed'); setStatus(preEditStatus.current) }
    else setStatus(preEditStatus.current)
  }

  const enterEdit = () => { preEditStatus.current=status; setStatus('editing') }
  const handleEditConfirm = (updated) => { setResult(prev=>({...prev,...updated})); setStatus(preEditStatus.current) }
  const handleEditCancel  = () => setStatus(preEditStatus.current)

  const handleVoice = () => {
    if (!hasVoiceSupport) { showToast('Voice not supported. Use Chrome on Android.'); return }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
    setVoiceTranscript(''); setStatus('voice-recording'); setIsListening(true)
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = navigator.language || 'en-IN'; rec.continuous=true; rec.interimResults=true
    let finalTranscript='', interimTranscript=''
    rec.onresult = (e) => {
      finalTranscript=''; interimTranscript=''
      for (let i=0;i<e.results.length;i++) {
        if (e.results[i].isFinal) finalTranscript+=e.results[i][0].transcript+' '
        else interimTranscript+=e.results[i][0].transcript
      }
      setVoiceTranscript((finalTranscript+interimTranscript).trim())
    }
    rec.onerror = (e) => {
      setIsListening(false)
      if (e.error==='not-allowed') showToast('Microphone permission denied')
      else if (e.error==='no-speech') showToast('No speech detected — try again')
      else if (e.error!=='aborted') showToast(`Voice error: ${e.error}`)
      setStatus('idle'); setVoiceTranscript('')
    }
    rec.onend = async () => {
      setIsListening(false)
      const transcript = finalTranscript.trim()||interimTranscript.trim()
      if (!transcript) { setStatus('idle'); setVoiceTranscript(''); showToast('Nothing captured'); return }
      setStatus('voice-analyzing')
      try {
        const english = await simplifySpokenEnglish(transcript)
        const parsed = await parseCapture(english)
        setInput(english)
        setResult({ ...parsed, _spokenEnglish: english }); setVoiceTranscript(transcript); setCaptureSource('voice')
        preEditStatus.current='voice-editing'; setStatus('voice-editing')
        addCapture({ raw_input:transcript, input_type:'voice', ai_result:{ ...parsed, spoken_input:transcript, simplified_english:english }, classified_as:parsed.type })
      } catch { setInput(transcript); setStatus('idle'); setVoiceTranscript(''); showToast('AI failed — text kept') }
    }
    try { recognitionRef.current=rec; rec.start() } catch { setIsListening(false); setStatus('idle'); showToast('Could not start microphone') }
  }

  const processImageFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result; setImgDataUrl(dataUrl); setStatus('img-analyzing')
      try {
        const analysis = await analyzeImage(dataUrl); setImgAnalysis(analysis); setStatus('img-confirm')
      } catch {
        setImgAnalysis({ type:'image', title:file.name?.replace(/\.[^.]+$/,'')||'Image', summary:'Could not analyze.', tasks:[], confidence:0 })
        setStatus('img-confirm'); showToast('Could not analyze — choose how to save below')
      }
    }
    reader.readAsDataURL(file)
  }
  const handleImageFile = (e) => { const f=e.target.files?.[0]; if(f){processImageFile(f);e.target.value=''} }

  const handleImageTasksSave = async (taskTitles, due, reminder, priority) => {
    for (const title of taskTitles) {
      if (!title.trim()) continue
      const { error } = await addTask({ title:title.trim(), due_at:due||null, reminder_at:reminder||null, priority:priority||null, status:'todo', progress:0, source:'screenshot' })
      if (!error && reminder) scheduleReminder(title, reminder)
    }
    addCapture({ raw_input:imgAnalysis?.summary||imgAnalysis?.title, input_type:'image', ai_result:imgAnalysis, classified_as:'task' })
    showToast(`${taskTitles.length} task${taskTitles.length!==1?'s':''} saved`); resetAll(); navigate('/tasks')
  }

  const handleImageSaveExpense = async () => {
    if (!imgAnalysis?.amount||imgAnalysis.amount<=0) { showToast('No amount detected — save to Vault instead'); return }
    setStatus('img-saving')
    const vendor = imgAnalysis.vendor||imgAnalysis.title
    const { data: vaultItem } = await addVaultItem({ title:vendor, file_url:imgDataUrl, ocr_text:imgAnalysis.summary||null, type:'receipt', tags:['receipt'] })
    await addExpense({ vault_item_id:vaultItem?.id||null, vendor, amount:imgAnalysis.amount, date:imgAnalysis.date?.split('T')[0]||new Date().toISOString().split('T')[0], notes:imgAnalysis.summary||null })
    addCapture({ raw_input:imgAnalysis.summary||imgAnalysis.title, input_type:'image', ai_result:imgAnalysis, classified_as:'expense' })
    showToast('Expense saved'); resetAll()
  }

  const handleVaultSave = async ({ title, desc, type, tags }) => {
    setShowVaultSave(false)
    setStatus('img-saving')
    await addVaultItem({ title, file_url:imgDataUrl, ocr_text:desc||null, type, tags })
    addCapture({ raw_input:imgAnalysis?.summary||title, input_type:'image', ai_result:imgAnalysis, classified_as:'note' })
    showToast('Saved to Vault')
    setStatus('saved')
    setTimeout(() => { resetAll(); navigate('/vault') }, 650)
  }

  const handleImageDescSave = async (title, desc, tags) => {
    setStatus('img-saving')
    await addVaultItem({ title:title||imgAnalysis?.title||'Image', file_url:imgDataUrl, ocr_text:desc||imgAnalysis?.summary||null, type:'image', tags })
    addCapture({ raw_input:desc||imgAnalysis?.summary||title, input_type:'image', ai_result:imgAnalysis, classified_as:'note' })
    showToast('Saved to Vault')
    setStatus('saved')
    setTimeout(() => { resetAll(); navigate('/vault') }, 650)
  }

  const hideTextUI = ['img-analyzing','img-confirm','img-edit-tasks','img-saving','img-edit-desc','voice-recording','voice-analyzing','voice-editing'].includes(status)

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding:'max(14px,env(safe-area-inset-top)) 16px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={()=>navigate(-1)} style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--muted)', display:'flex', alignItems:'center', gap:4, fontSize:15, fontFamily:'inherit' }}>
          <i className="ti ti-arrow-left" style={{ fontSize:20 }} />
        </button>
        <div style={{ fontSize:17, fontWeight:600 }}>Capture</div>
        <button onClick={resetAll} title="Clear / close" style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--muted)' }}>
          <i className="ti ti-x" style={{ fontSize:20 }} />
        </button>
      </div>

      <div className="page-scroll" style={{ paddingTop:20 }}>

        {!hideTextUI && (
          <>
            <div style={{ fontSize:26, fontWeight:700, lineHeight:1.2, marginBottom:4 }}>What's on your mind?</div>
            <div style={{ fontSize:14, color:'var(--muted)', marginBottom:16 }}>Memora will handle the rest.</div>

            {/* Text area with inline Analyse button */}
            <div style={{ position:'relative' }}>
              <textarea
                className="input"
                style={{ minHeight:140, fontSize:15, paddingBottom:52, resize:'none' }}
                placeholder="Type anything – task, idea, expense, note…"
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)) handleSubmit() }}
                disabled={['parsing','saving'].includes(status)}
                autoFocus={status==='idle'}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim()||status==='parsing'}
                style={{ position:'absolute', bottom:10, right:10, display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:'var(--r-full)', border:'none', cursor:'pointer', background:input.trim()?'var(--accent)':'var(--border)', color:input.trim()?'#fff':'var(--muted)', fontSize:12, fontWeight:600, fontFamily:'inherit', touchAction:'manipulation' }}
              >
                {status==='parsing'?<div className="spinner" style={{ width:12, height:12, borderTopColor:input.trim()?'#fff':'var(--muted)' }} />:<i className="ti ti-sparkles" style={{ fontSize:14 }} />}
                Analyse
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:10, marginTop:16, justifyContent:'center' }}>
              {[
                { icon:'ti-microphone', color:'var(--accent)', bg:'var(--accent-soft)', label:'Voice', action:()=>hasVoiceSupport?handleVoice():showToast('Voice not supported — use Chrome'), disabled:!hasVoiceSupport },
                { icon:'ti-camera',     color:'var(--purple)', bg:'var(--purple-soft)', label:'Photo',  action:()=>setShowPhotoSheet(true), disabled:false },
              ].map(btn=>(
                <div key={btn.label} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                  <button onClick={btn.action} disabled={btn.disabled} style={{ width:56, height:56, borderRadius:'50%', background:btn.bg, border:'none', cursor:btn.disabled?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:btn.disabled?.4:1, touchAction:'manipulation' }}>
                    <i className={`ti ${btn.icon}`} style={{ fontSize:24, color:btn.color }} />
                  </button>
                  <span style={{ fontSize:11, color:'var(--muted)', fontWeight:500 }}>{btn.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VOICE RECORDING */}
        {status==='voice-recording' && (
          <div style={{ marginTop:24 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
              <button onClick={handleVoice} style={{ width:80, height:80, borderRadius:'50%', background:'var(--red-soft)', border:'3px solid var(--red)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', animation:'pulse 1.4s ease-in-out infinite' }}>
                <i className="ti ti-player-stop" style={{ fontSize:30, color:'var(--red)' }} />
              </button>
              <div style={{ fontSize:14, color:'var(--red)', fontWeight:600 }}>Tap to stop</div>
            </div>
            <div style={{ marginTop:16, minHeight:60, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 16px', fontSize:15, color:voiceTranscript?'var(--text)':'var(--hint)', lineHeight:1.6, fontStyle:voiceTranscript?'italic':'normal' }}>
              {voiceTranscript?`"${voiceTranscript}"`:'Listening…'}
            </div>
            <button className="btn btn-ghost" style={{ width:'100%', marginTop:10 }} onClick={resetAll}>Cancel</button>
          </div>
        )}

        {/* VOICE ANALYZING */}
        {status==='voice-analyzing' && (
          <div style={{ marginTop:24 }}>
            {voiceTranscript&&<div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 16px', fontSize:14, lineHeight:1.6, fontStyle:'italic', marginBottom:16 }}>"{voiceTranscript}"</div>}
            <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'center', color:'var(--muted)', fontSize:14 }}>
              <div className="spinner" /> Understanding what you said…
            </div>
          </div>
        )}

        {/* VOICE EDIT */}
        {status==='voice-editing'&&result && (
          <div style={{ marginTop:16 }}>
            <EditForm result={result} transcript={voiceTranscript} onConfirm={updated=>{setResult(prev=>({...prev,...updated}));preEditStatus.current='done';setStatus('done')}} onCancel={resetAll} />
          </div>
        )}

        {/* IMAGE ANALYZING */}
        {status==='img-analyzing'&&imgDataUrl && (
          <div style={{ marginTop:16 }}>
            <img src={imgDataUrl} alt="" style={{ width:'100%', borderRadius:'var(--r)', maxHeight:220, objectFit:'cover', marginBottom:16 }} />
            <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'center', color:'var(--muted)', fontSize:14 }}>
              <div className="spinner" /> Understanding your image…
            </div>
          </div>
        )}

        {/* IMAGE CONFIRM */}
        {(status==='img-confirm'||status==='img-saving')&&imgAnalysis&&imgDataUrl&&(()=>{
          const saving = status==='img-saving'
          return (
            <div style={{ marginTop:16 }}>
              <img src={imgDataUrl} alt="" style={{ width:'100%', borderRadius:'var(--r)', maxHeight:220, objectFit:'cover', marginBottom:14 }} />
              <div className="card" style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5 }}>What I see</div>
                  <button onClick={async()=>{ setStatus('img-saving'); await addVaultItem({ title:'Untitled', file_url:imgDataUrl, ocr_text:null, type:'image', tags:[] }); showToast('Saved to Review'); resetAll() }} disabled={saving} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:14, padding:4 }} title="Save as Untitled for review">
                    <i className="ti ti-x" />
                  </button>
                </div>
                <div style={{ fontSize:16, fontWeight:500, marginBottom:4 }}>{imgAnalysis.title}</div>
                <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.5 }}>{imgAnalysis.summary}</div>
                {imgAnalysis.tasks?.length>0 && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.4, marginBottom:8 }}>Detected actions</div>
                    {imgAnalysis.tasks.map((t,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                        <i className="ti ti-circle" style={{ fontSize:11, color:'var(--accent)', marginTop:2 }} />
                        <span style={{ fontSize:13, lineHeight:1.4 }}>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
                {imgAnalysis.amount>0 && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)', display:'flex', gap:20 }}>
                    {imgAnalysis.vendor&&<div><div style={{ fontSize:10, color:'var(--muted)' }}>Vendor</div><div style={{ fontSize:13, fontWeight:500 }}>{imgAnalysis.vendor}</div></div>}
                    <div><div style={{ fontSize:10, color:'var(--muted)' }}>Amount</div><div style={{ fontSize:13, fontWeight:500 }}>₹{imgAnalysis.amount}</div></div>
                  </div>
                )}
              </div>
              <div style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>What do you want to do?</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {(imgAnalysis.tasks?.length>0||['reminder','task','meeting','notes'].includes(imgAnalysis.type)) && (
                  <button onClick={()=>setStatus('img-edit-tasks')} disabled={saving} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'var(--accent-soft)', border:'1px solid var(--accent-mid)', borderRadius:'var(--r)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                    <i className="ti ti-checkbox" style={{ fontSize:20, color:'var(--accent)' }} />
                    <div><div style={{ fontSize:14, fontWeight:500, color:'var(--text)' }}>Save as task{imgAnalysis.tasks?.length>1?`s (${imgAnalysis.tasks.length})`:''}</div><div style={{ fontSize:12, color:'var(--muted)' }}>Create a task from this</div></div>
                  </button>
                )}
                {(imgAnalysis.amount>0||['receipt','expense'].includes(imgAnalysis.type)) && (
                  <button onClick={handleImageSaveExpense} disabled={saving} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'var(--amber-soft)', border:'1px solid var(--amber)', borderRadius:'var(--r)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                    <i className="ti ti-currency-rupee" style={{ fontSize:20, color:'var(--amber)' }} />
                    <div><div style={{ fontSize:14, fontWeight:500, color:'var(--text)' }}>Save as expense</div><div style={{ fontSize:12, color:'var(--muted)' }}>Log this receipt</div></div>
                  </button>
                )}
                <button onClick={async()=>{ setStatus('img-saving'); const r=await parseCapture(imgAnalysis.summary||imgAnalysis.title); setResult(r); preEditStatus.current='done'; setStatus('done') }} disabled={saving} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'var(--accent-soft)', border:'1.5px solid var(--accent)', borderRadius:'var(--r)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                  <i className="ti ti-sparkles" style={{ fontSize:20, color:'var(--accent)' }} />
                  <div>
                    <div style={{ fontSize:14, fontWeight:500, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>Analyse &amp; Organise <span style={{ fontSize:10, fontWeight:600, background:'var(--accent)', color:'#fff', padding:'1px 7px', borderRadius:10 }}>AI</span></div>
                    <div style={{ fontSize:12, color:'var(--muted)' }}>Let AI understand &amp; organise</div>
                  </div>
                </button>
                <button onClick={()=>setShowVaultSave(true)} disabled={saving} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                  <i className="ti ti-photo" style={{ fontSize:20, color:'var(--purple)' }} />
                  <div><div style={{ fontSize:14, fontWeight:500, color:'var(--text)' }}>Save to Vault</div><div style={{ fontSize:12, color:'var(--muted)' }}>Review details before saving</div></div>
                </button>
                <button onClick={resetAll} disabled={saving} style={{ padding:'14px', background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'var(--muted)', fontFamily:'inherit' }}>Discard</button>
              </div>
            </div>
          )
        })()}

        {/* IMAGE TASK EDITOR */}
        {status==='img-edit-tasks'&&imgAnalysis&&imgDataUrl && (
          <ImageTasksEditor imgAnalysis={imgAnalysis} imgDataUrl={imgDataUrl} onSave={handleImageTasksSave} onBack={()=>setStatus('img-confirm')} />
        )}

        {/* IMAGE DESCRIPTION EDITOR */}
        {status==='img-edit-desc'&&imgAnalysis&&imgDataUrl && (
          <ImageDescEditor imgDataUrl={imgDataUrl} imgAnalysis={imgAnalysis} onSave={handleImageDescSave} onBack={()=>setStatus('img-confirm')} />
        )}

        {/* TEXT EDITING */}
        {status==='editing'&&result && (
          <div style={{ marginTop:16 }}>
            <EditForm result={result} onConfirm={handleEditConfirm} onCancel={handleEditCancel} />
          </div>
        )}

        {/* TEXT DONE / SAVING */}
        {(status==='done'||status==='saving')&&result && (
          <div style={{ marginTop:16 }}>
            <ResultCard result={result} onSave={handleSave} onEdit={enterEdit} saving={status==='saving'} />
          </div>
        )}

        {/* ERROR */}
        {status==='error' && (
          <div style={{ marginTop:16 }}>
            <div style={{ padding:'14px 16px', background:'var(--red-soft)', border:'1px solid var(--red)', borderRadius:'var(--r)', color:'var(--red-dark)', fontSize:13, marginBottom:12, lineHeight:1.5 }}>
              AI parsing failed. Check your connection or API key.
            </div>
            <button className="btn btn-ghost" style={{ width:'100%' }} onClick={()=>setStatus('idle')}>Try again</button>
          </div>
        )}

        {/* Recent captures */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:32, marginBottom:10 }}>
          <div className="section-label" style={{ margin:0 }}>Recent captures</div>
          <span style={{ fontSize:12, color:'var(--muted)' }}>{captures.length} total</span>
        </div>
        {captures.length===0 ? (
          <div style={{ textAlign:'center', color:'var(--hint)', fontSize:13, padding:'20px 0' }}>Nothing captured yet.</div>
        ) : captures.slice(0,8).map(c => {
          const m = TYPE_META[c.classified_as]||TYPE_META.unknown
          const dest = CAPTURE_DEST[c.classified_as]
          return (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', marginBottom:8, cursor:dest?'pointer':'default' }} onClick={()=>dest&&navigate(dest)}>
              <div style={{ width:38, height:38, borderRadius:10, background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${m.icon}`} style={{ fontSize:17, color:m.color }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {c.ai_result?.title||c.raw_input?.slice(0,60)||'Untitled'}
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                  {format(new Date(c.created_at),'h:mm a · d MMM')} · {m.label}
                  {c.input_type==='voice'&&<> · <i className="ti ti-microphone" style={{ fontSize:10 }} /></>}
                  {c.input_type==='image'&&<> · <i className="ti ti-photo" style={{ fontSize:10 }} /></>}
                </div>
              </div>
              {dest&&<i className="ti ti-chevron-right" style={{ color:'var(--muted)', fontSize:16 }} />}
            </div>
          )
        })}
      </div>

      <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={handleImageFile} />
      <input ref={galleryInputRef} type="file" accept="image/*"                       style={{ display:'none' }} onChange={handleImageFile} />

      {showPhotoSheet && (
        <PhotoSheet
          onCamera={()=>{ setShowPhotoSheet(false); cameraInputRef.current?.click() }}
          onGallery={()=>{ setShowPhotoSheet(false); galleryInputRef.current?.click() }}
          onClose={()=>setShowPhotoSheet(false)}
        />
      )}
      {showVaultSave && imgDataUrl && (
        <VaultSaveModal imgDataUrl={imgDataUrl} imgAnalysis={imgAnalysis} onSave={handleVaultSave} onClose={()=>setShowVaultSave(false)} />
      )}
      {toast&&<div className="toast">{toast}</div>}
    </div>
  )
}
