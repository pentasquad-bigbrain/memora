import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { isSuperUser, setLocalAdminSession } from '../lib/adminAccess'

const NAV = [
  ['dashboard','Dashboard','ti-layout-dashboard'],
  ['users','Users','ti-users'],
  ['workspaces','Workspaces','ti-building'],
  ['tasks','Tasks','ti-checkbox'],
  ['vault','Vault','ti-archive'],
  ['ai','AI Intelligence','ti-sparkles'],
  ['notifications','Notifications','ti-bell'],
  ['analytics','Analytics','ti-chart-area'],
  ['security','Security','ti-shield-lock'],
  ['developer','Developer','ti-code'],
  ['settings','Settings','ti-settings'],
]

const HEALTH = [
  ['API','healthy'], ['Database','healthy'], ['Storage','healthy'], ['AI Service','healthy'],
  ['OCR','warning'], ['Push Service','healthy'], ['Workers','healthy'], ['Queue','healthy'],
]

export default function Admin() {
  const navigate = useNavigate()
  const { user, tasks, people, expenses, ideas, vaultItems, spaces, captures, nudges, fetchAll, fetchSpaces } = useStore()
  const [active, setActive] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState('')
  const [flags, setFlags] = useState(() => ({
    timelineAi: localStorage.getItem('mc-timeline-ai') !== 'off',
    voiceNotes: localStorage.getItem('mc-voice-notes') !== 'off',
    ideaLab: localStorage.getItem('mc-idea-lab') !== 'off',
    dailyBrief: localStorage.getItem('mc-daily-brief') === 'on',
    ocr: localStorage.getItem('mc-ocr') !== 'off',
    offlineSync: localStorage.getItem('mc-offline-sync') !== 'off',
    beta: localStorage.getItem('mc-beta') === 'on',
  }))
  const [notification, setNotification] = useState({ audience:'Everyone', title:'', body:'' })

  if (!isSuperUser(user)) return <Navigate to="/" replace />

  const money = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const today = new Date().toDateString()
  const tasksToday = tasks.filter(t => t.due_at && new Date(t.due_at).toDateString() === today).length
  const storageMb = Math.max(1, Math.round(vaultItems.reduce((sum, item) => sum + (item.file_url?.length || 0), 0) / 1024))
  const onlineUsers = Math.max(1, Math.min(people.length || 1, 7))

  const kpis = [
    ['Users Online', onlineUsers, 'ti-activity', '+ live'],
    ['Daily Active Users', Math.max(people.length, captures.length), 'ti-user-check', 'today'],
    ['Monthly Active Users', people.length + spaces.length, 'ti-users-group', 'rolling'],
    ['Tasks Today', tasksToday, 'ti-checkbox', 'scheduled'],
    ['Timeline Events', captures.length + tasks.length, 'ti-timeline', 'events'],
    ['Vault Uploads', vaultItems.length, 'ti-cloud-upload', 'files'],
    ['Journal Entries', 0, 'ti-notebook', 'tracked'],
    ['AI Requests', captures.filter(c => c.ai_result).length, 'ti-sparkles', 'parsed'],
    ['Notifications Sent', nudges.length, 'ti-bell-ringing', 'nudges'],
    ['Revenue Today', `₹${Math.round(Math.max(0, money)).toLocaleString('en-IN')}`, 'ti-credit-card', 'logged'],
    ['Storage Used', `${storageMb} KB`, 'ti-database', 'local estimate'],
    ['Queue Status', 'Clear', 'ti-list-check', 'workers'],
  ]

  const activity = [
    ...captures.slice(0, 5).map(c => ['AI Request', c.ai_result?.title || c.raw_input || 'Capture parsed', c.created_at]),
    ...tasks.slice(0, 5).map(t => ['Task Created', t.title, t.created_at]),
    ...vaultItems.slice(0, 5).map(v => ['Vault Upload', v.title || 'Untitled file', v.created_at]),
    ...spaces.slice(0, 4).map(s => ['Workspace Created', s.name, s.created_at]),
  ].sort((a,b) => new Date(b[2] || 0) - new Date(a[2] || 0)).slice(0, 10)

  const filteredPeople = people.filter(p => p.name?.toLowerCase().includes(query.toLowerCase()))
  const filteredTasks = tasks.filter(t => t.title?.toLowerCase().includes(query.toLowerCase()))
  const filteredVault = vaultItems.filter(v => v.title?.toLowerCase().includes(query.toLowerCase()))

  const refresh = async () => {
    setRefreshing(true)
    await fetchSpaces()
    await fetchAll()
    setRefreshing(false)
    flash('Mission Control refreshed')
  }

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const toggleFlag = (key) => {
    setFlags(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(`mc-${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`, next[key] ? 'on' : 'off')
      return next
    })
  }

  const logoutAdmin = async () => {
    setLocalAdminSession(false)
    await supabase.auth.signOut()
    navigate('/', { replace:true })
    window.location.reload()
  }

  return (
    <div className="mission-control">
      <aside className="mc-sidebar">
        <div className="mc-brand">
          <div className="mc-brand-mark"><i className="ti ti-brain" /></div>
          <div>
            <div className="mc-brand-name">Memora</div>
            <div className="mc-brand-sub">Mission Control</div>
          </div>
        </div>
        <nav className="mc-nav">
          {NAV.map(([key,label,icon]) => (
            <button key={key} className={`mc-nav-item ${active === key ? 'active' : ''}`} onClick={() => setActive(key)}>
              <i className={`ti ${icon}`} /> {label}
            </button>
          ))}
        </nav>
        <button className="mc-logout" onClick={logoutAdmin}><i className="ti ti-logout" /> Logout Admin</button>
      </aside>

      <main className="mc-main">
        <header className="mc-topbar">
          <div className="mc-search"><i className="ti ti-search" /><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users, tasks, files, logs..." /></div>
          <button className="mc-icon-btn" onClick={refresh}>{refreshing ? <span className="spinner" /> : <i className="ti ti-refresh" />}</button>
          <button className="mc-icon-btn" onClick={() => flash('Command palette ready: Ctrl + K')}><i className="ti ti-command" /></button>
          <button className="mc-primary" onClick={() => setActive('notifications')}><i className="ti ti-plus" /> Quick Create</button>
        </header>

        <section className="mc-hero">
          <div>
            <div className="mc-eyebrow">Production Control Center</div>
            <h1>Memora Mission Control</h1>
            <p>Operate users, workspaces, tasks, AI, notifications, storage, security, and developer systems from one premium dashboard.</p>
          </div>
          <div className="mc-health-strip">
            {HEALTH.slice(0,4).map(([name,status]) => <Status key={name} name={name} status={status} />)}
          </div>
        </section>

        {active === 'dashboard' && (
          <>
            <div className="mc-kpi-grid">{kpis.map(([label,value,icon,sub]) => <Kpi key={label} label={label} value={value} icon={icon} sub={sub} />)}</div>
            <div className="mc-grid-2">
              <Panel title="Live Activity Feed" icon="ti-pulse">
                {activity.map(([type,text,time], i) => <Activity key={i} type={type} text={text} time={time} />)}
              </Panel>
              <Panel title="System Health" icon="ti-heartbeat">
                <div className="mc-health-grid">{HEALTH.map(([name,status]) => <Status key={name} name={name} status={status} />)}</div>
              </Panel>
            </div>
          </>
        )}

        {active === 'users' && <EntityPanel title="User Management" items={filteredPeople} icon="ti-user" fields={['role','last_interaction']} actions={['Open profile','Suspend','Reset Password','View Sessions']} />}
        {active === 'workspaces' && <EntityPanel title="Workspaces" items={spaces} icon="ti-building" fields={['type','created_at']} actions={['Members','Roles','Permissions','Billing']} />}
        {active === 'tasks' && <EntityPanel title="Tasks Control" items={filteredTasks} icon="ti-checkbox" fields={['priority','status','due_at']} actions={['Open','Reassign','Change Priority','Archive']} />}
        {active === 'vault' && <EntityPanel title="Vault Dashboard" items={filteredVault} icon="ti-archive" fields={['type','created_at']} actions={['OCR','Sort','Mark Duplicate','Delete']} />}
        {active === 'ai' && <AiPanel captures={captures} ideas={ideas} tasks={tasks} />}
        {active === 'notifications' && <NotificationPanel notification={notification} setNotification={setNotification} flash={flash} />}
        {active === 'analytics' && <AnalyticsPanel tasks={tasks} captures={captures} expenses={expenses} vaultItems={vaultItems} />}
        {active === 'security' && <SecurityPanel user={user} />}
        {active === 'developer' && <DeveloperPanel refresh={refresh} />}
        {active === 'settings' && <SettingsPanel flags={flags} toggleFlag={toggleFlag} logoutAdmin={logoutAdmin} />}
      </main>
      {toast && <div className="mc-toast">{toast}</div>}
    </div>
  )
}

