import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { setLocalAdminSession } from '../lib/adminAccess'

const APP_URL = import.meta.env.VITE_APP_URL || `${window.location.origin}/memora/`

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('sign-in') // 'sign-in' | 'sign-up'
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  const handleGoogle = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: APP_URL }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const { error } = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: APP_URL }
        })
    setLoading(false)
    if (error) setError(error.message)
    else if (mode === 'sign-up') setMessage('Account created. Check your email if confirmation is required.')
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email first.'); return }
    setError('')
    setMessage('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: APP_URL
    })
    setLoading(false)
    if (error) setError(error.message)
    else setMessage('Password reset link sent. Check your email.')
  }

  const handleAdminLogin = (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (adminId.trim() === 'admin' && adminPassword === 'admin1212') {
      setLocalAdminSession(true)
      window.location.href = `${APP_URL.replace(/\/$/, '')}/admin`
      return
    }
    setError('Invalid admin credentials.')
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '32px 24px',
      maxWidth: 430,
      margin: '0 auto'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          width: 64, height: 64,
          background: 'var(--accent)',
          borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <i className="ti ti-brain" style={{ fontSize: 32, color: '#fff' }}></i>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 500, color: 'var(--text)' }}>Memora</h1>
        <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>
          Your calm, intelligent<br />second brain
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 320 }}>
        <form onSubmit={handleEmailAuth}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 10 }}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', marginBottom: 10 }}
          />
          {error && (
            <p style={{ color: 'var(--red-dark)', fontSize: 13, marginBottom: 10 }}>{error}</p>
          )}
          {message && (
            <p style={{ color: 'var(--green-dark)', fontSize: 13, marginBottom: 10 }}>{message}</p>
          )}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', fontSize: 15, padding: '14px' }}
          >
            {loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}>
          {mode === 'sign-in' ? (
            <>No account? <a onClick={() => setMode('sign-up')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Sign up</a></>
          ) : (
            <>Already have an account? <a onClick={() => setMode('sign-in')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Sign in</a></>
          )}
        </p>
        {mode === 'sign-in' && (
          <button onClick={handleForgotPassword} disabled={loading} style={{ width:'100%', background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontFamily:'inherit', fontSize:13, marginTop:8 }}>
            Forgot password?
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button className="btn btn-ghost" style={{ width: '100%', fontSize: 15, padding: '14px' }} onClick={handleGoogle} disabled={loading}>
          <i className="ti ti-brand-google" style={{ fontSize: 18 }}></i>
          Continue with Google
        </button>
        <button onClick={() => setShowAdmin(s => !s)} style={{ width:'100%', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontFamily:'inherit', fontSize:12, marginTop:14 }}>
          Admin access
        </button>
        {showAdmin && (
          <form onSubmit={handleAdminLogin} style={{ marginTop:10, padding:12, border:'1px solid var(--border)', borderRadius:'var(--r)', background:'var(--surface)' }}>
            <input className="input" placeholder="Admin ID" value={adminId} onChange={e=>setAdminId(e.target.value)} style={{ marginBottom:8 }} />
            <input className="input" placeholder="Admin password" type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} style={{ marginBottom:8 }} />
            <button className="btn btn-primary" type="submit" style={{ width:'100%' }}>Open admin</button>
          </form>
        )}
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
          Your data is private and encrypted.<br />Memora never shares your information.
        </p>
      </div>
    </div>
  )
}
