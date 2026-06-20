// People.jsx
import { useStore } from '../lib/store'
import { formatDistanceToNow } from 'date-fns'

const AVATAR_COLORS = ['avatar-blue', 'avatar-green', 'avatar-purple', 'avatar-amber', 'avatar-red']
function initials(name) { return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?' }
function avatarColor(name) { const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length; return AVATAR_COLORS[idx] }
const ROLE_STYLE = { client: { bg: 'var(--accent-soft)', color: 'var(--accent-dark)' }, team: { bg: 'var(--green-soft)', color: 'var(--green-dark)' }, personal: { bg: 'var(--purple-soft)', color: 'var(--purple-dark)' }, other: { bg: 'var(--bg)', color: 'var(--muted)' } }

export function People() {
  const { people, tasks } = useStore()
  const [search, setSearch] = useState('')
  const filtered = people.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0' }}><h2>People</h2></div>
      <div style={{ padding: '0 16px' }}>
        <div className="search-bar">
          <i className="ti ti-search"></i>
          <input placeholder="Search people…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="page-scroll" style={{ paddingTop: 4 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
            {search ? 'No people found.' : 'People are auto-detected from your captures.'}
          </div>
        ) : (
          <div className="card" style={{ padding: '4px 16px' }}>
            {filtered.map((person, i) => {
              const personTasks = tasks.filter(t => t.person_id === person.id)
              const rs = ROLE_STYLE[person.role] || ROLE_STYLE.other
              return (
                <div key={person.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                  <div className={`avatar avatar-lg ${avatarColor(person.name)}`}>{initials(person.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{person.name}</div>
                    <span style={{ fontSize: 10, fontWeight: 500, background: rs.bg, color: rs.color, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginTop: 3 }}>{person.role || 'other'}</span>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                      {personTasks.length} tasks · {person.last_interaction ? `Last: ${formatDistanceToNow(new Date(person.last_interaction), { addSuffix: true })}` : 'No interaction yet'}
                    </div>
                  </div>
                  <i className="ti ti-chevron-right" style={{ color: 'var(--muted)', fontSize: 16 }}></i>
                </div>
              )
            })}
          </div>
        )}
        <div className="nudge" style={{ marginTop: 16 }}>
          <i className="ti ti-sparkles nudge-icon"></i>
          <div className="nudge-text">People are <strong>auto-tagged</strong> from your captures, tasks, and notes.</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Vault.jsx
// ─────────────────────────────────────────────────────────────
const VAULT_ICONS = { screenshot: 'ti-screenshot', document: 'ti-file-text', receipt: 'ti-receipt', image: 'ti-photo', note: 'ti-notes' }
const VAULT_BG = { screenshot: 'var(--accent-soft)', document: 'var(--bg)', receipt: 'var(--amber-soft)', image: 'var(--purple-soft)', note: 'var(--green-soft)' }
const VAULT_COLOR = { screenshot: 'var(--accent)', document: 'var(--muted)', receipt: 'var(--amber)', image: 'var(--purple)', note: 'var(--green)' }
const CATS = ['all', 'ideas', 'screenshots', 'documents', 'receipts']

export function Vault() {
  const { vaultItems, ideas } = useStore()
  const [cat, setCat] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = vaultItems.filter(v => {
    if (cat !== 'all' && !v.type.includes(cat.slice(0, -1))) return false
    if (search && !v.title?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Vault</h2>
        <div style={{ display: 'flex', gap: 14 }}>
          <i className="ti ti-search" style={{ fontSize: 20, color: 'var(--muted)', cursor: 'pointer' }}></i>
          <i className="ti ti-adjustments-horizontal" style={{ fontSize: 20, color: 'var(--muted)', cursor: 'pointer' }}></i>
        </div>
      </div>
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 6, padding: '10px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {CATS.map(c => (
            <button key={c} className={`pill ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)} style={{ textTransform: 'capitalize' }}>{c}</button>
          ))}
        </div>
      </div>
      <div className="page-scroll" style={{ paddingTop: 4 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>Nothing in the vault yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {filtered.map(item => (
              <div key={item.id} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)' }}>
                <div style={{ height: 80, background: VAULT_BG[item.type], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ti ${VAULT_ICONS[item.type] || 'ti-file'}`} style={{ fontSize: 28, color: VAULT_COLOR[item.type] || 'var(--muted)' }}></i>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Untitled'}</div>
                  {item.tags?.length > 0 && <div style={{ fontSize: 10, background: 'var(--border)', color: 'var(--muted)', borderRadius: 20, padding: '2px 6px', display: 'inline-block', marginTop: 4 }}>{item.tags[0]}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {ideas.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 20 }}>Ideas</div>
            {ideas.slice(0, 5).map(idea => (
              <div key={idea.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{idea.title}</div>
                {idea.body && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{idea.body.slice(0, 80)}{idea.body.length > 80 ? '…' : ''}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {idea.tags?.map(t => <span key={t} className="pill" style={{ fontSize: 10, padding: '2px 8px' }}>{t}</span>)}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Journal.jsx
// ─────────────────────────────────────────────────────────────
export function Journal() {
  const { tasks, ideas, expenses, captures } = useStore()
  const [personalNote, setPersonalNote] = useState('')

  const today = new Date()
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - 3 + i); return d })
  const [selectedDay, setSelectedDay] = useState(3)

  const todayDone = tasks.filter(t => t.status === 'done')
  const todayIdeas = ideas.filter(i => { const d = new Date(i.created_at); return d.toDateString() === today.toDateString() })
  const todayCaptures = captures.filter(c => { const d = new Date(c.created_at); return d.toDateString() === today.toDateString() })
  const todayExpenses = expenses.filter(e => e.date === today.toISOString().split('T')[0])
  const totalSpent = todayExpenses.reduce((s, e) => s + Number(e.amount), 0)

  const SUMMARY_ITEMS = [
    { icon: 'ti-check', color: 'var(--green)', bg: 'var(--green-soft)', text: `${todayDone.length} tasks completed` },
    { icon: 'ti-bulb', color: 'var(--purple)', bg: 'var(--purple-soft)', text: `${todayIdeas.length} ideas captured` },
    { icon: 'ti-screenshot', color: 'var(--amber)', bg: 'var(--amber-soft)', text: `${todayCaptures.length} captures today` },
    { icon: 'ti-currency-rupee', color: 'var(--accent)', bg: 'var(--accent-soft)', text: totalSpent > 0 ? `₹${Math.round(totalSpent).toLocaleString('en-IN')} spent` : 'No expenses today' }
  ]

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Journal</h2>
        <i className="ti ti-chevron-right" style={{ fontSize: 20, color: 'var(--muted)' }}></i>
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
        <div className="section-label">Today's summary</div>
        <div className="card" style={{ padding: '4px 16px' }}>
          {SUMMARY_ITEMS.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < SUMMARY_ITEMS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 14, color: item.color }}></i>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{item.text}</div>
            </div>
          ))}
        </div>

        <div className="section-label" style={{ marginTop: 20 }}>Day notes</div>
        <textarea
          className="input"
          placeholder="How was your day? Add a personal note…"
          value={personalNote}
          onChange={e => setPersonalNote(e.target.value)}
          style={{ minHeight: 100, fontSize: 14 }}
        />

        <div className="nudge" style={{ marginTop: 12 }}>
          <i className="ti ti-sparkles nudge-icon"></i>
          <div className="nudge-text"><strong>Auto-generated from your day.</strong> Add a personal note above to complete your journal.</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// IdeaLab.jsx
// ─────────────────────────────────────────────────────────────
export function IdeaLab() {
  const { ideas } = useStore()
  const [selected, setSelected] = useState(null)
  const [expansion, setExpansion] = useState(null)
  const [loading, setLoading] = useState(false)

  const { expandIdea } = require('../lib/groq')

  const handleExpand = async (idea) => {
    setLoading(true)
    try {
      const result = await expandIdea(idea)
      setExpansion(result)
    } catch {
      // handle error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>IdeaLab</h2>
        <i className="ti ti-adjustments-horizontal" style={{ fontSize: 20, color: 'var(--muted)' }}></i>
      </div>
      <div className="page-scroll" style={{ paddingTop: 8 }}>
        {!selected ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Develop your ideas with AI assistance.</div>
            <div className="section-label">My ideas</div>
            {ideas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>No ideas yet. Capture one to start.</div>
            ) : ideas.map(idea => (
              <div key={idea.id} className="card" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => { setSelected(idea); setExpansion(null) }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{idea.title}</div>
                {idea.body && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{idea.body.slice(0, 70)}…</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {idea.tags?.map(t => <span key={t} className="pill" style={{ fontSize: 10 }}>{t}</span>)}
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <button onClick={() => { setSelected(null); setExpansion(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 16 }}></i> All ideas
            </button>
            <div className="card">
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{selected.title}</div>
              {selected.body && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{selected.body}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => handleExpand(selected)} disabled={loading}>
                {loading ? <div className="spinner" style={{ width: 14, height: 14 }}></div> : <><i className="ti ti-sparkles" style={{ fontSize: 14 }}></i> Expand idea</>}
              </button>
            </div>
            {expansion && (
              <>
                <div className="section-label">AI expansion</div>
                <div className="card">
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{expansion.expanded}</div>
                </div>
                {expansion.tasks?.length > 0 && (
                  <>
                    <div className="section-label">Suggested tasks</div>
                    {expansion.tasks.map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <i className="ti ti-circle" style={{ color: 'var(--accent)', fontSize: 14 }}></i>
                        <div style={{ fontSize: 13, color: 'var(--text)' }}>{t}</div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Need useState for People, Vault, Journal
import { useState } from 'react'
