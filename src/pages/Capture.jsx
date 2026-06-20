import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseCapture } from '../lib/groq'
import { useStore } from '../lib/store'
import { format } from 'date-fns'
import Tesseract from 'tesseract.js'

const TYPE_ICONS = { task: 'ti-checkbox', idea: 'ti-bulb', expense: 'ti-currency-rupee', note: 'ti-notes', person: 'ti-user', unknown: 'ti-question-mark' }
const TYPE_COLORS = { task: 'var(--accent)', idea: 'var(--purple)', expense: 'var(--amber)', note: 'var(--green)', person: 'var(--green)', unknown: 'var(--muted)' }
const TYPE_BG = { task: 'var(--accent-soft)', idea: 'var(--purple-soft)', expense: 'var(--amber-soft)', note: 'var(--green-soft)', person: 'var(--green-soft)', unknown: 'var(--bg)' }

export default function Capture() {
  const navigate = useNavigate()
  const { captures, addCapture, addTask, addIdea, addExpense } = useStore()

  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle') // idle | parsing | done | error
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [ocrStatus, setOcrStatus] = useState(null)

  const fileRef = useRef(null)
  const recognitionRef = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Text capture ─────────────────────────────────────────
  const handleSubmit = async () => {
    if (!input.trim()) return
    setStatus('parsing')
    setResult(null)
    try {
      const parsed = await parseCapture(input.trim())
      setResult({ ...parsed, raw: input.trim() })
      setStatus('done')
      await addCapture({ raw_input: input.trim(), input_type: 'text', ai_result: parsed, classified_as: parsed.type })
    } catch (e) {
      setStatus('error')
    }
  }

  // ── Save classified result ────────────────────────────────
  const handleSave = async () => {
    if (!result) return
    let saved = false
    if (result.type === 'task') {
      const { error } = await addTask({ title: result.title, notes: result.body, due_at: result.due || null, status: 'todo', source: 'ai_capture' })
      saved = !error
    } else if (result.type === 'idea') {
      const { error } = await addIdea({ title: result.title, body: result.body, tags: result.tags || [], source: 'capture' })
      saved = !error
    } else if (result.type === 'expense') {
      const { error } = await addExpense({ vendor: result.vendor, amount: result.amount, notes: result.body, date: result.due?.split('T')[0] || new Date().toISOString().split('T')[0] })
      saved = !error
    }
    if (saved) {
      showToast(`${result.type} saved`)
      setInput('')
      setResult(null)
      setStatus('idle')
    }
  }

  // ── Voice capture ─────────────────────────────────────────
  const handleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      showToast('Voice not supported on this browser')
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'en-IN'
    rec.interimResults = false
    rec.onresult = (e) => { setInput(e.results[0][0].transcript); setIsListening(false) }
    rec.onerror = () => { setIsListening(false); showToast('Voice capture failed') }
    rec.onend = () => setIsListening(false)
    recognitionRef.current = rec
    setIsListening(true)
    rec.start()
  }

  // ── Image / receipt OCR ───────────────────────────────────
  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrStatus('Extracting text from image…')
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng')
      setOcrStatus(null)
      setInput(text.trim().slice(0, 500))
      showToast('Text extracted from image')
    } catch {
      setOcrStatus(null)
      showToast('Could not extract text')
    }
    e.target.value = ''
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 22, color: 'var(--muted)' }}></i>
        </button>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Capture</div>
        <i className="ti ti-adjustments-horizontal" style={{ fontSize: 20, color: 'var(--muted)', cursor: 'pointer' }}></i>
      </div>

      <div className="page-scroll" style={{ paddingTop: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>What's on your mind?</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Memora will handle the rest.</div>

        {/* Input area */}
        <textarea
          className="input"
          style={{ marginTop: 14, minHeight: 130, fontSize: 15 }}
          placeholder="Type, speak or add a photo…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit() }}
        />

        {ocrStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
            <div className="spinner" style={{ width: 14, height: 14 }}></div>
            {ocrStatus}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 20 }}>
          <button onClick={handleVoice} style={{ width: 56, height: 56, borderRadius: '50%', background: isListening ? 'var(--red-soft)' : 'var(--accent-soft)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Voice capture">
            <i className="ti ti-microphone" style={{ fontSize: 24, color: isListening ? 'var(--red)' : 'var(--accent)' }}></i>
          </button>
          <button onClick={() => fileRef.current?.click()} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-soft)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Image capture">
            <i className="ti ti-camera" style={{ fontSize: 24, color: 'var(--green)' }}></i>
          </button>
          <button onClick={handleSubmit} disabled={!input.trim() || status === 'parsing'} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--amber-soft)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !input.trim() ? .4 : 1 }} aria-label="Parse with AI">
            <i className="ti ti-sparkles" style={{ fontSize: 24, color: 'var(--amber)' }}></i>
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--hint)' }}>Voice · Camera · AI Parse</div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />

        {/* Parsing state */}
        {status === 'parsing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
            <div className="spinner"></div>
            Memora is thinking…
          </div>
        )}

        {/* AI result card */}
        {status === 'done' && result && (
          <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <div style={{ background: TYPE_BG[result.type], padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className={`ti ${TYPE_ICONS[result.type]}`} style={{ fontSize: 18, color: TYPE_COLORS[result.type] }}></i>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: TYPE_COLORS[result.type], textTransform: 'uppercase', letterSpacing: '.4px' }}>
                  Detected as {result.type}
                  {result.confidence && ` · ${Math.round(result.confidence * 100)}% confident`}
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginTop: 2 }}>{result.title}</div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--surface)' }}>
              {result.body && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{result.body}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {result.person && <span className="pill accent"><i className="ti ti-user" style={{ fontSize: 12 }}></i>{result.person}</span>}
                {result.due && <span className="pill accent"><i className="ti ti-calendar" style={{ fontSize: 12 }}></i>{new Date(result.due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                {result.amount && <span className="pill accent">₹{result.amount}</span>}
                {result.tags?.map(t => <span key={t} className="pill">{t}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
                  Save as {result.type}
                </button>
                <button className="btn btn-ghost" onClick={() => { setStatus('idle'); setResult(null) }}>
                  Edit
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--red)', fontSize: 13 }}>
            Couldn't parse input. Check your Groq API key.
          </div>
        )}

        {/* Recent captures */}
        <div className="section-row" style={{ marginTop: 24 }}>
          <div className="section-label">Recent captures</div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{captures.length} total</span>
        </div>

        {captures.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Nothing captured yet. Start above.</div>
        ) : captures.map(c => (
          <div key={c.id} className="flex-row gap-12" style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: TYPE_BG[c.classified_as] || 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ti ${TYPE_ICONS[c.classified_as] || 'ti-notes'}`} style={{ fontSize: 16, color: TYPE_COLORS[c.classified_as] || 'var(--muted)' }}></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.ai_result?.title || c.raw_input.slice(0, 50)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {format(new Date(c.created_at), 'h:mm a')} · {c.classified_as || 'unclassified'}
              </div>
            </div>
            <i className="ti ti-chevron-right" style={{ color: 'var(--muted)', fontSize: 16 }}></i>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
