import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { isSuperUser } from '../lib/adminAccess'

const TABLES = ['spaces','tasks','people','ideas','vault_items','expenses','captures','journal_entries','nudges']

export default function Admin() {
  const store = useStore()
  const { user, tasks, people, expenses, ideas, vaultItems, spaces, captures, nudges, fetchAll, fetchSpaces } = store
  const [refreshing, setRefreshing] = useState(false)

  if (!isSuperUser(user)) return <Navigate to="/" replace />

  const stats = [
    ['Tasks', tasks.length, 'ti-checkbox', tasks.filter(t => t.status !== 'done').length + ' active'],
    ['People', people.length, 'ti-users', 'contacts'],
    ['Receipts', expenses.length, 'ti-receipt', 'payments'],
    ['Vault', vaultItems.length, 'ti-archive', 'files'],
    ['Ideas', ideas.length, 'ti-bulb', 'ideation'],
    ['Spaces', spaces.length, 'ti-layout-grid', 'workspaces'],
    ['Captures', captures.length, 'ti-sparkles', 'recent inputs'],
    ['Nudges', nudges.length, 'ti-bell', 'active alerts'],
  ]

  const apiKeys = [
    ['Supabase URL', import.meta.env.VITE_SUPABASE_URL ? 'Connected' : 'Missing'],
    ['Supabase anon key', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Connected' : 'Missing'],
    ['Groq API key', import.meta.env.VITE_GROQ_API_KEY ? 'Connected' : 'Missing'],
    ['Super users', import.meta.env.VITE_SUPER_USER_EMAILS || import.meta.env.VITE_SUPER_USER_IDS ? 'Configured' : 'Missing'],
  ]

  const featureFlags = [
    ['PWA share target', 'Enabled'],
    ['Capture notification', localStorage.getItem('memora-notifications') === 'on' ? 'Enabled' : 'Off'],
    ['Theme', localStorage.getItem('memora-theme') || 'light'],
    ['Task priority fallback', 'Enabled'],
    ['Voice simplification', 'Enabled'],
  ]

  const priorityStats = useMemo(() => {
    return ['high','med','low'].map(priority => [priority, tasks.filter(t => t.priority === priority).length])
  }, [tasks])

  const refresh = async () => {
    setRefreshing(true)
    await fetchSpaces()
    await fetchAll()
    setRefreshing(false)
  }

  return (
    <div className="page">
      <div style={{ padding:'max(14px,env(safe-area-inset-top)) 16px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:700 }}>Super Admin</h2>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>Backend, frontend, users, data, APIs</div>
        </div>
        <button onClick={refresh} disabled={refreshing} style={{ ...iconButton, color:'var(--accent)' }} title="Refresh app data">
          {refreshing ? <div className="spinner" style={{ width:16, height:16 }} /> : <i className="ti ti-refresh" />}
        </button>
      </div>

      <div className="page-scroll" style={{ paddingTop:14 }}>
        <Section title="Access">
          <Row icon="ti-shield-lock" label="Current super user" value={user?.email || user?.id} good />
          <Row icon="ti-id" label="User id" value={user?.id || 'Unknown'} />
        </Section>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          {stats.map(([label,value,icon,sub]) => (
            <div key={label} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'12px' }}>
              <i className={`ti ${icon}`} style={{ fontSize:18, color:'var(--accent)' }} />
              <div style={{ fontSize:24, fontWeight:800, marginTop:8 }}>{value}</div>
              <div style={{ fontSize:12, color:'var(--text)', fontWeight:600 }}>{label}</div>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{sub}</div>
            </div>
          ))}
        </div>

        <Section title="Supabase and APIs">
          {apiKeys.map(([label,status]) => <Row key={label} icon={status === 'Connected' || status === 'Configured' ? 'ti-circle-check' : 'ti-alert-circle'} label={label} value={status} good={status === 'Connected' || status === 'Configured'} />)}
        </Section>

        <Section title="Database tables">
          {TABLES.map(table => <Row key={table} icon="ti-database" label={table} value="RLS user-owned" />)}
        </Section>

        <Section title="Frontend controls">
          {featureFlags.map(([label,value]) => <Row key={label} icon="ti-adjustments" label={label} value={value} good={value === 'Enabled'} />)}
        </Section>

        <Section title="Priority health">
          {priorityStats.map(([priority,count]) => <Row key={priority} icon="ti-flag" label={priority.toUpperCase()} value={`${count} tasks`} good={count > 0} />)}
        </Section>

        <Section title="Maintenance">
          <button className="btn btn-ghost" style={{ width:'100%', marginBottom:8, justifyContent:'flex-start' }} onClick={() => { localStorage.removeItem('memora_task_meta_cache'); refresh() }}>
            <i className="ti ti-flag-off" /> Clear local priority fallback cache
          </button>
          <button className="btn btn-ghost" style={{ width:'100%', marginBottom:8, justifyContent:'flex-start' }} onClick={() => { localStorage.removeItem('memora_idea_tags_cache'); localStorage.removeItem('memora_vault_tags_cache'); refresh() }}>
            <i className="ti ti-tags-off" /> Clear local tag fallback caches
          </button>
          <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'flex-start' }} onClick={() => navigator.clipboard?.writeText(JSON.stringify({ tasks: tasks.length, people: people.length, expenses: expenses.length, ideas: ideas.length, vault: vaultItems.length }, null, 2))}>
            <i className="ti ti-copy" /> Copy app stats
          </button>
        </Section>

        <Section title="Recent captures">
          {(captures || []).slice(0, 8).map((c) => (
            <div key={c.id} style={{ padding:'11px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{c.ai_result?.title || c.raw_input?.slice(0, 70) || 'Capture'}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{c.input_type} · {c.classified_as}</div>
            </div>
          ))}
          {(!captures || captures.length === 0) && <div style={{ padding:'18px 0', color:'var(--muted)', fontSize:13, textAlign:'center' }}>No captures yet.</div>}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div className="section-label" style={{ marginTop:0 }}>{title}</div>
      <div className="card" style={{ padding:'4px 14px' }}>{children}</div>
    </div>
  )
}

function Row({ icon, label, value, good=false }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
      <i className={`ti ${icon}`} style={{ color:good ? 'var(--green)' : 'var(--muted)', fontSize:16 }} />
      <span style={{ flex:1, fontSize:13, fontWeight:600 }}>{label}</span>
      <span style={{ fontSize:11, fontWeight:700, color:good ? 'var(--green-dark)' : 'var(--muted)', textAlign:'right', maxWidth:170, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</span>
    </div>
  )
}

const iconButton = {
  width:38,
  height:38,
  borderRadius:'50%',
  border:'1px solid var(--border)',
  background:'var(--bg)',
  cursor:'pointer',
  display:'flex',
  alignItems:'center',
  justifyContent:'center',
  fontSize:18
}