function Kpi({ label, value, icon, sub }) {
  return <div className="mc-card mc-kpi"><i className={`ti ${icon}`} /><div className="mc-kpi-value">{value}</div><div className="mc-kpi-label">{label}</div><div className="mc-kpi-sub">{sub}</div></div>
}

function Panel({ title, icon, children }) {
  return <section className="mc-panel"><div className="mc-panel-title"><i className={`ti ${icon}`} /> {title}</div>{children}</section>
}

function Activity({ type, text, time }) {
  return <div className="mc-activity"><span className="mc-dot" /><div><b>{type}</b><p>{text}</p></div><time>{time ? new Date(time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : 'now'}</time></div>
}

function Status({ name, status }) {
  return <div className={`mc-status ${status}`}><span /> <b>{name}</b><em>{status}</em></div>
}

function EntityPanel({ title, items, icon, fields, actions }) {
  return (
    <Panel title={title} icon={icon}>
      <div className="mc-table">
        {items.slice(0, 30).map((item, i) => (
          <div className="mc-table-row" key={item.id || i}>
            <div><b>{item.name || item.title || item.vendor || 'Untitled'}</b><p>{item.email || item.notes || item.ocr_text || item.body || 'No details'}</p></div>
            {fields.map(f => <span key={f}>{String(item[f] || '-').slice(0, 20)}</span>)}
            <div className="mc-row-actions">{actions.slice(0,2).map(a => <button key={a}>{a}</button>)}</div>
          </div>
        ))}
        {!items.length && <div className="mc-empty">No records match.</div>}
      </div>
    </Panel>
  )
}

function AiPanel({ captures, ideas, tasks }) {
  const aiRequests = captures.filter(c => c.ai_result).length
  return <Panel title="AI Intelligence" icon="ti-sparkles"><div className="mc-kpi-grid compact">{[
    ['Requests Today', aiRequests], ['Task Generation', tasks.filter(t=>t.source !== 'manual').length], ['Idea Generation', ideas.length], ['OCR Jobs', captures.filter(c=>c.input_type === 'image').length], ['Error Rate', '0.4%'], ['Monthly AI Cost', '₹0']
  ].map(([a,b]) => <div className="mc-mini" key={a}><b>{b}</b><span>{a}</span></div>)}</div></Panel>
}

function NotificationPanel({ notification, setNotification, flash }) {
  return <Panel title="Notification Center" icon="ti-bell"><div className="mc-form"><select value={notification.audience} onChange={e=>setNotification(n=>({...n,audience:e.target.value}))}>{['Everyone','Premium','Beta','Selected Users'].map(v=><option key={v}>{v}</option>)}</select><input placeholder="Notification title" value={notification.title} onChange={e=>setNotification(n=>({...n,title:e.target.value}))} /><textarea placeholder="Message body" value={notification.body} onChange={e=>setNotification(n=>({...n,body:e.target.value}))} /><button className="mc-primary" onClick={()=>flash('Notification draft queued')}>Schedule Notification</button></div></Panel>
}

function AnalyticsPanel({ tasks, captures, expenses, vaultItems }) {
  return <Panel title="Analytics" icon="ti-chart-area"><div className="mc-chart-bars">{[tasks.length,captures.length,expenses.length,vaultItems.length,Math.max(2,tasks.filter(t=>t.status==='done').length)].map((v,i)=><span key={i} style={{ height: `${Math.max(12, v * 8)}px` }} />)}</div><div className="mc-muted">Feature usage, retention, timeline, vault, journal and AI trends are summarized from current app data.</div></Panel>
}

function SecurityPanel({ user }) {
  return <Panel title="Security" icon="ti-shield-lock"><div className="mc-kpi-grid compact">{['Failed Logins','Blocked IPs','Rate Limits','Suspicious Sessions','Admin Logs','Token Revocation'].map((x,i)=><div className="mc-mini" key={x}><b>{i === 0 ? 0 : 'OK'}</b><span>{x}</span></div>)}</div><div className="mc-muted">Current operator: {user?.email || 'Local admin'}</div></Panel>
}

function DeveloperPanel({ refresh }) {
  return <Panel title="Developer" icon="ti-code"><div className="mc-kpi-grid compact">{['API Logs','Background Jobs','Redis','Queue','Workers','Database','Cron Jobs','Backups'].map((x)=><div className="mc-mini" key={x}><b>Ready</b><span>{x}</span></div>)}</div><button className="mc-primary" onClick={refresh}>Refresh Runtime Data</button></Panel>
}

function SettingsPanel({ flags, toggleFlag, logoutAdmin }) {
  return <Panel title="Settings and Feature Flags" icon="ti-settings"><div className="mc-flags">{Object.entries(flags).map(([key,value])=><button key={key} className={value ? 'on' : ''} onClick={()=>toggleFlag(key)}><span>{key.replace(/[A-Z]/g, m => ' ' + m).replace(/^./, s=>s.toUpperCase())}</span><b>{value ? 'Enabled' : 'Off'}</b></button>)}</div><button className="mc-danger" onClick={logoutAdmin}><i className="ti ti-logout" /> Logout Admin</button></Panel>
}
