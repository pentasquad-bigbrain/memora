import { useStore } from '../lib/store'

export default function Admin() {
  const { user, tasks, people, expenses, ideas, vaultItems, spaces, captures } = useStore()
  const stats = [
    ['Tasks', tasks.length, 'ti-checkbox'],
    ['People', people.length, 'ti-users'],
    ['Receipts', expenses.length, 'ti-receipt'],
    ['Vault', vaultItems.length, 'ti-archive'],
    ['Ideas', ideas.length, 'ti-bulb'],
    ['Spaces', spaces.length, 'ti-layout-grid'],
  ]
  const apiKeys = [
    ['Supabase URL', import.meta.env.VITE_SUPABASE_URL ? 'Connected' : 'Missing'],
    ['Supabase anon key', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Connected' : 'Missing'],
    ['Groq API key', import.meta.env.VITE_GROQ_API_KEY ? 'Connected' : 'Missing'],
  ]
  return (
    <div className="page">
      <div style={{ padding:'max(14px,env(safe-area-inset-top)) 16px 0' }}>
        <h2 style={{ fontSize:22, fontWeight:700 }}>Admin Dashboard</h2>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>Control center for app data, users, Supabase, and APIs</div>
      </div>
      <div className="page-scroll" style={{ paddingTop:14 }}>
        <div className="card" style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Current user</div>
          <div style={{ fontSize:15, fontWeight:600 }}>{user?.user_metadata?.full_name || 'Memora user'}</div>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{user?.email}</div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          {stats.map(([label,value,icon]) => (
            <div key={label} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'12px' }}>
              <i className={`ti ${icon}`} style={{ fontSize:18, color:'var(--accent)' }} />
              <div style={{ fontSize:24, fontWeight:800, marginTop:8 }}>{value}</div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>{label}</div>
            </div>
          ))}
        </div>

        <div className="section-label">Supabase and APIs</div>
        <div className="card" style={{ padding:'4px 14px', marginBottom:14 }}>
          {apiKeys.map(([label,status], i) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:i<apiKeys.length-1?'1px solid var(--border)':'none' }}>
              <i className={`ti ${status === 'Connected' ? 'ti-circle-check' : 'ti-alert-circle'}`} style={{ color:status === 'Connected' ? 'var(--green)' : 'var(--red)' }} />
              <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{label}</span>
              <span style={{ fontSize:11, fontWeight:700, color:status === 'Connected' ? 'var(--green-dark)' : 'var(--red-dark)' }}>{status}</span>
            </div>
          ))}
        </div>

        <div className="section-label">Recent activity</div>
        <div className="card" style={{ padding:'4px 14px' }}>
          {(captures || []).slice(0, 6).map((c, i) => (
            <div key={c.id || i} style={{ padding:'11px 0', borderBottom:i<Math.min(captures.length, 6)-1?'1px solid var(--border)':'none' }}>
              <div style={{ fontSize:13, fontWeight:500 }}>{c.ai_result?.title || c.raw_input?.slice(0, 60) || 'Capture'}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{c.input_type} · {c.classified_as}</div>
            </div>
          ))}
          {(!captures || captures.length === 0) && <div style={{ padding:'18px 0', color:'var(--muted)', fontSize:13, textAlign:'center' }}>No captures yet.</div>}
        </div>
      </div>
    </div>
  )
}
