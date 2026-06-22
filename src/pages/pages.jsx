import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '../lib/store'
import { expandIdea, generateJournalSummary, brainstormIdeas, analyzeImage } from '../lib/groq'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import Tesseract from 'tesseract.js'
import { SkeletonVaultCard } from '../components/shared/Skeleton'

// Import from Tasks.jsx
export const PRIORITY_META = {
  low:  { color:'var(--green)',  bg:'var(--green-soft)',  label:'Low' },
  med:  { color:'var(--amber)',  bg:'var(--amber-soft)',  label:'Medium' },
  high: { color:'var(--red)',    bg:'var(--red-soft)',    label:'High' },
}

// Schedule reminder notification
function scheduleReminder(title, reminderAt) {
  if (!reminderAt || !('Notification' in window)) return
  const delay = new Date(reminderAt) - Date.now()
  if (delay <= 0) return
  const go = () => new Notification('⏰ Memora Reminder', { body: title, icon: '/memora/icon-192.png' })
  if (Notification.permission === 'granted') { setTimeout(go, Math.min(delay, 2147483647)); return }
  Notification.requestPermission().then(p => { if (p === 'granted') setTimeout(go, Math.min(delay, 2147483647)) })
}

// ── Shared helpers ────────────────────────────────────────────
const AVATAR_COLORS = ['avatar-blue', 'avatar-green', 'avatar-purple', 'avatar-amber', 'avatar-red']
function initials(name) { return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?' }
function avatarColor(name) { const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length; return AVATAR_COLORS[idx] }

function useToast() {
  const [toast, setToast] = useState(null)
  const show = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }
  return [toast, show]
}

// ── People ────────────────────────────────────────────────────
const ROLE_STYLE = {
  client:   { bg: 'var(--accent-soft)',  color: 'var(--accent-dark)' },
  team:     { bg: 'var(--green-soft)',   color: 'var(--green-dark)' },
  personal: { bg: 'var(--purple-soft)', color: 'var(--purple-dark)' },
  other:    { bg: 'var(--bg)',           color: 'var(--muted)' }
}

