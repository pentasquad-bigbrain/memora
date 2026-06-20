import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseCapture, analyzeImage } from '../lib/groq'
import { useStore } from '../lib/store'
import { format } from 'date-fns'

// ── Constants ─────────────────────────────────────────────────
const TYPE_META = {
  task:    { icon: 'ti-checkbox',       color: 'var(--accent)', bg: 'var(--accent-soft)',  label: 'Task' },
  idea:    { icon: 'ti-bulb',           color: 'var(--purple)', bg: 'var(--purple-soft)', label: 'Idea' },
  expense: { icon: 'ti-currency-rupee', color: 'var(--amber)',  bg: 'var(--amber-soft)',  label: 'Expense' },
  note:    { icon: 'ti-notes',          color: 'var(--green)',  bg: 'var(--green-soft)',  label: 'Note' },
  person:  { icon: 'ti-user',           color: 'var(--green)',  bg: 'var(--green-soft)',  label: 'Person' },
  unknown: { icon: 'ti-question-mark',  color: 'var(--muted)',  bg: 'var(--bg)',          label: 'Unknown' },
}
const ALL_TYPES = ['task', 'idea', 'expense', 'note', 'person']
const CAPTURE_DEST = { task: '/tasks', idea: '/idealab', expense: '/vault', note: '/vault', person: '/people' }

