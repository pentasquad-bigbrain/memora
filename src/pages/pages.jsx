import { useState, useEffect, useRef } from 'react'
import { useStore } from '../lib/store'
import { expandIdea, generateJournalSummary, brainstormIdeas, analyzeImage } from '../lib/groq'
import { formatDistanceToNow, format } from 'date-fns'
import Tesseract from 'tesseract.js'
import { SkeletonVaultCard } from '../components/shared/Skeleton'

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

export function People() {
  const { people, tasks } = useStore()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const filtered = people.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0' }}><h2>People</h2></div>
      <div style={{ padding: '0 16px' }}>
        <div className="search-bar">
          <i className="ti ti-search" />
          <input placeholder="Search people…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="page-scroll" style={{ paddingTop: 4 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>{search ? 'No people found.' : 'People are auto-detected from your captures.'}</div>
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
                    <span style={{ fontSize: 10, fontWeight: 500, background: rs.bg, color: rs.color, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginTop: 3 }}>{person.role || 'other'}</span>
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

// Add to Vault modal with AI image analysis
function AddVaultModal({ onClose, onSave }) {
  const [tab, setTab]         = useState('text')
  const [saving, setSaving]   = useState(false)

  // text
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
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

  const handleSave = async () => {
    if (needsContext && tab === 'image' && !imgDesc.trim()) {
      return
    }
    setSaving(true)
    if (tab === 'text') {
      await onSave({ title: title.trim() || 'Note', ocr_text: body.trim() || null, type: 'note', tags: selectedTags })
    } else if (tab === 'image') {
      await onSave({ title: imgTitle.trim() || 'Image', file_url: imgPreview, ocr_text: imgDesc || null, type: 'image', tags: selectedTags })
    } else {
      await onSave({ title: audioTitle.trim() || `Voice note · ${format(new Date(), 'h:mm a')}`, ocr_text: transcript || null, type: 'note', tags: ['voice', ...selectedTags] })
    }
    setSaving(false); onClose()
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
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {VAULT_PRESET_TAGS.map(tag => (
                  <button key={tag} onClick={() => toggleTag(tag)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', background: selectedTags.includes(tag) ? 'var(--accent)' : 'transparent', color: selectedTags.includes(tag) ? '#fff' : 'var(--muted)', borderColor: selectedTags.includes(tag) ? 'var(--accent)' : 'var(--border)' }}>
                    {tag}
                  </button>
                ))}
              </div>
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
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {VAULT_PRESET_TAGS.map(tag => (
                  <button key={tag} onClick={() => toggleTag(tag)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', background: selectedTags.includes(tag) ? 'var(--accent)' : 'transparent', color: selectedTags.includes(tag) ? '#fff' : 'var(--muted)', borderColor: selectedTags.includes(tag) ? 'var(--accent)' : 'var(--border)' }}>
                    {tag}
                  </button>
                ))}
              </div>
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

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!canSave || saving || analyzing}>
              {saving ? 'Saving…' : 'Save to Vault'}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Vault() {
  const { vaultItems, addVaultItem, deleteVaultItem, updateVaultItem, loading } = useStore()
  const [cat, setCat]       = useState('all')
  const [reviewMode, setReviewMode] = useState(false)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showAdd, setShowAdd]   = useState(false)
  const [selected, setSelected] = useState(null)
  const [toast, showToast] = useToast()

  const needsReview = vaultItems.filter(v => v.type === 'image' && (!v.ocr_text || isGenericTitle(v.title)))

  const filtered = (reviewMode ? needsReview : vaultItems).filter(v => {
    if (cat !== 'all' && v.type !== cat) return false
    if (search && !v.title?.toLowerCase().includes(search.toLowerCase()) && !v.ocr_text?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleAdd = async (item) => {
    const { error } = await addVaultItem(item)
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

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Vault</h2>
        <div style={{ display: 'flex', gap: 14 }}>
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
        {needsReview.length > 0 && (
          <div style={{ marginTop: 10, padding: '14px 16px', borderRadius: 'var(--r)', background: 'var(--accent-soft)', border: '1px solid var(--accent-mid)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ti ti-photo-scan" style={{ fontSize: 18, color: '#fff' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Review your captured images</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Give context or sort them to keep everything organised</div>
            </div>
            <button
              onClick={() => { setReviewMode(true); setCat('all') }}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 'var(--r-full)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Review now <i className="ti ti-chevron-right" style={{ fontSize: 13 }} />
            </button>
          </div>
        )}

        {reviewMode && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="ti ti-photo-scan" style={{ fontSize: 14 }} /> Reviewing {needsReview.length} uncontextualised item{needsReview.length !== 1 ? 's' : ''}
            </div>
            <button onClick={() => setReviewMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, fontFamily: 'inherit' }}>Exit</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, padding: '10px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {VAULT_CATS.map(c => (
            <button key={c} className={`pill ${!reviewMode && cat === c ? 'active' : ''}`} onClick={() => { setCat(c); setReviewMode(false) }} style={{ textTransform: 'capitalize' }}>{c}</button>
          ))}
        </div>
      </div>

      <div className="page-scroll" style={{ paddingTop: 4 }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonVaultCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
            {reviewMode ? 'Nothing left to review — all caught up.' : search ? 'No items match.' : 'Nothing in the vault yet. Tap + to add.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {filtered.map(item => {
              const meta = VAULT_META[item.type] || VAULT_META.note
              return (
                <div
                  key={item.id}
                  onClick={() => setSelected(item)}
                  style={{ background: 'var(--bg)', borderRadius: 'var(--r)', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)' }}
                >
                  <div style={{ height: 90, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                    {item.file_url
                      ? <img src={item.file_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <i className={`ti ${meta.icon}`} style={{ fontSize: 30, color: meta.color }} />
                    }
                    {item.tags?.includes('voice') && (
                      <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="ti ti-microphone" style={{ fontSize: 10, color: '#fff' }} />
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 6, left: 6, background: meta.bg, color: meta.color, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: .4 }}>
                      {item.type}
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Untitled'}</div>
                    {item.ocr_text && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ocr_text}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && <VaultItemModal item={selected} onClose={() => setSelected(null)} onDelete={handleDelete} onUpdate={handleUpdate} />}
      {showAdd && <AddVaultModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
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
  const [toast, showToast] = useToast()
  const recognizerRef = useRef(null)
  const imgInputRef   = useRef(null)
  const newEntryRef   = useRef(null)

  const today = new Date()
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - 3 + i); return d })
  const [selectedDay, setSelectedDay] = useState(3)
  const selectedDate = weekDays[selectedDay]
  const dateStr = selectedDate.toISOString().split('T')[0]

  useEffect(() => {
    setLogEntries([]); setNewEntryText(''); setEditingId(null)
    setAiSummary(null); setJournalImages([]); setPromotedTasks({})
    fetchJournalEntry(dateStr).then(entry => {
      if (!entry) return
      const summary = entry.auto_summary || null
      if (summary) {
        const { journal_images, log_entries, ...rest } = summary
        // Legacy entries stored images as plain base64 strings; normalise to objects.
        const normImages = (journal_images || []).map(img =>
          typeof img === 'string'
            ? { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, url: img, description: '', location: null, timestamp: entry.date || new Date().toISOString() }
            : img
        )
        setJournalImages(normImages)
        // Restore log entries; fall back to personal_note as first entry
        if (log_entries?.length) {
          setLogEntries(log_entries)
        } else if (entry.personal_note) {
          setLogEntries([makeEntry(entry.personal_note)])
        }
        setAiSummary(Object.keys(rest).length ? rest : null)
      } else if (entry.personal_note) {
        setLogEntries([makeEntry(entry.personal_note)])
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
    if (!error) showToast('Journal saved')
    else showToast('Save failed')
  }

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0' }}>
        <h2>Journal</h2>
      </div>

      {/* Week strip */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {weekDays.map((d, i) => (
          <div key={i} onClick={() => setSelectedDay(i)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', minWidth: 36 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{d.toLocaleDateString('en', { weekday: 'short' })}</div>
            <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, background: i === selectedDay ? 'var(--accent)' : 'transparent', color: i === selectedDay ? '#fff' : 'var(--muted)' }}>
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>

      <div className="page-scroll" style={{ paddingTop: 8 }}>
        {/* Day at a glance — 2×2 tiles */}
        <div className="section-label">Day at a glance</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: 'ti-check', color: 'var(--green)', bg: 'var(--green-soft)', num: dayDone.length, label: 'Tasks', sub: 'completed' },
            { icon: 'ti-bulb',  color: 'var(--purple)', bg: 'var(--purple-soft)', num: dayIdeas.length, label: 'Ideas', sub: 'captured' },
            { icon: 'ti-camera', color: 'var(--amber)', bg: 'var(--amber-soft)', num: dayCaptures.length, label: 'Captures', sub: 'saved' },
            { icon: 'ti-currency-rupee', color: 'var(--accent)', bg: 'var(--accent-soft)', num: `₹${Math.round(totalSpent)||0}`, label: 'Expenses', sub: 'added' },
          ].map((tile, i) => (
            <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: tile.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${tile.icon}`} style={{ fontSize: 16, color: tile.color }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{tile.num}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{tile.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{tile.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Log Entries ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 }}>
          <div className="section-label" style={{ margin: 0 }}>Log entries {logEntries.length > 0 && <span style={{ color: 'var(--hint)', fontWeight: 400 }}>({logEntries.length})</span>}</div>
        </div>

        {recording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--red-soft)', borderRadius: 'var(--r-sm)', marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>Recording… tap mic to stop &amp; add entry</span>
          </div>
        )}

        {/* Existing entries — chronological */}
        {logEntries.map((entry, i) => (
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
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => { setEditingId(entry.id); setEditingText(entry.text) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--hint)' }}>
                      <i className="ti ti-edit" style={{ fontSize: 13 }} />
                    </button>
                    <button onClick={() => deleteEntry(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--hint)' }}>
                      <i className="ti ti-trash" style={{ fontSize: 13 }} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add new entry input */}
        <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 8 }}>
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
        </div>

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
          {[['text','ti-pencil','Text'], ['photo','ti-camera','Photo'], ['tasks','ti-checkbox','Tasks'], ['notes','ti-notes','Notes']].map(([t, icon, label]) => (
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

          {/* FROM NOTES */}
          {tab === 'notes' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Select notes to inspire an idea</div>
              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {vaultItems.filter(v => v.type === 'note').slice(0, 20).map(v => (
                  <div key={v.id} onClick={() => setSelectedNotes(s => { const n = new Set(s); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: `1px solid ${selectedNotes.has(v.id) ? 'var(--accent)' : 'var(--border)'}`, background: selectedNotes.has(v.id) ? 'var(--accent-soft)' : 'var(--bg)', cursor: 'pointer' }}>
                    <i className={`ti ${selectedNotes.has(v.id) ? 'ti-circle-check' : 'ti-circle'}`} style={{ color: selectedNotes.has(v.id) ? 'var(--accent)' : 'var(--hint)', fontSize: 16 }} />
                    <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || 'Untitled'}</span>
                  </div>
                ))}
              </div>
              {selectedNotes.size > 0 && <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 10 }} onClick={buildFromNotes}><i className="ti ti-arrow-right" style={{ fontSize: 14 }} /> Build idea from {selectedNotes.size} notes</button>}
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
  const [toast, showToast] = useToast()

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

  const filteredIdeas = ideas.filter(i => {
    if (search) return i.title.toLowerCase().includes(search.toLowerCase()) || i.body?.toLowerCase().includes(search.toLowerCase())
    if (activeTab === 'recent')      return i.status === 'raw' || !i.status
    if (activeTab === 'in_progress') return i.status === 'in_progress'
    if (activeTab === 'completed')   return i.status === 'done'
    return true
  })

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
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <button key={key} onClick={() => handleStatusChange(selected, key)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit', background: (selected.status||'raw') === key ? meta.bg : 'transparent', color: (selected.status||'raw') === key ? meta.color : 'var(--muted)', borderColor: (selected.status||'raw') === key ? meta.color : 'var(--border)' }}>
                {meta.label}
              </button>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{selected.title}</div>
            {selected.body && <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{selected.body}</div>}
            {selected.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                {selected.tags.map(t => <span key={t} className="pill" style={{ fontSize: 11 }}>{t}</span>)}
              </div>
            )}
          </div>

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
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