function PersonModal({ person, tasks, onClose }) {
  const personTasks = tasks.filter(t => t.person_id === person.id)
  const rs = ROLE_STYLE[person.role] || ROLE_STYLE.other
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', maxHeight: '75dvh', overflowY: 'auto', maxWidth: 430, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div className={`avatar avatar-lg ${avatarColor(person.name)}`}>{initials(person.name)}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>{person.name}</div>
            <span style={{ fontSize: 11, fontWeight: 500, background: rs.bg, color: rs.color, padding: '2px 10px', borderRadius: 20, display: 'inline-block', marginTop: 4 }}>{person.role || 'other'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px' }}>
            <div style={{ fontSize: 20, fontWeight: 500 }}>{personTasks.length}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Tasks together</div>
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{person.last_interaction ? formatDistanceToNow(new Date(person.last_interaction), { addSuffix: true }) : 'Never'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Last interaction</div>
          </div>
        </div>
        {personTasks.length > 0 && (
          <>
            <div className="section-label">Tasks with {person.name.split(' ')[0]}</div>
            <div className="card" style={{ padding: '4px 16px' }}>
              {personTasks.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < personTasks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: t.status === 'done' ? 'var(--green)' : t.status === 'in_progress' ? 'var(--accent)' : 'var(--border-strong)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</div>
                    {t.due_at && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{format(new Date(t.due_at), 'EEE d MMM')}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 500, color: t.status === 'done' ? 'var(--green)' : 'var(--muted)' }}>{t.progress}%</span>
                </div>
              ))}
            </div>
          </>
        )}
        {personTasks.length === 0 && <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>No tasks yet.</div>}
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function AddPersonModal({ onClose, onSave }) {
  const ROLES = ['client', 'team', 'personal', 'vendor', 'other']
  const [name,    setName]    = useState('')
  const [role,    setRole]    = useState('other')
  const [company, setCompany] = useState('')
  const [saving,  setSaving]  = useState(false)
  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), role, notes: company.trim() || null })
    setSaving(false); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '16px 20px calc(24px + env(safe-area-inset-bottom))', maxWidth: 430, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Add person</div>
        <input className="input" placeholder="Name *" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 10 }} autoFocus />
        <input className="input" placeholder="Company / vendor (optional)" value={company} onChange={e => setCompany(e.target.value)} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 8 }}>Role</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {ROLES.map(r => (
            <button key={r} onClick={() => setRole(r)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: role === r ? 'var(--accent-soft)' : 'transparent', color: role === r ? 'var(--accent)' : 'var(--muted)', borderColor: role === r ? 'var(--accent)' : 'var(--border)', textTransform: 'capitalize' }}>{r}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : 'Add person'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function People() {
  const { people, tasks, addPerson } = useStore()
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [toast, showToast] = useToast()
  const filtered = people.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>People</h2>
        <button onClick={() => setShowAdd(true)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-soft)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-plus" style={{ fontSize: 18, color: 'var(--accent)' }} />
        </button>
      </div>
      <div style={{ padding: '0 16px' }}>
        <div className="search-bar">
          <i className="ti ti-search" />
          <input placeholder="Search people…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="page-scroll" style={{ paddingTop: 4 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
            {search ? 'No people found.' : (
              <div>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>No people yet</div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>People are auto-tagged from your captures, or you can add them manually.</div>
                <button className="btn btn-ghost" onClick={() => setShowAdd(true)}><i className="ti ti-plus" style={{ fontSize: 14 }} /> Add person</button>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: '4px 16px' }}>
            {filtered.map((person, i) => {
              const personTasks = tasks.filter(t => t.person_id === person.id)
              const rs = ROLE_STYLE[person.role] || ROLE_STYLE.other
              return (
                <div key={person.id} onClick={() => setSelected(person)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                  <div className={`avatar avatar-lg ${avatarColor(person.name)}`}>{initials(person.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{person.name}</div>
                    <span style={{ fontSize: 10, fontWeight: 500, background: rs.bg, color: rs.color, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginTop: 3, textTransform: 'capitalize' }}>{person.role || 'other'}</span>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{personTasks.length} tasks · {person.last_interaction ? `Last: ${formatDistanceToNow(new Date(person.last_interaction), { addSuffix: true })}` : 'No interaction yet'}</div>
                  </div>
                  <i className="ti ti-chevron-right" style={{ color: 'var(--muted)', fontSize: 16 }} />
                </div>
              )
            })}
          </div>
        )}
        <div className="nudge" style={{ marginTop: 16 }}>
          <i className="ti ti-sparkles nudge-icon" />
          <div className="nudge-text">People are <strong>auto-tagged</strong> from your captures, tasks, and notes.</div>
        </div>
      </div>
      {selected && <PersonModal person={selected} tasks={tasks} onClose={() => setSelected(null)} />}
      {showAdd && <AddPersonModal onClose={() => setShowAdd(false)} onSave={async (data) => { const { error } = await addPerson(data); if (!error) showToast('Person added'); else showToast('Failed to add') }} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── Vault ─────────────────────────────────────────────────────
const VAULT_META = {
  screenshot: { icon: 'ti-screenshot', bg: 'var(--accent-soft)',  color: 'var(--accent)' },
  document:   { icon: 'ti-file-text',  bg: 'var(--bg)',           color: 'var(--muted)' },
  receipt:    { icon: 'ti-receipt',    bg: 'var(--amber-soft)',   color: 'var(--amber)' },
  image:      { icon: 'ti-photo',      bg: 'var(--purple-soft)',  color: 'var(--purple)' },
  note:       { icon: 'ti-notes',      bg: 'var(--green-soft)',   color: 'var(--green)' },
}
const VAULT_CATS = ['all', 'image', 'note', 'receipt', 'document', 'screenshot']

const VAULT_TYPES = ['image','note','receipt','document','screenshot']

// Vault item detail modal — with edit mode
function VaultItemModal({ item, onClose, onDelete, onUpdate }) {
  const [confirming, setConfirming] = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [editTitle,  setEditTitle]  = useState(item.title || '')
  const [editDesc,   setEditDesc]   = useState(item.ocr_text || '')
  const [editType,   setEditType]   = useState(item.type || 'note')
  const meta = VAULT_META[item.type] || VAULT_META.note

  const handleSaveEdit = async () => {
    setSaving(true)
    await onUpdate(item.id, { title: editTitle.trim() || 'Untitled', ocr_text: editDesc.trim() || null, type: editType })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', maxHeight: '85dvh', overflowY: 'auto', maxWidth: 430, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
        {/* Image preview */}
        {item.file_url && (
          <img src={item.file_url} alt={item.title} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: '20px 20px 0 0' }} />
        )}
        {!item.file_url && (
          <div style={{ height: 100, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '20px 20px 0 0' }}>
            <i className={`ti ${meta.icon}`} style={{ fontSize: 40, color: meta.color }} />
          </div>
        )}
        <div style={{ padding: '16px 20px calc(20px + env(safe-area-inset-bottom))' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />

          {editing ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 10 }}>Editing</div>
              <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ marginBottom: 10, fontWeight: 500 }} placeholder="Title" autoFocus />
              <textarea className="input" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ minHeight: 80, marginBottom: 10, fontSize: 13 }} placeholder="Description / content" />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {VAULT_TYPES.map(t => (
                  <button
                    key={t} onClick={() => setEditType(t)}
                    style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit',
                      background: editType === t ? 'var(--accent)' : 'transparent',
                      color: editType === t ? '#fff' : 'var(--muted)',
                      borderColor: editType === t ? 'var(--accent)' : 'var(--border)' }}
                  >{t}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>{item.title || 'Untitled'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 500, background: meta.bg, color: meta.color, padding: '3px 10px', borderRadius: 20 }}>{item.type}</span>
                {item.tags?.map(t => <span key={t} className="pill" style={{ fontSize: 10 }}>{t}</span>)}
                <span style={{ fontSize: 10, color: 'var(--hint)', padding: '3px 0' }}>{item.created_at ? format(new Date(item.created_at), 'd MMM yyyy') : ''}</span>
              </div>
              {item.ocr_text && (
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)', padding: '12px 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
                  {item.ocr_text}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditing(true)}>
                  <i className="ti ti-edit" style={{ fontSize: 14 }} /> Edit
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                  onClick={() => { if (!confirming) { setConfirming(true); return } onDelete(item.id); onClose() }}
                >
                  <i className="ti ti-trash" style={{ fontSize: 14 }} />
                  {confirming ? 'Confirm?' : 'Delete'}
                </button>
                <button className="btn btn-ghost" onClick={onClose}>Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const VAULT_PRESET_TAGS = ['work','personal','finance','health','family','learning','travel','reference','receipt','document']
const isGenericTitle = (t) => !t || /^image\d*$/i.test(t) || /^img/i.test(t) || /^photo/i.test(t) || /^screenshot/i.test(t) || /\.[a-z]{3,4}$/.test(t)

function VaultTagSection({ tags, onChange }) {
  const [custom, setCustom] = useState('')
  const toggle = (tag) => onChange(tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag])
  const addCustom = () => { const t = custom.trim().toLowerCase(); if (t && !tags.includes(t)) onChange([...tags, t]); setCustom('') }
  const all = [...new Set([...VAULT_PRESET_TAGS, ...tags.filter(t => !VAULT_PRESET_TAGS.includes(t))])]
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 10 }}>Tags</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {all.map(tag => (
          <button key={tag} onClick={() => toggle(tag)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', background: tags.includes(tag) ? 'var(--accent)' : 'transparent', color: tags.includes(tag) ? '#fff' : 'var(--muted)', borderColor: tags.includes(tag) ? 'var(--accent)' : 'var(--border)' }}>
            {tag}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" placeholder="Add tag…" value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()} style={{ fontSize: 12, padding: '8px 12px', flex: 1 }} />
        <button onClick={addCustom} disabled={!custom.trim()} style={{ padding: '8px 14px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--accent-soft)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>+ Add</button>
      </div>
    </div>
  )
}

// Add to Vault modal with AI image analysis
function AddVaultModal({ onClose, onSave }) {
  const [tab, setTab]         = useState('text')
  const [saving, setSaving]   = useState(false)

  // text
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [personalNote, setPersonalNote] = useState('')
  const [selectedTags, setSelectedTags] = useState([])

  // image — AI powered
  const [imgPreview, setImgPreview] = useState(null)
  const [imgFile, setImgFile]       = useState(null)
  const [imgTitle, setImgTitle]     = useState('')
  const [imgDesc, setImgDesc]       = useState('')
  const [analyzing, setAnalyzing]   = useState(false)
  const [analyzed, setAnalyzed]     = useState(false)
  const [needsContext, setNeedsContext] = useState(false)
  const fileRef = useRef(null)

  const toggleTag = (tag) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev, tag])

  // audio
  const [recording, setRecording]   = useState(false)
  const [transcript, setTranscript] = useState('')
  const [audioTitle, setAudioTitle] = useState('')
  const [recTime, setRecTime]       = useState(0)
  const recRef   = useRef(null)
  const timerRef = useRef(null)

  const handleImageFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setImgFile(file); setImgTitle(file.name.replace(/\.[^.]+$/, '')); setImgDesc(''); setAnalyzed(false)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result
      setImgPreview(dataUrl)
      // Auto-analyze with AI vision
      setAnalyzing(true)
      try {
        const analysis = await analyzeImage(dataUrl)
        setImgTitle(analysis.title || file.name.replace(/\.[^.]+$/, ''))
        setImgDesc(analysis.summary || '')
        setAnalyzed(true)
        const lowConf = !analysis.confidence || analysis.confidence < 0.45
        const genericName = isGenericTitle(analysis.title)
        setNeedsContext(lowConf || genericName)
      } catch {
        setAnalyzed(false)
        setNeedsContext(true)
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-IN'
    rec.onresult = (e) => { const t = Array.from(e.results).map(r => r[0].transcript).join(' '); setTranscript(t) }
    rec.onerror = () => stopRecording()
    rec.start(); recRef.current = rec; setRecording(true); setRecTime(0)
    timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000)
  }
  const stopRecording = () => { recRef.current?.stop(); clearInterval(timerRef.current); setRecording(false) }
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleSave = () => {
    if (needsContext && tab === 'image' && !imgDesc.trim()) return
    if (tab === 'text') {
      if (!title.trim()) return
      onSave({ title: title.trim(), ocr_text: [body.trim(), personalNote.trim()].filter(Boolean).join('\n\n') || null, type: 'note', tags: selectedTags })
    } else if (tab === 'image') {
      onSave({ title: imgTitle.trim() || 'Image', file_url: imgPreview, ocr_text: [imgDesc, personalNote.trim()].filter(Boolean).join('\n\n') || null, type: 'image', tags: selectedTags })
    } else {
      onSave({ title: audioTitle.trim() || `Voice note · ${format(new Date(), 'h:mm a')}`, ocr_text: [transcript, personalNote.trim()].filter(Boolean).join('\n\n') || null, type: 'note', tags: ['voice', ...selectedTags] })
    }
    onClose()
  }

  const canSave = tab === 'text' ? !!title.trim() : tab === 'image' ? (!!imgPreview && (!needsContext || !!imgDesc.trim())) : !!transcript

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '0 0 calc(16px + env(safe-area-inset-bottom))', maxWidth: 430, margin: '0 auto', width: '100%', maxHeight: '90dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>Add to Vault</div>
        </div>

        <div className="tabs" style={{ padding: '0 20px' }}>
          {['text', 'image', 'audio'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize', flex: 1 }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: '16px 20px 0' }}>
          {/* TEXT */}
          {tab === 'text' && (
            <>
              <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 10 }} autoFocus />
              <textarea className="input" placeholder="Content (optional)" value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 100, marginBottom: 10 }} />
              <VaultTagSection tags={selectedTags} onChange={setSelectedTags} />
            </>
          )}

          {/* IMAGE — AI analyzed */}
          {tab === 'image' && (
            <>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
              {!imgPreview ? (
                <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border-strong)', borderRadius: 'var(--r)', height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
                  <i className="ti ti-photo-up" style={{ fontSize: 32, color: 'var(--muted)' }} />
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Tap to choose an image</div>
                </div>
              ) : (
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <img src={imgPreview} alt="" style={{ width: '100%', borderRadius: 'var(--r)', maxHeight: 200, objectFit: 'cover' }} />
                  <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 20, color: '#fff', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>Change</button>
                </div>
              )}

              {analyzing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
                  <div className="spinner" style={{ width: 14, height: 14 }} /> AI is analyzing your image…
                </div>
              )}

              {analyzed && !needsContext && (
                <div style={{ background: 'var(--accent-soft)', borderRadius: 'var(--r-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--accent-dark)', marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <i className="ti ti-sparkles" style={{ fontSize: 13 }} /> AI analyzed · you can edit below
                </div>
              )}

              {needsContext && analyzed && (
                <div style={{ background: 'var(--amber-soft)', border: '1.5px solid var(--amber)', borderRadius: 'var(--r-sm)', padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--amber-dark)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="ti ti-help-circle" style={{ fontSize: 14 }} /> What is this image about?
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--amber-dark)', opacity: .8 }}>AI couldn't fully understand this image. Please describe it below.</div>
                </div>
              )}

              <input className="input" placeholder="Title" value={imgTitle} onChange={e => setImgTitle(e.target.value)} style={{ marginBottom: 10 }} />
              <textarea className="input" placeholder={needsContext ? 'Describe what this image is about (required)…' : 'Description (auto-filled by AI)'} value={imgDesc} onChange={e => setImgDesc(e.target.value)} style={{ minHeight: 70, marginBottom: 10, borderColor: needsContext && !imgDesc.trim() ? 'var(--amber)' : undefined }} />
              <VaultTagSection tags={selectedTags} onChange={setSelectedTags} />
            </>
          )}

          {/* AUDIO */}
          {tab === 'audio' && (
            <>
              {!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>Voice input requires Chrome on Android.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0 16px' }}>
                    <button onClick={recording ? stopRecording : startRecording} style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: recording ? 'var(--red-soft)' : 'var(--accent-soft)', animation: recording ? 'pulse 1.4s ease-in-out infinite' : 'none' }}>
                      <i className={`ti ${recording ? 'ti-player-stop' : 'ti-microphone'}`} style={{ fontSize: 28, color: recording ? 'var(--red)' : 'var(--accent)' }} />
                    </button>
                    <div style={{ fontSize: 13, color: recording ? 'var(--red)' : 'var(--muted)', fontWeight: recording ? 500 : 400 }}>
                      {recording ? `Recording… ${formatTime(recTime)}` : transcript ? 'Tap to re-record' : 'Tap to start recording'}
                    </div>
                  </div>
                  {transcript && (
                    <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 10, border: '1px solid var(--border)', maxHeight: 120, overflowY: 'auto' }}>
                      {transcript}
                    </div>
                  )}
                  <input className="input" placeholder="Title (optional)" value={audioTitle} onChange={e => setAudioTitle(e.target.value)} />
                </>
              )}
            </>
          )}

          {/* Optional personal note */}
          {(tab === 'text' || tab === 'image' || tab === 'audio') && (
            <textarea
              className="input"
              placeholder="Personal note (optional)…"
              value={personalNote}
              onChange={e => setPersonalNote(e.target.value)}
              style={{ minHeight: 56, marginTop: 10, fontSize: 13 }}
            />
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!canSave || analyzing}>
              Save to Vault
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewModal({ images, onUpdate, onClose }) {
  const [idx, setIdx]       = useState(0)
  const [context, setContext] = useState('')
  const [saving, setSaving] = useState(false)

  const current = images[idx]
  if (!current) { onClose(); return null }

  const advance = () => {
    setContext('')
    if (idx < images.length - 1) setIdx(i => i + 1)
    else onClose()
  }

  const handleSave = async () => {
    if (!context.trim()) return
    setSaving(true)
    await onUpdate(current.id, { ocr_text: context.trim() })
    setSaving(false)
    advance()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', maxWidth: 430, margin: '0 auto', width: '100%', maxHeight: '90dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Add context</div>
            <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', padding: '3px 10px', borderRadius: 20 }}>{idx + 1} / {images.length}</span>
          </div>
        </div>

        <img src={current.file_url} alt={current.title} style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />

        <div style={{ padding: '14px 20px calc(16px + env(safe-area-inset-bottom))' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{current.title}</div>
          {current.ocr_text && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{current.ocr_text}</div>}

          <div style={{ fontSize: 11, color: 'var(--amber-dark)', fontWeight: 600, marginBottom: 6 }}>
            <i className="ti ti-help-circle" style={{ marginRight: 4 }} /> What's in this image?
          </div>
          <textarea
            className="input"
            placeholder="Describe what this image is about…"
            value={context}
            onChange={e => setContext(e.target.value)}
            style={{ minHeight: 70, marginBottom: 12, fontSize: 14 }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1, gap: 6 }} onClick={handleSave} disabled={!context.trim() || saving}>
              {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> Saving…</> : `Save & ${idx < images.length - 1 ? 'Next' : 'Done'}`}
            </button>
            <button className="btn btn-ghost" onClick={advance}>Skip</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Vault() {
  const { vaultItems, addVaultItem, deleteVaultItem, updateVaultItem, loading, expenses, ideas, addIdea } = useStore()
  const [cat, setCat]           = useState('all')
  const [search, setSearch]     = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showAdd, setShowAdd]   = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [selected, setSelected]     = useState(null)
  const [multiSelect, setMultiSelect]   = useState(false)
  const [selectedIds, setSelectedIds]   = useState(new Set())
  const [cardMenu, setCardMenu]         = useState(null)
  const [showFilter, setShowFilter]     = useState(false)
  const [filterDays, setFilterDays]     = useState(null)
  const longPressTimer = useRef(null)
  const [toast, showToast] = useToast()

  const unclearedImages = vaultItems.filter(v => v.type === 'image' && (!v.ocr_text || v.ocr_text.trim().length < 25))

  const filtered = vaultItems.filter(v => {
    if (cat === 'review') {
      return v.type === 'image' && (!v.ocr_text || v.ocr_text.trim().length < 25)
    }
    if (cat !== 'all' && v.type !== cat) return false
    if (search && !v.title?.toLowerCase().includes(search.toLowerCase()) && !v.ocr_text?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterDays !== null) {
      const itemDate = new Date(v.created_at)
      const cutoff = new Date(Date.now() - filterDays * 86400000)
      if (itemDate < cutoff) return false
    }
    return true
  })

  const handleAdd = async (item) => {
    setUploading(true)
    const { error } = await addVaultItem(item)
    setUploading(false)
    if (!error) showToast('Saved to vault')
    else showToast('Save failed')
  }

  const handleDelete = async (id) => {
    const { error } = await deleteVaultItem(id)
    if (!error) showToast('Deleted')
    else showToast('Delete failed')
  }

  const handleUpdate = async (id, updates) => {
    const { error } = await updateVaultItem(id, updates)
    if (!error) { showToast('Updated'); setSelected(null) }
    else showToast('Update failed')
  }

  const handleDeleteSelected = async () => {
    for (const id of selectedIds) await deleteVaultItem(id)
    setSelectedIds(new Set()); setMultiSelect(false); showToast(`${selectedIds.size} items deleted`)
  }

  const handleAddSelectedToIdea = async () => {
    const items = vaultItems.filter(v => selectedIds.has(v.id))
    const body = items.map(v => `• ${v.title}: ${v.ocr_text || ''}`).join('\n').slice(0, 600)
    await addIdea({ title: `Idea from ${items.length} vault item${items.length !== 1 ? 's' : ''}`, body, tags: [], status: 'raw', source: 'vault' })
    setSelectedIds(new Set()); setMultiSelect(false); showToast('Added to IdeaLab')
  }

  const startLongPress = (item) => {
    longPressTimer.current = setTimeout(() => {
      setMultiSelect(true)
      setSelectedIds(new Set([item.id]))
    }, 600)
  }
  const cancelLongPress = () => clearTimeout(longPressTimer.current)

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  // Receipts dashboard data
  const now = new Date()
  const monthReceipts = (expenses || []).filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const monthTotal = monthReceipts.reduce((s, e) => s + Number(e.amount), 0)
  const vendorTotals = monthReceipts.reduce((acc, e) => { acc[e.vendor] = (acc[e.vendor] || 0) + Number(e.amount); return acc }, {})
  const topVendors = Object.entries(vendorTotals).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Vault</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>All your captures, organised</div>
        </div>
        <div style={{ display: 'flex', gap: 14, paddingTop: 3 }}>
          <i className="ti ti-search" style={{ fontSize: 20, color: showSearch ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer' }} onClick={() => setShowSearch(s => !s)} />
          <i className="ti ti-plus" style={{ fontSize: 20, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setShowAdd(true)} />
        </div>
      </div>

      {showSearch && (
        <div style={{ padding: '8px 16px 0' }}>
          <div className="search-bar">
            <i className="ti ti-search" />
            <input placeholder="Search vault…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            {search && <i className="ti ti-x" style={{ fontSize: 14, color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setSearch('')} />}
          </div>
        </div>
      )}

      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 6, padding: '10px 0', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
          {['review', ...VAULT_CATS].map(c => (
            <button key={c} className={`pill ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)} style={{ textTransform: 'capitalize', fontSize: 12, fontWeight: c === 'review' ? 600 : 500 }}>
              {c === 'review' ? '📋 Review' : c}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, position: 'relative' }}>
            <button onClick={() => setShowFilter(!showFilter)} style={{ background: showFilter ? 'var(--accent-soft)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: showFilter ? 'var(--accent)' : 'var(--muted)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-filter" style={{ fontSize: 13 }} /> Filter
            </button>
            {showFilter && (
              <div style={{ position: 'absolute', top: 32, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, minWidth: 160, padding: 0 }}>
                {[
                  { label: 'All time', days: null },
                  { label: 'Last 7 days', days: 7 },
                  { label: 'Last 30 days', days: 30 },
                  { label: 'Last 90 days', days: 90 },
                ].map(opt => (
                  <button key={opt.days} onClick={() => { setFilterDays(opt.days); setShowFilter(false) }} style={{ display: 'block', width: '100%', padding: '10px 14px', background: filterDays === opt.days ? 'var(--accent-soft)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: filterDays === opt.days ? 'var(--accent)' : 'var(--text)', borderBottom: '1px solid var(--border)', fontFamily: 'inherit' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-select action bar */}
      {multiSelect && (
        <div style={{ padding: '8px 16px', background: 'var(--accent-soft)', borderBottom: '1px solid var(--accent-mid)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setMultiSelect(false); setSelectedIds(new Set()) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, fontFamily: 'inherit', fontWeight: 500 }}>
            <i className="ti ti-x" style={{ fontSize: 14 }} /> Cancel
          </button>
          <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, flex: 1 }}>{selectedIds.size} selected</span>
          {selectedIds.size > 0 && (
            <>
              <button onClick={handleAddSelectedToIdea} style={{ background: 'var(--purple-soft)', border: 'none', color: 'var(--purple-dark)', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}>+ IdeaLab</button>
              <button onClick={handleDeleteSelected} style={{ background: 'var(--red-soft)', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
            </>
          )}
        </div>
      )}

      <div className="page-scroll" style={{ paddingTop: 4 }}>
        {/* Receipts accounting dashboard */}
        {cat === 'receipt' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ background: 'linear-gradient(135deg, var(--amber-soft), #FEF3C7)', borderRadius: 'var(--r)', padding: '16px', marginBottom: 10, border: '1px solid var(--amber)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber-dark)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4 }}>This month</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>₹{Math.round(monthTotal).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{monthReceipts.length} expense{monthReceipts.length !== 1 ? 's' : ''} · {format(now, 'MMMM yyyy')}</div>
            </div>
            {topVendors.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 10 }}>Top vendors</div>
                {topVendors.map(([vendor, amt]) => (
                  <div key={vendor} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{vendor}</div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--amber)', borderRadius: 2, width: `${monthTotal > 0 ? (amt / monthTotal) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber-dark)', flexShrink: 0 }}>₹{Math.round(amt).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
            {monthReceipts.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '4px 14px', marginTop: 10 }}>
                {monthReceipts.slice(0, 10).map((e, i) => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < Math.min(monthReceipts.length, 10) - 1 ? '1px solid var(--border)' : 'none' }}>
                    <i className="ti ti-receipt" style={{ fontSize: 15, color: 'var(--amber)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{e.vendor || 'Unknown'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{e.date}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>₹{Math.round(e.amount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
            {monthReceipts.length === 0 && expenses?.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>No expenses logged yet. Use Capture to add receipts.</div>
            )}
          </div>
        )}

        {/* Review banner */}
        {unclearedImages.length > 0 && (
          <button onClick={() => setShowReview(true)} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', marginBottom: 14, padding: '14px 16px', background: 'linear-gradient(135deg, var(--accent-soft), var(--purple-soft))', border: '1.5px solid var(--accent-mid)', borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ti ti-photo-scan" style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Review your captured images
                <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{unclearedImages.length}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Give context or sort them to keep everything organised.</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
              Review now <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
            </span>
          </button>
        )}

        {filtered.length === 0 && !uploading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
            {search ? 'No items match.' : 'Nothing in the vault yet. Tap + to add.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {uploading && (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                <div className="shimmer-box" style={{ height: 90, borderRadius: 0 }} />
                <div style={{ padding: '8px 10px' }}>
                  <div className="shimmer-box" style={{ height: 12, width: '75%', marginBottom: 6 }} />
                  <div className="shimmer-box" style={{ height: 10, width: '50%' }} />
                </div>
              </div>
            )}
            {filtered.map(item => {
              const meta = VAULT_META[item.type] || VAULT_META.note
              const isVoice = item.tags?.includes('voice')
              const time = item.created_at ? format(new Date(item.created_at), 'h:mm a') : ''
              const day = item.created_at ? (isToday(new Date(item.created_at)) ? 'Today' : isYesterday(new Date(item.created_at)) ? 'Yesterday' : format(new Date(item.created_at), 'd MMM')) : ''

              const isSelected = selectedIds.has(item.id)
              const cardProps = {
                onPointerDown: () => startLongPress(item),
                onPointerUp: cancelLongPress,
                onPointerCancel: cancelLongPress,
                onClick: () => {
                  if (multiSelect) { toggleSelect(item.id) }
                  else if (cardMenu === item.id) { setCardMenu(null) }
                  else { setSelected(item) }
                }
              }

              if (!item.file_url) {
                return (
                  <div key={item.id} {...cardProps} style={{ background: isSelected ? meta.color + '28' : meta.bg, borderRadius: 'var(--r)', overflow: 'hidden', cursor: 'pointer', padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', minHeight: 132, border: isSelected ? `2px solid ${meta.color}` : '2px solid transparent', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected ? <i className="ti ti-circle-check" style={{ fontSize: 14, color: meta.color }} /> : <i className={`ti ${meta.icon}`} style={{ fontSize: 14, color: meta.color }} />}
                      </div>
                      <button onClick={e => { e.stopPropagation(); setCardMenu(cardMenu === item.id ? null : item.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: meta.color }}>
                        <i className="ti ti-dots" style={{ fontSize: 14 }} />
                      </button>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: meta.color, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Untitled'}</div>
                    {item.ocr_text && <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{item.ocr_text}</div>}
                    <div style={{ fontSize: 10, color: meta.color, opacity: .8, marginTop: 8 }}>{time}{day && ` ${day}`}</div>
                    {cardMenu === item.id && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 36, right: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 10, minWidth: 140, overflow: 'hidden' }}>
                        {[
                          { label: 'Delete', icon: 'ti-trash', color: 'var(--red)', action: () => { handleDelete(item.id); setCardMenu(null) } },
                          { label: 'Add to IdeaLab', icon: 'ti-bulb', color: 'var(--purple)', action: async () => { await addIdea({ title: item.title || 'Vault item', body: item.ocr_text || null, tags: item.tags || [], status: 'raw', source: 'vault' }); showToast('Added to IdeaLab'); setCardMenu(null) } },
                        ].map(opt => (
                          <button key={opt.label} onClick={opt.action} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 13, color: opt.color || 'var(--text)' }}>
                            <i className={`ti ${opt.icon}`} style={{ fontSize: 14 }} /> {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div key={item.id} {...cardProps} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', overflow: 'hidden', cursor: 'pointer', border: isSelected ? `2px solid var(--accent)` : '1px solid var(--border)', position: 'relative' }}>
                  <div style={{ height: 90, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                    <img src={item.file_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {isSelected && <div style={{ position: 'absolute', inset: 0, background: 'rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-circle-check" style={{ fontSize: 28, color: '#fff' }} /></div>}
                    {isVoice && <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 4 }}><i className="ti ti-microphone" style={{ fontSize: 10, color: '#fff' }} /></div>}
                    <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: .4 }}>{item.type}</div>
                    <button onClick={e => { e.stopPropagation(); setCardMenu(cardMenu === item.id ? null : item.id) }} style={{ position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-dots" style={{ fontSize: 13 }} />
                    </button>
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Untitled'}</div>
                    {item.ocr_text && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ocr_text}</div>}
                    <div style={{ fontSize: 9, color: 'var(--hint)', marginTop: 4 }}>{time}{day && ` · ${day}`}</div>
                  </div>
                  {cardMenu === item.id && (
                    <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 90, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 10, minWidth: 150, overflow: 'hidden' }}>
                      {[
                        { label: 'Delete', icon: 'ti-trash', color: 'var(--red)', action: () => { handleDelete(item.id); setCardMenu(null) } },
                        { label: 'Add to IdeaLab', icon: 'ti-bulb', color: 'var(--purple)', action: async () => { await addIdea({ title: item.title || 'Vault item', body: item.ocr_text || null, tags: item.tags || [], status: 'raw', source: 'vault' }); showToast('Added to IdeaLab'); setCardMenu(null) } },
                        { label: 'Select', icon: 'ti-checkbox', color: 'var(--accent)', action: () => { setMultiSelect(true); setSelectedIds(new Set([item.id])); setCardMenu(null) } },
                      ].map(opt => (
                        <button key={opt.label} onClick={opt.action} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 13, color: opt.color || 'var(--text)' }}>
                          <i className={`ti ${opt.icon}`} style={{ fontSize: 14 }} /> {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {!search && (
              <div onClick={() => setShowAdd(true)} style={{ border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--r)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 12px', cursor: 'pointer', minHeight: 132, textAlign: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-plus" style={{ fontSize: 16, color: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Capture more</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Add images, notes, docs and more</div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && <VaultItemModal item={selected} onClose={() => setSelected(null)} onDelete={handleDelete} onUpdate={handleUpdate} />}
      {showAdd && <AddVaultModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
      {showReview && unclearedImages.length > 0 && <ReviewModal images={unclearedImages} onUpdate={handleUpdate} onClose={() => setShowReview(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── Journal ───────────────────────────────────────────────────
function makeEntry(text) {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, time: new Date().toISOString(), text }
}

export function Journal() {
  const { tasks, ideas, expenses, captures, addTask, fetchJournalEntry, saveJournalEntry } = useStore()

  // ── Multiple log entries ──────────────────────────
  const [logEntries,  setLogEntries]  = useState([])  // [{ id, time, text }]
  const [newEntryText, setNewEntryText] = useState('')
  const [editingId,   setEditingId]   = useState(null)
  const [editingText, setEditingText] = useState('')

  const [aiSummary,    setAiSummary]    = useState(null)
  const [journalImages, setJournalImages] = useState([])
  const [generating,   setGenerating]   = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [recording,    setRecording]    = useState(false)
  const [promotedTasks, setPromotedTasks] = useState({})
  const [promotingSaving, setPromotingSaving] = useState(false)
  const [showSearch,   setShowSearch]   = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [toast, showToast] = useToast()
  const recognizerRef = useRef(null)
  const imgInputRef   = useRef(null)
  const newEntryRef   = useRef(null)

  const todayDate = new Date()
  const [centerDate, setCenterDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(3)
  const [savedMode, setSavedMode] = useState(false)
  const datePickerRef = useRef(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(centerDate); d.setDate(centerDate.getDate() - 3 + i); return d })
  const selectedDate = weekDays[selectedDay]
  const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`
  const isFutureDate = selectedDate > todayDate && selectedDate.toDateString() !== todayDate.toDateString()

  useEffect(() => {
    setLogEntries([]); setNewEntryText(''); setEditingId(null)
    setAiSummary(null); setJournalImages([]); setPromotedTasks({}); setSavedMode(false)
    fetchJournalEntry(dateStr).then(entry => {
      if (!entry) return
      const summary = entry.auto_summary || null
      if (summary) {
        const { journal_images, log_entries, ...rest } = summary
        const normImages = (journal_images || []).map(img =>
          typeof img === 'string'
            ? { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, url: img, description: '', location: null, timestamp: entry.date || new Date().toISOString() }
            : img
        )
        setJournalImages(normImages)
        if (log_entries?.length) {
          setLogEntries(log_entries)
        } else if (entry.personal_note) {
          setLogEntries([makeEntry(entry.personal_note)])
        }
        setAiSummary(Object.keys(rest).length ? rest : null)
        setSavedMode(true)
      } else if (entry.personal_note) {
        setLogEntries([makeEntry(entry.personal_note)])
        setSavedMode(true)
      }
    })
  }, [dateStr])

  const isDate = (ts) => new Date(ts).toDateString() === selectedDate.toDateString()
  const dayDone     = tasks.filter(t => t.status === 'done' && t.updated_at && isDate(t.updated_at))
  const dayIdeas    = ideas.filter(i => isDate(i.created_at))
  const dayCaptures = captures.filter(c => isDate(c.created_at))
  const dayExpenses = expenses.filter(e => e.date === dateStr)
  const totalSpent  = dayExpenses.reduce((s, e) => s + Number(e.amount), 0)

  const ITEMS = [
    { icon: 'ti-check',          color: 'var(--green)',  bg: 'var(--green-soft)',  text: `${dayDone.length} tasks completed` },
    { icon: 'ti-bulb',           color: 'var(--purple)', bg: 'var(--purple-soft)', text: `${dayIdeas.length} ideas captured` },
    { icon: 'ti-screenshot',     color: 'var(--amber)',  bg: 'var(--amber-soft)',  text: `${dayCaptures.length} captures` },
    { icon: 'ti-currency-rupee', color: 'var(--accent)', bg: 'var(--accent-soft)', text: totalSpent > 0 ? `₹${Math.round(totalSpent).toLocaleString('en-IN')} spent` : 'No expenses' }
  ]

  // ── Log entry CRUD ────────────────────────────────
  const addEntry = (text) => {
    if (!text.trim()) return
    setLogEntries(prev => [...prev, makeEntry(text.trim())])
    setNewEntryText('')
  }
  const deleteEntry = (id) => setLogEntries(prev => prev.filter(e => e.id !== id))
  const saveEdit = () => {
    if (!editingText.trim()) return
    setLogEntries(prev => prev.map(e => e.id === editingId ? { ...e, text: editingText.trim() } : e))
    setEditingId(null); setEditingText('')
  }

  // ── Voice — dictates into new entry ──────────────
  const toggleRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { showToast('Voice not supported in this browser'); return }
    if (recording) {
      recognizerRef.current?.stop()
      setRecording(false)
      return
    }
    const r = new SR()
    r.lang = navigator.language || 'en-US'
    r.continuous = false
    r.interimResults = false
    r.onresult = (ev) => {
      const transcript = Array.from(ev.results).map(res => res[0].transcript).join(' ').trim()
      if (transcript) { addEntry(transcript); showToast('Voice entry added') }
    }
    r.onerror = (ev) => {
      setRecording(false)
      if (ev.error === 'not-allowed') showToast('Microphone permission denied')
      else if (ev.error !== 'aborted') showToast('Voice failed — try again')
    }
    r.onend = () => setRecording(false)
    recognizerRef.current = r
    try { r.start(); setRecording(true) } catch { showToast('Could not start voice') }
  }

  // ── Image picker — stored in journal entry only ───
  const handleImagePick = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`
        setJournalImages(prev => [...prev, { id, url: ev.target.result, description: '', location: null, timestamp: new Date().toISOString() }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }
  const removeImage = (id) => setJournalImages(prev => prev.filter(img => img.id !== id))
  const updateImage = (id, patch) => setJournalImages(prev => prev.map(img => img.id === id ? { ...img, ...patch } : img))
  const tagImageLocation = (id) => {
    if (!navigator.geolocation) { showToast('Location not supported'); return }
    updateImage(id, { location: 'Locating…' })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          const data = await res.json()
          const label = data?.address?.suburb || data?.address?.city || data?.address?.town || data?.display_name?.split(',')[0] || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`
          updateImage(id, { location: label })
        } catch {
          updateImage(id, { location: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}` })
        }
      },
      () => { updateImage(id, { location: null }); showToast('Could not get location') }
    )
  }

  // ── AI summary — passes all entries ──────────────
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const summary = await generateJournalSummary({
        tasksCompleted: dayDone, ideasCaptured: dayIdeas,
        expenses: dayExpenses, captures: dayCaptures,
        logEntries
      })
      setAiSummary(summary)
      if (summary?.suggested_tasks?.length) {
        const init = {}
        summary.suggested_tasks.forEach(t => { init[t] = false })
        setPromotedTasks(init)
      }
    } catch { showToast('AI generation failed') }
    finally { setGenerating(false) }
  }

  // ── Promote checked tasks to Tasks (never auto) ──
  const handlePromoteTasks = async () => {
    const toAdd = Object.entries(promotedTasks).filter(([, v]) => v).map(([k]) => k)
    if (!toAdd.length) { showToast('No tasks selected'); return }
    setPromotingSaving(true)
    for (const title of toAdd) await addTask({ title, status: 'todo', progress: 0, source: 'journal' })
    setPromotingSaving(false)
    showToast(`${toAdd.length} task${toAdd.length > 1 ? 's' : ''} added`)
    const reset = {}; Object.keys(promotedTasks).forEach(k => { reset[k] = false }); setPromotedTasks(reset)
  }

  // ── Save all entries + images + summary ──────────
  const handleSave = async () => {
    setSaving(true)
    let summary = aiSummary
    if (logEntries.length > 0 && !aiSummary) {
      setGenerating(true)
      try {
        summary = await generateJournalSummary({ tasksCompleted: dayDone, ideasCaptured: dayIdeas, expenses: dayExpenses, captures: dayCaptures, logEntries })
        setAiSummary(summary)
        if (summary?.suggested_tasks?.length) {
          const init = {}; summary.suggested_tasks.forEach(t => { init[t] = false }); setPromotedTasks(init)
        }
      } catch { /* keep null */ }
      finally { setGenerating(false) }
    }
    const { error } = await saveJournalEntry({ date: dateStr, personalNote: null, autoSummary: summary, journalImages, logEntries })
    setSaving(false)
    if (!error) { showToast('Journal saved'); setSavedMode(true) }
    else showToast('Save failed')
  }

  const visibleEntries = searchQuery.trim()
    ? logEntries.filter(e => e.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : logEntries

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Journal</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMode && (
            <button onClick={() => setSavedMode(false)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent-mid)', borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <i className="ti ti-edit" style={{ fontSize: 12 }} /> Edit Journal
            </button>
          )}
          <button onClick={() => { setShowSearch(s => !s); setSearchQuery('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: showSearch ? 'var(--accent)' : 'var(--muted)' }}>
            <i className="ti ti-search" style={{ fontSize: 20 }} />
          </button>
        </div>
      </div>

      {/* Week strip with navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 12px 0' }}>
        <button onClick={() => { const d = new Date(centerDate); d.setDate(d.getDate() - 7); setCenterDate(d); setSelectedDay(3) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)', flexShrink: 0 }}>
          <i className="ti ti-chevron-left" style={{ fontSize: 18 }} />
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {weekDays.map((d, i) => {
            const isToday_ = d.toDateString() === todayDate.toDateString()
            return (
              <div key={i} onClick={() => { setSelectedDay(i); setSearchQuery(''); setShowSearch(false) }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', minWidth: 32 }}>
                <div style={{ fontSize: 10, color: isToday_ ? 'var(--accent)' : 'var(--muted)', fontWeight: isToday_ ? 600 : 400 }}>{d.toLocaleDateString('en', { weekday: 'short' })}</div>
                <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, background: i === selectedDay ? 'var(--accent)' : isToday_ ? 'var(--accent-soft)' : 'transparent', color: i === selectedDay ? '#fff' : isToday_ ? 'var(--accent)' : 'var(--muted)' }}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>
        {weekDays[3].toDateString() !== todayDate.toDateString() && (
          <button onClick={() => { const d = new Date(centerDate); d.setDate(d.getDate() + 7); setCenterDate(d); setSelectedDay(3) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)', flexShrink: 0 }}>
            <i className="ti ti-chevron-right" style={{ fontSize: 18 }} />
          </button>
        )}
        <button onClick={() => datePickerRef.current?.showPicker?.()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)', flexShrink: 0 }} title="Jump to date">
          <i className="ti ti-calendar" style={{ fontSize: 18 }} />
        </button>
        <input ref={datePickerRef} type="date" style={{ display: 'none' }} onChange={e => {
          if (!e.target.value) return
          const picked = new Date(e.target.value + 'T12:00:00')
          setCenterDate(picked); setSelectedDay(3)
        }} />
      </div>

      {showSearch && (
        <div style={{ padding: '8px 16px 0' }}>
          <div className="search-bar">
            <i className="ti ti-search" />
            <input placeholder="Search entries…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--muted)' }}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>}
          </div>
        </div>
      )}

      <div className="page-scroll" style={{ paddingTop: 8 }}>
        {/* ── Log Entries ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 }}>
          <div className="section-label" style={{ margin: 0 }}>
            Log entries {logEntries.length > 0 && <span style={{ color: 'var(--hint)', fontWeight: 400 }}>({logEntries.length})</span>}
          </div>
          {searchQuery && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{visibleEntries.length} match{visibleEntries.length !== 1 ? 'es' : ''}</span>}
        </div>

        {recording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--red-soft)', borderRadius: 'var(--r-sm)', marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>Recording… tap mic to stop &amp; add entry</span>
          </div>
        )}

        {searchQuery && visibleEntries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--hint)', fontSize: 13 }}>No entries match "{searchQuery}"</div>
        )}

        {/* Existing entries — chronological */}
        {visibleEntries.map((entry, i) => (
          <div key={entry.id} className="card" style={{ marginBottom: 8, padding: '10px 14px' }}>
            {editingId === entry.id ? (
              <div>
                <textarea
                  className="input"
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  style={{ minHeight: 70, fontSize: 13, marginBottom: 8 }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={saveEdit}>Save</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setEditingId(null); setEditingText('') }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: 'var(--hint)', marginBottom: 4 }}>
                      {format(new Date(entry.time), 'h:mm a')}
                      {i === logEntries.length - 1 && logEntries.length > 0 && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>latest</span>}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{entry.text}</div>
                  </div>
                  {!savedMode && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setEditingId(entry.id); setEditingText(entry.text) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--hint)' }}>
                        <i className="ti ti-edit" style={{ fontSize: 13 }} />
                      </button>
                      <button onClick={() => deleteEntry(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--hint)' }}>
                        <i className="ti ti-trash" style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {savedMode && logEntries.length > 0 && (
          <div style={{ padding: '8px 12px', background: 'var(--accent-soft)', border: '1px solid var(--accent-mid)', borderRadius: 'var(--r)', marginBottom: 10, fontSize: 12, color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-lock" style={{ fontSize: 13 }} />
            Journal saved — tap <strong>Edit Journal</strong> to make changes
          </div>
        )}

        {/* Add new entry input */}
        {!savedMode && <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 8 }}>
          <textarea
            ref={newEntryRef}
            className="input"
            placeholder={logEntries.length === 0 ? "What happened today?" : "Add another entry…"}
            value={newEntryText}
            onChange={e => setNewEntryText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addEntry(newEntryText) } }}
            style={{ border: 'none', background: 'transparent', minHeight: 70, fontSize: 15, resize: 'none', padding: '2px 0', width: '100%' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <button
              onClick={toggleRecording}
              style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: recording ? 'var(--red)' : 'var(--surface)', color: recording ? '#fff' : 'var(--muted)', animation: recording ? 'pulse 1.2s infinite' : 'none', flexShrink: 0 }}
              title={recording ? 'Stop recording' : 'Voice entry'}
            >
              <i className={`ti ${recording ? 'ti-microphone-off' : 'ti-microphone'}`} style={{ fontSize: 15 }} />
            </button>
            <button
              onClick={() => imgInputRef.current?.click()}
              style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--muted)', flexShrink: 0 }}
              title="Attach photo"
            >
              <i className="ti ti-camera" style={{ fontSize: 15 }} />
            </button>
            <input ref={imgInputRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handleImagePick} />
            <button
              className="btn btn-ghost"
              onClick={() => addEntry(newEntryText)}
              disabled={!newEntryText.trim()}
              style={{ marginLeft: 'auto', fontSize: 13, padding: '8px 16px', minHeight: 36 }}
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add entry
            </button>
          </div>
        </div>}

        {/* Image gallery — journal-only, never in vault */}
        {journalImages.length > 0 && (
          <div style={{ marginTop: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--hint)', marginBottom: 6 }}>Photos · journal only</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {journalImages.map(img => (
                <div key={img.id} style={{ display: 'flex', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 8 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={img.url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-sm)', display: 'block' }} />
                    <button onClick={() => removeImage(img.id)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-x" style={{ fontSize: 10 }} />
                    </button>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <input
                      className="input"
                      placeholder="Add a description…"
                      value={img.description}
                      onChange={e => updateImage(img.id, { description: e.target.value })}
                      style={{ fontSize: 12, padding: '6px 9px', minHeight: 'auto' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <i className="ti ti-clock" style={{ fontSize: 11 }} /> {format(new Date(img.timestamp), 'd MMM · h:mm a')}
                      </span>
                      {img.location ? (
                        <span onClick={() => tagImageLocation(img.id)} style={{ fontSize: 10, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                          <i className="ti ti-map-pin" style={{ fontSize: 11 }} /> {img.location}
                        </span>
                      ) : (
                        <button onClick={() => tagImageLocation(img.id)} style={{ fontSize: 10, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'inherit' }}>
                          <i className="ti ti-map-pin-plus" style={{ fontSize: 11 }} /> Add location
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, gap: 8 }} onClick={handleSave} disabled={saving || generating}>
          {(saving || generating)
            ? <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> {generating ? 'Generating summary…' : 'Saving…'}</>
            : <><i className="ti ti-device-floppy" style={{ fontSize: 15 }} /> Save journal · {format(selectedDate, 'd MMM')}</>
          }
        </button>

        {/* AI Summary — auto-generated on save */}
        {aiSummary ? (
          <>
            <div className="section-row" style={{ marginTop: 20 }}>
              <div className="section-label" style={{ margin: 0 }}>AI Summary</div>
              <button style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }} onClick={handleGenerate}>Regenerate</button>
            </div>
            <div className="card">
              {aiSummary.headline && <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>{aiSummary.headline}</div>}
              {aiSummary.highlights?.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 14, color: 'var(--green)', marginTop: 1, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{h}</div>
                </div>
              ))}
            </div>
            {aiSummary.suggested_tasks?.length > 0 && (
              <>
                <div className="section-row" style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--muted)' }}>AI suggested tasks</div>
                  <span style={{ fontSize: 10, color: 'var(--hint)' }}>check to add to Tasks</span>
                </div>
                <div className="card" style={{ padding: '4px 16px' }}>
                  {aiSummary.suggested_tasks.map((t, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < aiSummary.suggested_tasks.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!promotedTasks[t]} onChange={e => setPromotedTasks(prev => ({ ...prev, [t]: e.target.checked }))} style={{ accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }} />
                      <span style={{ fontSize: 13 }}>{t}</span>
                    </label>
                  ))}
                </div>
                {Object.values(promotedTasks).some(Boolean) && (
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: 8, gap: 6 }} onClick={handlePromoteTasks} disabled={promotingSaving}>
                    {promotingSaving
                      ? <><div className="spinner" style={{ width: 12, height: 12, borderTopColor: '#fff' }} /> Adding…</>
                      : <><i className="ti ti-plus" style={{ fontSize: 14 }} /> Add {Object.values(promotedTasks).filter(Boolean).length} to Tasks</>
                    }
                  </button>
                )}
              </>
            )}
          </>
        ) : generating ? (
          <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-mid)', borderRadius: 'var(--r)', padding: '18px 16px', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div className="spinner" style={{ width: 18, height: 18 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Preparing your AI summary</div>
            </div>
            {[
              { done: true,  label: 'Reviewing your journal entries' },
              { done: true,  label: 'Scanning vault items' },
              { done: false, label: 'Cleaning clutter' },
              { done: false, label: 'Generating summary' },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                {step.done
                  ? <i className="ti ti-circle-check" style={{ fontSize: 16, color: 'var(--green)', flexShrink: 0 }} />
                  : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border-strong)', flexShrink: 0 }} />}
                <div>
                  <div style={{ fontSize: 13, color: step.done ? 'var(--text)' : 'var(--muted)' }}>{step.label}</div>
                  {!step.done && i === 2 && <div style={{ fontSize: 11, color: 'var(--hint)' }}>Sorting and removing duplicates</div>}
                  {!step.done && i === 3 && <div style={{ fontSize: 11, color: 'var(--hint)' }}>Almost there…</div>}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── IdeaLab ───────────────────────────────────────────────────
const IDEA_SOURCES = ['text', 'photo', 'tasks', 'notes']

function NewIdeaModal({ tasks, vaultItems, onClose, onSave }) {
  const [tab, setTab]         = useState('text')
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [tags, setTags]       = useState('')
  const [saving, setSaving]   = useState(false)

  // photo
  const [imgPreview, setImgPreview] = useState(null)
  const [analyzing, setAnalyzing]   = useState(false)
  const fileRef = useRef(null)

  // from tasks
  const [selectedTasks, setSelectedTasks] = useState(new Set())
  // from notes
  const [selectedNotes, setSelectedNotes] = useState(new Set())

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result; setImgPreview(dataUrl); setAnalyzing(true)
      try {
        const a = await analyzeImage(dataUrl)
        setTitle(a.title || ''); setBody(a.summary || '')
      } catch {} finally { setAnalyzing(false) }
    }
    reader.readAsDataURL(file)
  }

  const buildFromTasks = () => {
    const chosen = tasks.filter(t => selectedTasks.has(t.id))
    setTitle(`Idea from ${chosen.length} tasks`)
    setBody(chosen.map(t => `• ${t.title}${t.notes ? ': ' + t.notes : ''}`).join('\n'))
    setTab('text')
  }

  const buildFromNotes = () => {
    const chosen = vaultItems.filter(v => selectedNotes.has(v.id))
    setTitle(`Idea from ${chosen.length} notes`)
    setBody(chosen.map(v => `• ${v.title}: ${v.ocr_text || ''}`).join('\n').slice(0, 500))
    setTab('text')
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), body: body.trim() || null, tags: tags.split(',').map(t => t.trim()).filter(Boolean), status: 'raw', source: 'manual' })
    setSaving(false); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', maxHeight: '88dvh', overflowY: 'auto', maxWidth: 430, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>New Idea</div>
        </div>

        <div className="tabs" style={{ padding: '0 20px' }}>
          {[['text','ti-pencil','Text'], ['photo','ti-camera','Photo'], ['tasks','ti-checkbox','Tasks'], ['notes','ti-photo','Vault']].map(([t, icon, label]) => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ flex: 1, fontSize: 11, padding: '10px 6px' }}>
              <i className={`ti ${icon}`} style={{ fontSize: 13, display: 'block', margin: '0 auto 2px' }} />{label}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 20px calc(16px + env(safe-area-inset-bottom))' }}>
          {/* TEXT */}
          {tab === 'text' && (
            <>
              <input className="input" placeholder="Idea title *" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 10 }} autoFocus />
              <textarea className="input" placeholder="Describe your idea…" value={body} onChange={e => setBody(e.target.value)} style={{ marginBottom: 10, minHeight: 90 }} />
              <input className="input" placeholder="Tags (comma separated)" value={tags} onChange={e => setTags(e.target.value)} />
            </>
          )}

          {/* PHOTO */}
          {tab === 'photo' && (
            <>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              {!imgPreview ? (
                <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border-strong)', borderRadius: 'var(--r)', height: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
                  <i className="ti ti-camera" style={{ fontSize: 30, color: 'var(--muted)' }} />
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Tap to capture</div>
                </div>
              ) : (
                <>
                  <img src={imgPreview} alt="" style={{ width: '100%', borderRadius: 'var(--r)', maxHeight: 160, objectFit: 'cover', marginBottom: 10 }} />
                  {analyzing && <div style={{ display: 'flex', gap: 8, color: 'var(--muted)', fontSize: 13, marginBottom: 10, alignItems: 'center' }}><div className="spinner" style={{ width: 14, height: 14 }} /> AI analyzing…</div>}
                </>
              )}
              <input className="input" placeholder="Idea title" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 10 }} />
              <textarea className="input" placeholder="Notes…" value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 70 }} />
            </>
          )}

          {/* FROM TASKS */}
          {tab === 'tasks' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Select tasks to synthesize into an idea</div>
              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {tasks.slice(0, 20).map(t => (
                  <div key={t.id} onClick={() => setSelectedTasks(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: `1px solid ${selectedTasks.has(t.id) ? 'var(--accent)' : 'var(--border)'}`, background: selectedTasks.has(t.id) ? 'var(--accent-soft)' : 'var(--bg)', cursor: 'pointer' }}>
                    <i className={`ti ${selectedTasks.has(t.id) ? 'ti-circle-check' : 'ti-circle'}`} style={{ color: selectedTasks.has(t.id) ? 'var(--accent)' : 'var(--hint)', fontSize: 16 }} />
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{t.title}</span>
                  </div>
                ))}
              </div>
              {selectedTasks.size > 0 && <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 10 }} onClick={buildFromTasks}><i className="ti ti-arrow-right" style={{ fontSize: 14 }} /> Build idea from {selectedTasks.size} tasks</button>}
            </>
          )}

          {/* FROM VAULT */}
          {tab === 'notes' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Select vault items to inspire an idea</div>
              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {vaultItems.slice(0, 30).map(v => {
                  const vm = VAULT_META[v.type] || VAULT_META.note
                  return (
                    <div key={v.id} onClick={() => setSelectedNotes(s => { const n = new Set(s); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: `1px solid ${selectedNotes.has(v.id) ? 'var(--accent)' : 'var(--border)'}`, background: selectedNotes.has(v.id) ? 'var(--accent-soft)' : 'var(--bg)', cursor: 'pointer' }}>
                      <i className={`ti ${selectedNotes.has(v.id) ? 'ti-circle-check' : vm.icon}`} style={{ color: selectedNotes.has(v.id) ? 'var(--accent)' : vm.color, fontSize: 16, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || 'Untitled'}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1, textTransform: 'capitalize' }}>{v.type}</div>
                      </div>
                    </div>
                  )
                })}
                {vaultItems.length === 0 && <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>No vault items yet.</div>}
              </div>
              {selectedNotes.size > 0 && <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 10 }} onClick={buildFromNotes}><i className="ti ti-arrow-right" style={{ fontSize: 14 }} /> Build idea from {selectedNotes.size} item{selectedNotes.size !== 1 ? 's' : ''}</button>}
            </>
          )}

          {(tab === 'text' || (tab === 'photo' && imgPreview && !analyzing)) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!title.trim() || saving}>
                {saving ? 'Saving…' : 'Save Idea'}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Brainstorm panel: select ideas → AI synthesizes
function BrainstormPanel({ ideas, tasks, onSaveTask, onClose }) {
  const [selected, setSelected]  = useState(new Set())
  const [result, setResult]      = useState(null)
  const [loading, setLoading]    = useState(false)
  const [savedTasks, setSavedTasks] = useState(new Set())
  const [savedIdeas, setSavedIdeas] = useState(new Set())
  const { addTask, addIdea } = useStore()
  const [toast, showToast] = useToast()

  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleBrainstorm = async () => {
    const chosen = ideas.filter(i => selected.has(i.id))
    if (chosen.length < 2) { showToast('Select at least 2 ideas'); return }
    setLoading(true); setResult(null)
    try {
      const r = await brainstormIdeas(chosen.map(i => ({ type: 'idea', title: i.title, body: i.body || '' })))
      setResult(r)
    } catch { showToast('AI brainstorm failed') }
    finally { setLoading(false) }
  }

  const saveTask = async (title, idx) => {
    const { error } = await addTask({ title, status: 'todo', source: 'ai_capture' })
    if (!error) { setSavedTasks(s => new Set([...s, idx])); showToast('Task saved') }
  }

  const saveNewIdea = async (title, idx) => {
    const { error } = await addIdea({ title, body: result.synthesis, tags: [], status: 'raw', source: 'capture' })
    if (!error) { setSavedIdeas(s => new Set([...s, idx])); showToast('Idea saved') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', maxHeight: '90dvh', overflowY: 'auto', maxWidth: 430, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-sparkles" style={{ fontSize: 18, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Brainstorm</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Select 2+ ideas to synthesize</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', marginBottom: 14 }}>
            {ideas.map(idea => (
              <div key={idea.id} onClick={() => toggle(idea.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: `1px solid ${selected.has(idea.id) ? 'var(--purple)' : 'var(--border)'}`, background: selected.has(idea.id) ? 'var(--purple-soft)' : 'var(--bg)', cursor: 'pointer' }}>
                <i className={`ti ${selected.has(idea.id) ? 'ti-circle-check' : 'ti-circle'}`} style={{ color: selected.has(idea.id) ? 'var(--purple)' : 'var(--hint)', fontSize: 16 }} />
                <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idea.title}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, var(--purple), var(--accent))', marginBottom: 4 }} onClick={handleBrainstorm} disabled={loading || selected.size < 2}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> Synthesizing…</> : <><i className="ti ti-sparkles" style={{ fontSize: 15 }} /> Synthesize {selected.size > 0 ? `(${selected.size})` : ''}</>}
          </button>

          {result && (
            <div style={{ marginTop: 16 }}>
              {/* Theme banner */}
              <div style={{ background: 'linear-gradient(135deg, var(--purple-soft), var(--accent-soft))', borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Core theme</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{result.theme}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{result.synthesis}</div>
              </div>

              {/* Tasks */}
              {result.tasks?.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Action items</div>
                  {result.tasks.map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', marginBottom: 6, background: savedTasks.has(i) ? 'var(--green-soft)' : 'var(--surface)' }}>
                      <i className="ti ti-checkbox" style={{ color: savedTasks.has(i) ? 'var(--green)' : 'var(--accent)', fontSize: 15, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, color: savedTasks.has(i) ? 'var(--muted)' : 'var(--text)', textDecoration: savedTasks.has(i) ? 'line-through' : 'none' }}>{t}</div>
                      {!savedTasks.has(i)
                        ? <button onClick={() => saveTask(t, i)} style={{ background: 'var(--accent-soft)', border: 'none', color: 'var(--accent-dark)', fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', flexShrink: 0 }}>+ Task</button>
                        : <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 500 }}>Saved</span>}
                    </div>
                  ))}
                </>
              )}

              {/* Pipeline */}
              {result.pipeline?.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5, margin: '14px 0 8px' }}>Pipeline</div>
                  <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
                    {result.pipeline.map((stage, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 12px', fontSize: 12, textAlign: 'center', maxWidth: 100 }}>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Stage {i + 1}</div>
                          <div style={{ fontWeight: 500 }}>{stage}</div>
                        </div>
                        {i < result.pipeline.length - 1 && <i className="ti ti-chevron-right" style={{ color: 'var(--hint)', fontSize: 14, flexShrink: 0, padding: '0 2px' }} />}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Follow-ups */}
              {result.followups?.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5, margin: '14px 0 8px' }}>Follow-ups</div>
                  {result.followups.map((q, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0', borderBottom: i < result.followups.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <i className="ti ti-question-mark" style={{ color: 'var(--purple)', fontSize: 14, marginTop: 1, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q}</div>
                    </div>
                  ))}
                </>
              )}

              {/* New emergent ideas */}
              {result.newIdeas?.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5, margin: '14px 0 8px' }}>Emergent ideas</div>
                  {result.newIdeas.map((idea, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', marginBottom: 6, background: savedIdeas.has(i) ? 'var(--purple-soft)' : 'var(--surface)' }}>
                      <i className="ti ti-bulb" style={{ color: savedIdeas.has(i) ? 'var(--purple)' : 'var(--amber)', fontSize: 15, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13 }}>{idea}</div>
                      {!savedIdeas.has(i)
                        ? <button onClick={() => saveNewIdea(idea, i)} style={{ background: 'var(--purple-soft)', border: 'none', color: 'var(--purple-dark)', fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', flexShrink: 0 }}>Save</button>
                        : <span style={{ fontSize: 10, color: 'var(--purple)', fontWeight: 500 }}>Saved</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14, marginBottom: 8 }} onClick={onClose}>Close</button>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function AttachVaultModal({ vaultItems, onAttach, onClose }) {
  const [selected, setSelected] = useState(new Set())
  const [typeFilter, setTypeFilter] = useState('all')
  const filtered = vaultItems.filter(v => typeFilter === 'all' || v.type === typeFilter)
  const toggle = (id) => { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  const handleAdd = () => {
    const items = vaultItems.filter(v => selected.has(v.id))
    onAttach(items)
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', maxHeight: '75dvh', overflowY: 'auto', maxWidth: 430, margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px calc(20px + env(safe-area-inset-bottom))' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Attach vault items</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
            {['all', 'note', 'image', 'screenshot', 'document'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: typeFilter === t ? 'var(--accent)' : 'transparent', color: typeFilter === t ? '#fff' : 'var(--muted)', borderColor: typeFilter === t ? 'var(--accent)' : 'var(--border)', textTransform: 'capitalize', flexShrink: 0 }}>
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: 12 }}>No items found</div>
            ) : (
              filtered.map(v => {
                const vm = VAULT_META[v.type] || VAULT_META.note
                return (
                  <label key={v.id} onClick={() => toggle(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: `1px solid ${selected.has(v.id) ? 'var(--accent)' : 'var(--border)'}`, background: selected.has(v.id) ? 'var(--accent-soft)' : 'var(--bg)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} style={{ accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || 'Untitled'}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, textTransform: 'capitalize' }}>{v.type}</div>
                    </div>
                  </label>
                )
              })
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdd} disabled={selected.size === 0}>
              Add {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const STATUS_META = {
  raw:         { label:'New',         color:'var(--green)',  bg:'var(--green-soft)' },
  in_progress: { label:'In progress', color:'var(--accent)', bg:'var(--accent-soft)' },
  done:        { label:'Completed',   color:'var(--muted)',  bg:'var(--bg)' },
}

export function IdeaLab() {
  const { ideas, tasks, vaultItems, addTask, addIdea, updateIdea, deleteIdea } = useStore()
  const [activeTab,  setActiveTab]  = useState('recent')
  const [selected,   setSelected]   = useState(null)
  const [expansion,  setExpansion]  = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [savedTasks, setSavedTasks] = useState(new Set())
  const [showNew,    setShowNew]    = useState(false)
  const [showBrainstorm, setShowBrainstorm] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [search,     setSearch]     = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const [ideaTaskInput, setIdeaTaskInput] = useState('')
  const [ideaTaskPriority, setIdeaTaskPriority] = useState('')
  const [ideaTaskReminder, setIdeaTaskReminder] = useState('')
  const [ideaTaskReminderMenu, setIdeaTaskReminderMenu] = useState(false)
  const [ideaTaskSaving, setIdeaTaskSaving] = useState(false)
  const [toast, showToast] = useToast()

  useEffect(() => {
    if (selected) {
      // Reset input states when idea is selected
      setIdeaTaskInput('')
      setIdeaTaskPriority('')
      setIdeaTaskReminder('')
      setIdeaTaskReminderMenu(false)
    }
  }, [selected?.id])

  const handleExpand = async (idea) => {
    setLoading(true); setExpansion(null)
    try { const r = await expandIdea(idea); setExpansion(r) }
    catch { showToast('AI expansion failed.') }
    finally { setLoading(false) }
  }

  const handleSaveTask = async (title, idx) => {
    const { error } = await addTask({ title, status: 'todo', source: 'ai_capture' })
    if (!error) { setSavedTasks(s => new Set([...s, idx])); showToast('Task saved') }
  }

  const handleNewIdea = async (idea) => {
    const { error } = await addIdea(idea)
    if (!error) showToast('Idea saved')
    else showToast('Save failed')
  }

  const handleDelete = async (id) => {
    const { error } = await deleteIdea(id)
    if (!error) { setSelected(null); showToast('Idea deleted') }
  }

  const handleStatusChange = async (idea, status) => {
    if (updateIdea) await updateIdea(idea.id, { status })
    setSelected(prev => prev ? { ...prev, status } : prev)
    showToast('Status updated')
  }

  const handleAddIdeaTask = async () => {
    if (!ideaTaskInput.trim() || !selected) return
    setIdeaTaskSaving(true)
    await addTask({ title: ideaTaskInput.trim(), status: 'todo', progress: 0, source: 'idea', notes: `[idea:${selected.id}]` })
    setIdeaTaskInput('')
    setIdeaTaskSaving(false)
    showToast('Task added')
  }

  const handleAttachItems = (items) => {
    if (!selected) return
    setSelected(s => ({
      ...s,
      _attachments: [...(s._attachments || []), ...items]
    }))
  }

  const ideaTasks = useMemo(() =>
    selected ? tasks.filter(t => t.notes?.includes(`[idea:${selected.id}]`)) : [],
    [selected?.id, tasks]
  )

  const filteredIdeas = useMemo(() =>
    ideas.filter(i => {
      if (search) return i.title.toLowerCase().includes(search.toLowerCase()) || i.body?.toLowerCase().includes(search.toLowerCase())
      if (activeTab === 'recent')      return i.status === 'raw' || !i.status
      if (activeTab === 'in_progress') return i.status === 'in_progress'
      if (activeTab === 'completed')   return i.status === 'done'
      return true
    }),
    [ideas, search, activeTab]
  )

  if (selected) {
    return (
      <div className="page">
        <div style={{ padding: 'max(14px,env(safe-area-inset-top)) 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setSelected(null); setExpansion(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)' }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 22 }} />
          </button>
          <div style={{ fontSize: 17, fontWeight: 600, flex: 1 }}>Idea</div>
          <button className="btn btn-danger" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => handleDelete(selected.id)}>
            <i className="ti ti-trash" style={{ fontSize: 14 }} />
          </button>
        </div>

        <div className="page-scroll" style={{ paddingTop: 16 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{selected.title}</div>
            {selected.body && <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{selected.body}</div>}
            {selected.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                {selected.tags.map(t => <span key={t} className="pill" style={{ fontSize: 11 }}>{t}</span>)}
              </div>
            )}
          </div>

          {/* Tabs: Tasks / Attachments / Notes */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {[['tasks', 'Tasks'], ['attachments', 'Attachments'], ['notes', 'Notes']].map(([key, label]) => (
              <button key={key} className={`tab ${selected._activeIdeaTab === key ? 'active' : ''}`} onClick={() => setSelected(s => ({ ...s, _activeIdeaTab: key }))} style={{ flex: 1, fontSize: 12 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Tasks section */}
          {(selected._activeIdeaTab || 'tasks') === 'tasks' && (
            <div style={{ marginBottom: 16 }}>
              {ideaTasks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {ideaTasks.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', paddingLeft: (t.priority && PRIORITY_META[t.priority]) ? 10 : 12, background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: (t.priority && PRIORITY_META[t.priority]) ? `3px solid ${PRIORITY_META[t.priority].color}` : '1px solid var(--border)', borderRadius: 'var(--r-sm)', marginBottom: 6 }}>
                      <i className={`ti ${t.status === 'done' ? 'ti-circle-check' : t.status === 'in_progress' ? 'ti-loader' : 'ti-circle'}`} style={{ fontSize: 16, color: t.status === 'done' ? 'var(--green)' : t.status === 'in_progress' ? 'var(--accent)' : (t.priority && PRIORITY_META[t.priority]) ? PRIORITY_META[t.priority].color : 'var(--border-strong)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: t.status === 'done' ? 'var(--muted)' : 'var(--text)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                      {t.priority && PRIORITY_META[t.priority] && <span style={{ fontSize: 9, fontWeight: 700, background: PRIORITY_META[t.priority].bg, color: PRIORITY_META[t.priority].color, padding: '1px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>{PRIORITY_META[t.priority].label}</span>}
                      {t.status !== 'done' && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{t.progress}%</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Task creation input */}
              <div style={{ marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Add task..."
                  value={ideaTaskInput}
                  onChange={(e) => setIdeaTaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && ideaTaskInput.trim()) {
                      const addIdeaTask = async () => {
                        setIdeaTaskSaving(true)
                        const finalTitle = ideaTaskInput.trim()
                        const reminderAt = ideaTaskReminder || null
                        await addTask({ title: finalTitle, status: 'todo', priority: ideaTaskPriority || null, progress: 0, reminder_at: reminderAt, source: 'idea', notes: `[idea:${selected.id}]` })
                        if (reminderAt) scheduleReminder(finalTitle, reminderAt)
                        setIdeaTaskInput('')
                        setIdeaTaskPriority('')
                        setIdeaTaskReminder('')
                        setIdeaTaskSaving(false)
                      }
                      addIdeaTask()
                    }
                  }}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', marginBottom: 8 }}
                />

                {/* Priority selector */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  {Object.entries(PRIORITY_META).map(([key, p]) => (
                    <button
                      key={key}
                      onClick={() => setIdeaTaskPriority(ideaTaskPriority === key ? '' : key)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 'var(--r-sm)',
                        border: '1.5px solid',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 11,
                        fontWeight: 600,
                        background: ideaTaskPriority === key ? p.bg : 'transparent',
                        color: ideaTaskPriority === key ? p.color : 'var(--muted)',
                        borderColor: ideaTaskPriority === key ? p.color : 'var(--border)'
                      }}>
                      {p.label}
                    </button>
                  ))}

                  {/* Reminder bell */}
                  <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => setIdeaTaskReminderMenu(!ideaTaskReminderMenu)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        border: '1.5px solid',
                        borderColor: ideaTaskReminder ? 'var(--amber)' : 'var(--border)',
                        background: ideaTaskReminder ? 'var(--amber-soft)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: ideaTaskReminder ? 'var(--amber)' : 'var(--muted)',
                        fontSize: 16,
                        fontFamily: 'inherit'
                      }}
                      title="Set reminder">
                      <i className={`ti ${ideaTaskReminder ? 'ti-bell-filled' : 'ti-bell'}`} />
                    </button>
                    {ideaTaskReminderMenu && (
                      <div style={{ position: 'absolute', top: 36, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, minWidth: 120 }}>
                        {[{ label: '5 min', mins: 5 }, { label: '15 min', mins: 15 }, { label: '30 min', mins: 30 }, { label: '1 hour', mins: 60 }].map(opt => (
                          <button
                            key={opt.mins}
                            onClick={() => {
                              setIdeaTaskReminder(new Date(Date.now() + opt.mins * 60000).toISOString().slice(0, 16))
                              setIdeaTaskReminderMenu(false)
                            }}
                            style={{ display: 'block', width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--border)', fontFamily: 'inherit' }}>
                            {opt.label}
                          </button>
                        ))}
                        <button
                          onClick={() => { setIdeaTaskReminder(''); setIdeaTaskReminderMenu(false) }}
                          style={{ display: 'block', width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--red)', fontFamily: 'inherit' }}>
                          Clear
                        </button>
                      </div>
                    )}

                    {/* Submit button */}
                    <button
                      onClick={() => {
                        const addIdeaTask = async () => {
                          if (!ideaTaskInput.trim()) return
                          setIdeaTaskSaving(true)
                          const finalTitle = ideaTaskInput.trim()
                          const reminderAt = ideaTaskReminder || null
                          await addTask({ title: finalTitle, status: 'todo', priority: ideaTaskPriority || null, progress: 0, reminder_at: reminderAt, source: 'idea', notes: `[idea:${selected.id}]` })
                          if (reminderAt) scheduleReminder(finalTitle, reminderAt)
                          setIdeaTaskInput('')
                          setIdeaTaskPriority('')
                          setIdeaTaskReminder('')
                          setIdeaTaskSaving(false)
                        }
                        addIdeaTask()
                      }}
                      disabled={!ideaTaskInput.trim() || ideaTaskSaving}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        border: '1.5px solid',
                        borderColor: ideaTaskInput.trim() && !ideaTaskSaving ? 'var(--green)' : 'var(--border)',
                        background: ideaTaskInput.trim() && !ideaTaskSaving ? 'var(--green-soft)' : 'transparent',
                        cursor: ideaTaskInput.trim() && !ideaTaskSaving ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: ideaTaskInput.trim() && !ideaTaskSaving ? 'var(--green)' : 'var(--muted)',
                        fontSize: 16,
                        fontFamily: 'inherit'
                      }}>
                        {ideaTaskSaving ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <i className="ti ti-check" />}
                      </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attachments section */}
          {(selected._activeIdeaTab || 'tasks') === 'attachments' && (
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setShowAttach(true)} className="btn btn-primary" style={{ width: '100%', marginBottom: 10, gap: 6 }}>
                <i className="ti ti-plus" style={{ fontSize: 14 }} /> Attach vault items
              </button>
              {selected._attachments?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected._attachments.map(att => {
                    const vm = VAULT_META[att.type] || VAULT_META.note
                    return (
                      <div key={att.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', alignItems: 'flex-start' }}>
                        <i className={`ti ${vm.icon}`} style={{ fontSize: 16, color: vm.color, marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{att.title || 'Untitled'}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{vm.icon.replace('ti-', '').toUpperCase()}</div>
                          {att.ocr_text && <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{att.ocr_text}</div>}
                        </div>
                        <button onClick={() => setSelected(s => ({ ...s, _attachments: s._attachments?.filter(a => a.id !== att.id) || [] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hint)', padding: 2 }}>
                          <i className="ti ti-x" style={{ fontSize: 14 }} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>No attachments yet. Add vault items to attach.</div>
              )}
            </div>
          )}

          {/* Notes section */}
          {(selected._activeIdeaTab || 'tasks') === 'notes' && (
            <div style={{ marginBottom: 16 }}>
              <textarea
                placeholder="Add sudden thoughts or notes here…"
                value={selected._notes || ''}
                onChange={e => setSelected(s => ({ ...s, _notes: e.target.value }))}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px', minHeight: 120, fontSize: 13, fontFamily: 'inherit', color: 'var(--text)', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Auto-saved</div>
            </div>
          )}

          <button className="btn btn-ghost" style={{ width: '100%', gap: 8, marginBottom: 16 }} onClick={() => handleExpand(selected)} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Thinking…</> : <><i className="ti ti-sparkles" style={{ fontSize: 15 }} /> {expansion ? 'Re-expand' : 'Expand with AI'}</>}
          </button>

          {expansion && (
            <>
              <div style={{ background: 'linear-gradient(135deg, var(--purple-soft), var(--accent-soft))', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>AI Expansion</div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{expansion.expanded}</div>
              </div>

              {expansion.tasks?.length > 0 && (
                <>
                  <div className="section-label">Action items</div>
                  {expansion.tasks.map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', marginBottom: 8, background: savedTasks.has(i) ? 'var(--green-soft)' : 'var(--surface)' }}>
                      <i className="ti ti-checkbox" style={{ color: savedTasks.has(i) ? 'var(--green)' : 'var(--accent)', fontSize: 16, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, textDecoration: savedTasks.has(i) ? 'line-through' : 'none', color: savedTasks.has(i) ? 'var(--muted)' : 'var(--text)' }}>{t}</div>
                      {!savedTasks.has(i) ? <button onClick={() => handleSaveTask(t, i)} style={{ background: 'var(--accent-soft)', border: 'none', color: 'var(--accent-dark)', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', flexShrink: 0 }}>+ Task</button>
                        : <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Saved</span>}
                    </div>
                  ))}
                </>
              )}

              {expansion.questions?.length > 0 && (
                <>
                  <div className="section-label">Questions to explore</div>
                  <div className="card" style={{ padding: '4px 16px' }}>
                    {expansion.questions.map((q, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < expansion.questions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <i className="ti ti-question-mark" style={{ color: 'var(--purple)', fontSize: 14, marginTop: 2, flexShrink: 0 }} />
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{q}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: 'max(14px,env(safe-area-inset-top)) 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>IdeaLab</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => { setShowSearch(s => !s); setSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: showSearch ? 'var(--accent)' : 'var(--muted)' }}>
            <i className="ti ti-search" style={{ fontSize: 20 }} />
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)' }}>
            <i className="ti ti-dots" style={{ fontSize: 20 }} />
          </button>
        </div>
      </div>

      {showSearch && (
        <div style={{ padding: '8px 16px 0' }}>
          <div className="search-bar">
            <i className="ti ti-search" />
            <input placeholder="Search ideas…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--muted)' }}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>}
          </div>
        </div>
      )}

      <div className="page-scroll" style={{ paddingTop: 12 }}>

        {/* Hero banner */}
        <div style={{ background: 'linear-gradient(135deg, #6D28D9, #3B82F6)', borderRadius: 'var(--r-lg)', padding: '22px 20px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <i className="ti ti-bulb" style={{ fontSize: 32, color: 'rgba(255,255,255,0.9)', marginBottom: 10, display: 'block' }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 4 }}>Your ideas.</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>Unlimited potential.</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>Capture, connect and build something amazing</div>
          <button onClick={() => setShowNew(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 'var(--r-full)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(4px)' }}>
            <i className="ti ti-plus" style={{ fontSize: 14 }} /> New idea
          </button>
          {ideas.length >= 2 && (
            <button onClick={() => setShowBrainstorm(true)} style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--r-full)', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <i className="ti ti-sparkles" style={{ fontSize: 14 }} /> Brainstorm
            </button>
          )}
        </div>

        {/* Tabs */}
        {!search && (
          <div className="tabs" style={{ marginBottom: 14 }}>
            {[['recent','Recent ideas'],['in_progress','In progress'],['completed','Completed']].map(([key, label]) => (
              <button key={key} className={`tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)} style={{ flex: 1, fontSize: 12 }}>
                {label}
                {key === 'recent' && ideas.filter(i => !i.status || i.status === 'raw').length > 0 && (
                  <span style={{ marginLeft: 4, background: activeTab === key ? 'var(--accent)' : 'var(--border-strong)', color: activeTab === key ? '#fff' : 'var(--muted)', borderRadius: 10, padding: '1px 5px', fontSize: 9 }}>
                    {ideas.filter(i => !i.status || i.status === 'raw').length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {filteredIdeas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💡</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
              {search ? 'No ideas match' : activeTab === 'in_progress' ? 'Nothing in progress' : activeTab === 'completed' ? 'No completed ideas' : 'No ideas yet'}
            </div>
            <div style={{ fontSize: 13 }}>
              {search ? 'Try different keywords' : 'Tap + New idea to get started'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {filteredIdeas.map(idea => {
              const meta = STATUS_META[idea.status || 'raw'] || STATUS_META.raw
              return (
                <div key={idea.id} onClick={() => { setSelected(idea); setExpansion(null); setSavedTasks(new Set()) }} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--purple-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="ti ti-bulb" style={{ fontSize: 14, color: 'var(--purple)' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, background: meta.bg, color: meta.color, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: 'var(--text)', marginTop: 2 }}>{idea.title}</div>
                  {idea.body && <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{idea.body}</div>}
                  <div style={{ fontSize: 10, color: 'var(--hint)', marginTop: 'auto', paddingTop: 4 }}>
                    {idea.created_at ? format(new Date(idea.created_at), 'd MMM yyyy') : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>

      {showNew && <NewIdeaModal tasks={tasks} vaultItems={vaultItems} onClose={() => setShowNew(false)} onSave={handleNewIdea} />}
      {showBrainstorm && <BrainstormPanel ideas={ideas} tasks={tasks} onSaveTask={handleSaveTask} onClose={() => setShowBrainstorm(false)} />}
      {showAttach && selected && <AttachVaultModal vaultItems={vaultItems} onAttach={handleAttachItems} onClose={() => setShowAttach(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