// ── Shared ResultCard ─────────────────────────────────────────
function ResultCard({ result, onSave, onEdit, onDiscard, saving }) {
  const meta = TYPE_META[result.type] || TYPE_META.unknown
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
      <div style={{ background: meta.bg, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <i className={`ti ${meta.icon}`} style={{ fontSize: 18, color: meta.color }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: meta.color, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            {meta.label}{result.confidence ? ` · ${Math.round(result.confidence * 100)}% confident` : ''}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginTop: 2 }}>{result.title}</div>
        </div>
      </div>
      <div style={{ padding: '12px 16px', background: 'var(--surface)' }}>
        {result.body && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>{result.body}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {result.person && <span className="pill accent"><i className="ti ti-user" style={{ fontSize: 11 }} /> {result.person}</span>}
          {result.due    && <span className="pill accent"><i className="ti ti-calendar" style={{ fontSize: 11 }} /> {new Date(result.due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
          {result.amount && <span className="pill accent"><i className="ti ti-currency-rupee" style={{ fontSize: 11 }} />{result.amount}</span>}
          {result.vendor && <span className="pill"><i className="ti ti-building-store" style={{ fontSize: 11 }} /> {result.vendor}</span>}
          {result.tags?.map(t => <span key={t} className="pill">{t}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onSave} disabled={saving}>
            {saving
              ? <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> Saving…</>
              : `Save as ${result.type}`}
          </button>
          <button className="btn btn-ghost" onClick={onEdit} disabled={saving}>
            <i className="ti ti-edit" style={{ fontSize: 14 }} />
          </button>
          {onDiscard && (
            <button className="btn btn-ghost" onClick={onDiscard} disabled={saving} style={{ color: 'var(--muted)' }}>
              <i className="ti ti-x" style={{ fontSize: 14 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit form (shared for text + voice) ──────────────────────
function EditForm({ result, transcript, onConfirm, onCancel }) {
  const [editType,   setEditType]   = useState(result.type || 'note')
  const [editTitle,  setEditTitle]  = useState(result.title || '')
  const [editBody,   setEditBody]   = useState(result.body || '')
  const [editPerson, setEditPerson] = useState(result.person || '')
  const [editAmount, setEditAmount] = useState(result.amount != null ? String(result.amount) : '')
  const [editVendor, setEditVendor] = useState(result.vendor || '')
  const [editDue,    setEditDue]    = useState(result.due ? new Date(result.due).toISOString().slice(0, 16) : '')

  const meta = TYPE_META[editType] || TYPE_META.unknown

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
      {transcript && (
        <div style={{ background: 'var(--bg)', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--hint)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 3 }}>You said</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, fontStyle: 'italic' }}>"{transcript}"</div>
        </div>
      )}
      <div style={{ background: meta.bg, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: meta.color, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>
          Edit before saving
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setEditType(t)}
              style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', background: editType === t ? TYPE_META[t].color : 'transparent', color: editType === t ? '#fff' : 'var(--muted)', borderColor: editType === t ? TYPE_META[t].color : 'var(--border)' }}
            >
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '14px 16px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="input" placeholder="Title *" value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus />
        <textarea className="input" placeholder="Notes (optional)" value={editBody} onChange={e => setEditBody(e.target.value)} style={{ minHeight: 70 }} />
        {(editType === 'task' || editType === 'person') && (
          <input className="input" placeholder="Person (optional)" value={editPerson} onChange={e => setEditPerson(e.target.value)} />
        )}
        {editType === 'task' && (
          <input className="input" type="datetime-local" value={editDue} onChange={e => setEditDue(e.target.value)} />
        )}
        {editType === 'expense' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Vendor" value={editVendor} onChange={e => setEditVendor(e.target.value)} style={{ flex: 1 }} />
            <input className="input" placeholder="₹ Amount" type="number" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} style={{ width: 110 }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              if (!editTitle.trim()) return
              onConfirm({
                type: editType, title: editTitle.trim(), body: editBody.trim() || null,
                person: editPerson.trim() || null,
                amount: editAmount ? parseFloat(editAmount) : null,
                vendor: editVendor.trim() || null,
                due: editDue || null,
              })
            }}
          >
            Confirm & save
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Image task list editor ────────────────────────────────────
function ImageTasksEditor({ imgAnalysis, imgDataUrl, onSave, onBack }) {
  const [tasks, setTasks] = useState(imgAnalysis.tasks?.length > 0 ? imgAnalysis.tasks : [imgAnalysis.title])
  const [due,    setDue]  = useState(imgAnalysis.date ? new Date(imgAnalysis.date).toISOString().slice(0, 16) : '')
  const [person, setPerson] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (i, val) => setTasks(prev => prev.map((t, j) => j === i ? val : t))
  const remove = (i) => setTasks(prev => prev.filter((_, j) => j !== i))

  const validTasks = tasks.filter(t => t.trim())

  return (
    <div style={{ marginTop: 16 }}>
      <img src={imgDataUrl} alt="" style={{ width: '100%', borderRadius: 'var(--r)', maxHeight: 160, objectFit: 'cover', marginBottom: 14 }} />
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>Review tasks before saving</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {tasks.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <i className="ti ti-circle-check" style={{ fontSize: 16, color: 'var(--accent)', flexShrink: 0 }} />
            <input
              className="input"
              value={t}
              onChange={e => update(i, e.target.value)}
              placeholder={`Task ${i + 1}`}
              style={{ flex: 1, fontSize: 13 }}
            />
            {tasks.length > 1 && (
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <i className="ti ti-x" style={{ fontSize: 14, color: 'var(--muted)' }} />
              </button>
            )}
          </div>
        ))}
        <button className="btn btn-ghost" style={{ fontSize: 12, alignSelf: 'flex-start' }} onClick={() => setTasks(p => [...p, ''])}>
          <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add task
        </button>
      </div>

      <input className="input" placeholder="Person (optional)" value={person} onChange={e => setPerson(e.target.value)} style={{ marginBottom: 8 }} />
      <input className="input" type="datetime-local" value={due} onChange={e => setDue(e.target.value)} style={{ marginBottom: 14 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={async () => { setSaving(true); await onSave(validTasks, due, person) }}
          disabled={saving || validTasks.length === 0}
        >
          {saving
            ? <><div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> Saving…</>
            : `Save ${validTasks.length} Task${validTasks.length !== 1 ? 's' : ''}`}
        </button>
        <button className="btn btn-ghost" onClick={onBack} disabled={saving}>Back</button>
      </div>
    </div>
  )
}

// ── Main Capture page ─────────────────────────────────────────
export default function Capture() {
  const navigate = useNavigate()
  const { captures, addCapture, addTask, addIdea, addExpense, addPerson, addVaultItem, findOrCreatePerson } = useStore()

  // status: idle | parsing | done | editing | saving
  //         voice-recording | voice-analyzing | voice-editing
  //         img-analyzing | img-confirm | img-edit-tasks | img-saving
  //         error
  const [status, setStatus]           = useState('idle')
  const preEditStatus                 = useRef('done')

  const [input, setInput]             = useState('')
  const [result, setResult]           = useState(null)
  const [captureSource, setCaptureSource] = useState('text')

  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const recognitionRef                = useRef(null)
  const hasVoiceSupport               = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const [imgDataUrl, setImgDataUrl]   = useState(null)
  const [imgAnalysis, setImgAnalysis] = useState(null)
  const fileRef                       = useRef(null)

  const [toast, setToast] = useState(null)
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const resetAll = () => {
    setStatus('idle'); setInput(''); setResult(null)
    setVoiceTranscript(''); setImgDataUrl(null); setImgAnalysis(null)
    setCaptureSource('text')
  }

  const saveResult = async (r, source) => {
    if (r.type === 'task') {
      let person_id = null
      if (r.person) {
        const p = await findOrCreatePerson(r.person)
        if (p) person_id = p.id
      }
      return addTask({ title: r.title, notes: r.body || null, due_at: r.due || null, status: 'todo', progress: 0, source: source === 'voice' ? 'voice' : 'ai_capture', person_id })
    }
    if (r.type === 'idea')    return addIdea({ title: r.title, body: r.body || null, tags: r.tags || [], status: 'raw', source: source === 'voice' ? 'voice' : 'capture' })
    if (r.type === 'expense') {
      if (!r.amount || r.amount <= 0) { showToast('Please enter a valid amount'); return { error: 'invalid' } }
      return addExpense({ vendor: r.vendor || r.title, amount: r.amount, notes: r.body || null, date: r.due?.split('T')[0] || new Date().toISOString().split('T')[0] })
    }
    if (r.type === 'person')  return addPerson({ name: r.person || r.title, role: 'other' })
    return addVaultItem({ title: r.title, ocr_text: r.body || null, type: 'note', tags: r.tags || [] })
  }

  // TEXT flow
  const handleSubmit = async () => {
    if (!input.trim()) return
    setStatus('parsing')
    try {
      const parsed = await parseCapture(input.trim())
      setResult(parsed); setCaptureSource('text')
      preEditStatus.current = 'done'
      setStatus('done')
      addCapture({ raw_input: input.trim(), input_type: 'text', ai_result: parsed, classified_as: parsed.type })
    } catch { setStatus('error') }
  }

  const handleSave = async () => {
    if (!result) return
    setStatus('saving')
    const savedType = result.type
    const { error } = await saveResult(result, captureSource)
    if (!error) {
      showToast(`${savedType.charAt(0).toUpperCase() + savedType.slice(1)} saved`)
      resetAll()
      // Navigate to the destination so user sees the saved item immediately
      if (savedType === 'task') navigate('/tasks')
      else if (savedType === 'idea') navigate('/idealab')
    }
    else if (error !== 'invalid') { showToast('Save failed'); setStatus(preEditStatus.current) }
    else setStatus(preEditStatus.current)
  }

  const enterEdit = () => { preEditStatus.current = status; setStatus('editing') }
  const handleEditConfirm = (updated) => { setResult(prev => ({ ...prev, ...updated })); setStatus(preEditStatus.current) }
  const handleEditCancel  = () => setStatus(preEditStatus.current)

  // VOICE — robust multi-browser implementation
  const handleVoice = () => {
    if (!hasVoiceSupport) { showToast('Voice not supported. Use Chrome on Android.'); return }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }

    setVoiceTranscript(''); setStatus('voice-recording'); setIsListening(true)

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    // Use device language as primary, fall back to en-US (en-IN may not be available on all devices)
    rec.lang = navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = true
    let finalTranscript = ''
    let interimTranscript = ''

    rec.onresult = (e) => {
      finalTranscript = ''; interimTranscript = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' '
        else interimTranscript += e.results[i][0].transcript
      }
      setVoiceTranscript((finalTranscript + interimTranscript).trim())
    }

    rec.onerror = (e) => {
      setIsListening(false)
      if (e.error === 'not-allowed') {
        showToast('Microphone permission denied')
      } else if (e.error === 'no-speech') {
        showToast('No speech detected — try again')
      } else if (e.error !== 'aborted') {
        showToast(`Voice error: ${e.error}`)
      }
      setStatus('idle'); setVoiceTranscript('')
    }

    rec.onend = async () => {
      setIsListening(false)
      const transcript = finalTranscript.trim() || interimTranscript.trim()
      if (!transcript) {
        // If continuous mode ended naturally (some browsers cut off), retry once
        setStatus('idle'); setVoiceTranscript('')
        showToast('Nothing captured — tap mic to try again')
        return
      }
      setStatus('voice-analyzing')
      try {
        const parsed = await parseCapture(transcript)
        setResult(parsed); setVoiceTranscript(transcript); setCaptureSource('voice')
        preEditStatus.current = 'voice-editing'
        setStatus('voice-editing')
        addCapture({ raw_input: transcript, input_type: 'voice', ai_result: parsed, classified_as: parsed.type })
      } catch {
        setInput(transcript); setStatus('idle'); setVoiceTranscript('')
        showToast('AI parse failed — text kept, tap ✦ to retry')
      }
    }

    try {
      recognitionRef.current = rec
      rec.start()
    } catch (err) {
      setIsListening(false); setStatus('idle')
      showToast('Could not start microphone')
    }
  }

  // IMAGE
  const handleImage = (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result; setImgDataUrl(dataUrl); setStatus('img-analyzing')
      try {
        const analysis = await analyzeImage(dataUrl); setImgAnalysis(analysis); setStatus('img-confirm')
      } catch {
        setImgAnalysis({ type: 'screenshot', title: file.name.replace(/\.[^.]+$/, '') || 'Image', summary: 'Could not analyze this image.', tasks: [], confidence: 0 })
        setStatus('img-confirm'); showToast('Could not analyze — choose how to save below')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleImageTasksSave = async (taskTitles, due, personName) => {
    let person_id = null
    if (personName.trim()) { const p = await findOrCreatePerson(personName.trim()); if (p) person_id = p.id }
    for (const title of taskTitles) {
      if (title.trim()) await addTask({ title: title.trim(), due_at: due || null, status: 'todo', progress: 0, source: 'screenshot', person_id })
    }
    addCapture({ raw_input: imgAnalysis.summary || imgAnalysis.title, input_type: 'image', ai_result: imgAnalysis, classified_as: 'task' })
    showToast(`${taskTitles.length} task${taskTitles.length !== 1 ? 's' : ''} saved`); resetAll(); navigate('/tasks')
  }

  const handleImageSaveExpense = async () => {
    if (!imgAnalysis.amount || imgAnalysis.amount <= 0) { showToast('No amount detected — save to Vault instead'); return }
    setStatus('img-saving')
    await addExpense({ vendor: imgAnalysis.vendor || imgAnalysis.title, amount: imgAnalysis.amount, date: imgAnalysis.date?.split('T')[0] || new Date().toISOString().split('T')[0], notes: imgAnalysis.summary || null })
    addCapture({ raw_input: imgAnalysis.summary || imgAnalysis.title, input_type: 'image', ai_result: imgAnalysis, classified_as: 'expense' })
    showToast('Expense saved'); resetAll()
  }

  const handleImageSaveVault = async () => {
    setStatus('img-saving')
    await addVaultItem({ title: imgAnalysis.title, file_url: imgDataUrl, ocr_text: imgAnalysis.summary || null, type: 'image', tags: [imgAnalysis.type].filter(Boolean) })
    addCapture({ raw_input: imgAnalysis.summary || imgAnalysis.title, input_type: 'image', ai_result: imgAnalysis, classified_as: 'note' })
    showToast('Saved to Vault'); resetAll()
  }

  const hideTextUI = ['img-analyzing','img-confirm','img-edit-tasks','img-saving','voice-recording','voice-analyzing','voice-editing'].includes(status)

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 22, color: 'var(--muted)' }} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Capture</div>
        <div style={{ width: 22 }} />
      </div>

      <div className="page-scroll" style={{ paddingTop: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>What's on your mind?</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Memora will handle the rest.</div>

        {!hideTextUI && (
          <>
            <textarea
              className="input"
              style={{ marginTop: 14, minHeight: 130, fontSize: 15 }}
              placeholder="Type anything — task, idea, expense, note…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
              disabled={['parsing', 'saving'].includes(status)}
              autoFocus={status === 'idle'}
            />
            <div style={{ fontSize: 10, color: 'var(--hint)', textAlign: 'right', marginTop: 4 }}>
              {navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to parse
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button onClick={hasVoiceSupport ? handleVoice : () => showToast('Voice not supported — use Chrome')} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-soft)', border: 'none', cursor: hasVoiceSupport ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hasVoiceSupport ? 1 : 0.4 }}>
                  <i className="ti ti-microphone" style={{ fontSize: 24, color: 'var(--accent)' }} />
                </button>
                <span style={{ fontSize: 10, color: 'var(--hint)' }}>Voice</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button onClick={() => fileRef.current?.click()} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-soft)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-camera" style={{ fontSize: 24, color: 'var(--green)' }} />
                </button>
                <span style={{ fontSize: 10, color: 'var(--hint)' }}>Photo</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button onClick={handleSubmit} disabled={!input.trim() || status === 'parsing'} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--amber-soft)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {status === 'parsing' ? <div className="spinner" style={{ width: 22, height: 22, borderTopColor: 'var(--amber)' }} /> : <i className="ti ti-sparkles" style={{ fontSize: 24, color: 'var(--amber)' }} />}
                </button>
                <span style={{ fontSize: 10, color: 'var(--hint)' }}>AI Parse</span>
              </div>
            </div>
          </>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImage} />

        {/* VOICE RECORDING */}
        {status === 'voice-recording' && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <button onClick={handleVoice} style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--red-soft)', border: '3px solid var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.4s ease-in-out infinite' }}>
                <i className="ti ti-player-stop" style={{ fontSize: 30, color: 'var(--red)' }} />
              </button>
              <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 500 }}>Tap to stop</div>
            </div>
            <div style={{ marginTop: 16, minHeight: 60, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px', fontSize: 14, color: voiceTranscript ? 'var(--text)' : 'var(--hint)', lineHeight: 1.6, fontStyle: voiceTranscript ? 'italic' : 'normal' }}>
              {voiceTranscript ? `"${voiceTranscript}"` : 'Listening…'}
            </div>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={resetAll}>Cancel</button>
          </div>
        )}

        {/* VOICE ANALYZING */}
        {status === 'voice-analyzing' && (
          <div style={{ marginTop: 24 }}>
            {voiceTranscript && <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px', fontSize: 14, lineHeight: 1.6, fontStyle: 'italic', marginBottom: 16 }}>"{voiceTranscript}"</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
              <div className="spinner" /> Understanding what you said…
            </div>
          </div>
        )}

        {/* VOICE EDIT — user reviews & edits before save */}
        {status === 'voice-editing' && result && (
          <div style={{ marginTop: 16 }}>
            <EditForm
              result={result}
              transcript={voiceTranscript}
              onConfirm={(updated) => { setResult(prev => ({ ...prev, ...updated })); preEditStatus.current = 'done'; setStatus('done') }}
              onCancel={resetAll}
            />
          </div>
        )}

        {/* IMAGE ANALYZING */}
        {status === 'img-analyzing' && imgDataUrl && (
          <div style={{ marginTop: 16 }}>
            <img src={imgDataUrl} alt="" style={{ width: '100%', borderRadius: 'var(--r)', maxHeight: 220, objectFit: 'cover', marginBottom: 16 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
              <div className="spinner" /> Understanding your image…
            </div>
          </div>
        )}

        {/* IMAGE CONFIRM */}
        {(status === 'img-confirm' || status === 'img-saving') && imgAnalysis && imgDataUrl && (() => {
          const saving = status === 'img-saving'
          return (
            <div style={{ marginTop: 16 }}>
              <img src={imgDataUrl} alt="" style={{ width: '100%', borderRadius: 'var(--r)', maxHeight: 220, objectFit: 'cover', marginBottom: 14 }} />
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>What I see</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{imgAnalysis.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{imgAnalysis.summary}</div>
                {imgAnalysis.tasks?.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>Detected actions</div>
                    {imgAnalysis.tasks.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <i className="ti ti-circle" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }} />
                        <span style={{ fontSize: 13, lineHeight: 1.4 }}>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
                {imgAnalysis.amount > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 20 }}>
                    {imgAnalysis.vendor && <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Vendor</div><div style={{ fontSize: 13, fontWeight: 500 }}>{imgAnalysis.vendor}</div></div>}
                    <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Amount</div><div style={{ fontSize: 13, fontWeight: 500 }}>₹{imgAnalysis.amount}</div></div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>What do you want to do?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(imgAnalysis.tasks?.length > 0 || ['reminder','task','meeting','notes'].includes(imgAnalysis.type)) && (
                  <button className="btn btn-primary" onClick={() => setStatus('img-edit-tasks')} disabled={saving}>
                    <i className="ti ti-checkbox" style={{ fontSize: 15 }} />
                    Review & Save as Task{imgAnalysis.tasks?.length > 1 ? `s (${imgAnalysis.tasks.length})` : ''}
                  </button>
                )}
                {(imgAnalysis.amount > 0 || ['receipt','expense'].includes(imgAnalysis.type)) && (
                  <button className="btn btn-primary" style={{ background: 'var(--amber)', color: '#fff' }} onClick={handleImageSaveExpense} disabled={saving}>
                    {saving ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : <i className="ti ti-currency-rupee" style={{ fontSize: 15 }} />}
                    Save as Expense
                  </button>
                )}
                <button className="btn btn-ghost" onClick={handleImageSaveVault} disabled={saving}>
                  <i className="ti ti-photo" style={{ fontSize: 15 }} /> Keep as Screenshot in Vault
                </button>
                <button className="btn btn-ghost" style={{ color: 'var(--muted)' }} onClick={resetAll} disabled={saving}>Discard</button>
              </div>
            </div>
          )
        })()}

        {/* IMAGE TASK EDITOR */}
        {status === 'img-edit-tasks' && imgAnalysis && imgDataUrl && (
          <ImageTasksEditor
            imgAnalysis={imgAnalysis}
            imgDataUrl={imgDataUrl}
            onSave={handleImageTasksSave}
            onBack={() => setStatus('img-confirm')}
          />
        )}

        {/* TEXT EDITING */}
        {status === 'editing' && result && (
          <div style={{ marginTop: 16 }}>
            <EditForm result={result} onConfirm={handleEditConfirm} onCancel={handleEditCancel} />
          </div>
        )}

        {/* TEXT DONE / SAVING */}
        {(status === 'done' || status === 'saving') && result && (
          <div style={{ marginTop: 16 }}>
            <ResultCard result={result} onSave={handleSave} onEdit={enterEdit} saving={status === 'saving'} />
          </div>
        )}

        {/* ERROR */}
        {status === 'error' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: '14px 16px', background: 'var(--red-soft)', border: '1px solid var(--red)', borderRadius: 'var(--r)', color: 'var(--red-dark)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
              AI parsing failed. Check your Groq API key or internet connection.
            </div>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setStatus('idle')}>Try again</button>
          </div>
        )}

        {/* RECENT CAPTURES */}
        <div className="section-row" style={{ marginTop: 32 }}>
          <div className="section-label">Recent captures</div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{captures.length} total</span>
        </div>
        {captures.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--hint)', fontSize: 13, padding: '20px 0' }}>Nothing captured yet.</div>
        ) : captures.map(c => {
          const m = TYPE_META[c.classified_as] || TYPE_META.unknown
          const dest = CAPTURE_DEST[c.classified_as]
          return (
            <div key={c.id} className="flex-row gap-12" onClick={() => dest && navigate(dest)} style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 8, cursor: dest ? 'pointer' : 'default' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`ti ${m.icon}`} style={{ fontSize: 16, color: m.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.ai_result?.title || c.raw_input?.slice(0, 60) || 'Untitled'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {format(new Date(c.created_at), 'h:mm a · d MMM')} · {m.label}
                  {c.input_type === 'voice' && <> · <i className="ti ti-microphone" style={{ fontSize: 10 }} /></>}
                  {c.input_type === 'image' && <> · <i className="ti ti-photo" style={{ fontSize: 10 }} /></>}
                </div>
              </div>
              {dest && <i className="ti ti-chevron-right" style={{ color: 'var(--muted)', fontSize: 16 }} />}
            </div>
          )
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
