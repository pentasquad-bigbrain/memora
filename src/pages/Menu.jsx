import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'

const AVATAR_COLORS = ['avatar-blue','avatar-green','avatar-purple','avatar-amber','avatar-red']
function initials(name) { return name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?' }
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0)||0)%AVATAR_COLORS.length] }

const SPACE_ICONS = ['ti-briefcase','ti-user','ti-run','ti-home','ti-star','ti-heart','ti-code','ti-palette']

const MENU_ITEMS = [
  { icon:'ti-layout-grid', label:'Projects',     color:'var(--accent)',  dest:'/tasks' },
  { icon:'ti-users',       label:'People',       color:'var(--green)',   dest:'/people' },
  { icon:'ti-bulb',        label:'IdeaLab',      color:'var(--purple)', dest:'/idealab' },
  { icon:'ti-sparkles',    label:'Smart Nudges', color:'var(--amber)',   dest:'/' },
  { icon:'ti-settings',    label:'Settings',     color:'var(--muted)',   dest:null },
  { icon:'ti-help-circle', label:'Help & feedback', color:'var(--muted)', dest:null },
  { icon:'ti-trash',       label:'Trash',        color:'var(--red)',     dest:null },
]

export default function Menu() {
  const navigate = useNavigate()
  const { user, spaces, activeSpace, setActiveSpace, deleteSpace } = useStore()
  const [theme, setTheme] = useState(() => localStorage.getItem('memora-theme') || 'light')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'
  const fullName  = user?.user_metadata?.full_name || firstName
  const email     = user?.email || ''

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('memora-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const handleDeleteSpace = async (id) => {
    setDeleting(true)
    await deleteSpace(id)
    setDeleting(false)
    setDeleteConfirm(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="page" style={{ background:'var(--surface)' }}>
      {/* Header bar */}
      <div style={{ padding:'max(14px,env(safe-area-inset-top)) 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={()=>navigate(-1)} style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--muted)', fontSize:14, fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
          <i className="ti ti-arrow-left" style={{ fontSize:20 }} />
        </button>
        <div style={{ fontSize:16, fontWeight:600 }}>Menu</div>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{ width:36, height:36, borderRadius:'50%', border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          <i className={`ti ${theme === 'light' ? 'ti-moon' : 'ti-sun'}`} style={{ fontSize:18 }} />
        </button>
      </div>

      <div className="page-scroll" style={{ paddingBottom:32 }}>
        {/* User card */}
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'20px 0 16px' }}>
          <div className={`avatar avatar-lg ${avatarColor(firstName)}`} style={{ flexShrink:0 }}>
            {initials(fullName)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:18, fontWeight:700 }}>{fullName}</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginTop:2 }}>{email}</div>
          </div>
        </div>

        {/* Theme toggle row (also visible inline) */}
        <div style={{ background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background: theme==='dark' ? 'var(--purple-soft)' : 'var(--amber-soft)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className={`ti ${theme==='dark' ? 'ti-moon' : 'ti-sun'}`} style={{ fontSize:16, color: theme==='dark' ? 'var(--purple-dark)' : 'var(--amber-dark)' }} />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:500 }}>{theme==='dark' ? 'Dark mode' : 'Light mode'}</div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>Tap to switch theme</div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', position:'relative', background: theme==='dark' ? 'var(--accent)' : 'var(--border-strong)', transition:'background .2s', flexShrink:0 }}
          >
            <div style={{ position:'absolute', top:3, left: theme==='dark' ? 22 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
          </button>
        </div>

        {/* Spaces */}
        <div className="section-label" style={{ marginTop:8 }}>Spaces</div>
        <div style={{ background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)', overflow:'hidden' }}>
          {spaces.map((sp,i) => (
            <div key={sp.id} style={{ display:'flex', alignItems:'center', borderBottom: i<spaces.length-1?'1px solid var(--border)':'none' }}>
              <button onClick={()=>{setActiveSpace(sp);navigate('/')}} style={{ display:'flex', alignItems:'center', gap:12, flex:1, padding:'14px 16px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left', minWidth:0 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'var(--accent-soft)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className={`ti ${SPACE_ICONS[i%SPACE_ICONS.length]}`} style={{ fontSize:16, color:'var(--accent)' }} />
                </div>
                <span style={{ flex:1, fontSize:15, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sp.name}</span>
                {activeSpace?.id===sp.id && <i className="ti ti-check" style={{ fontSize:16, color:'var(--accent)', flexShrink:0 }} />}
              </button>

              {/* Delete space */}
              {deleteConfirm === sp.id ? (
                <div style={{ display:'flex', gap:6, padding:'0 10px', flexShrink:0 }}>
                  <button
                    onClick={() => handleDeleteSpace(sp.id)}
                    disabled={deleting}
                    style={{ padding:'6px 12px', borderRadius:20, border:'none', background:'var(--red)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
                  >
                    {deleting ? '…' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{ padding:'6px 12px', borderRadius:20, border:'1px solid var(--border)', background:'none', color:'var(--muted)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(sp.id)}
                  style={{ width:36, height:36, borderRadius:'50%', border:'none', cursor:'pointer', background:'none', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hint)', marginRight:8, flexShrink:0 }}
                >
                  <i className="ti ti-trash" style={{ fontSize:15 }} />
                </button>
              )}
            </div>
          ))}
          <button onClick={()=>navigate('/')} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'14px 16px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'var(--bg)', border:'1.5px dashed var(--border-strong)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className="ti ti-plus" style={{ fontSize:16, color:'var(--muted)' }} />
            </div>
            <span style={{ fontSize:15, color:'var(--muted)' }}>Add new space</span>
          </button>
        </div>

        {/* Menu items */}
        <div className="section-label" style={{ marginTop:24 }}>Navigate</div>
        <div style={{ background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)', overflow:'hidden' }}>
          {MENU_ITEMS.map((item,i) => (
            <button key={item.label} onClick={()=>item.dest?navigate(item.dest):null} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'14px 16px', background:'none', border:'none', borderBottom:i<MENU_ITEMS.length-1?'1px solid var(--border)':'none', cursor:item.dest?'pointer':'default', fontFamily:'inherit', textAlign:'left' }}>
              <div style={{ width:32, height:32, borderRadius:8, background:`${item.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${item.icon}`} style={{ fontSize:17, color:item.color }} />
              </div>
              <span style={{ flex:1, fontSize:15, fontWeight:500, color:'var(--text)' }}>{item.label}</span>
              {item.dest && <i className="ti ti-chevron-right" style={{ fontSize:15, color:'var(--hint)' }} />}
            </button>
          ))}
        </div>

        {/* Log out */}
        <button onClick={handleLogout} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', marginTop:16, padding:'14px 16px', background:'var(--red-soft)', border:'1px solid var(--red)', borderRadius:'var(--r)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
          <i className="ti ti-logout" style={{ fontSize:18, color:'var(--red)' }} />
          <span style={{ fontSize:15, fontWeight:600, color:'var(--red)' }}>Log out</span>
        </button>
      </div>
    </div>
  )
}
